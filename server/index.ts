import cors from "cors";
import express from "express";
import path from "node:path";
import {
  DiskCache,
  MistralClient,
  analysisIssueSources,
  loadConfig,
  normalizeCityModel,
  replaceSystem,
  scanRepository,
  scoutSystem,
  snapshotRepository,
} from "@mistral-city/intelligence";
import type { AnalysisModel } from "@mistral-city/intelligence";
import type { CatDispatchRequest, FailedEvent } from "../contracts/cat-events";
import type { IssueSourceLink } from "../contracts/issue-sources";
import { AnalysisSessionStore } from "./analysis-sessions";
import { dispatchCat } from "./runtime";
import { buildGitHubIssueSources, cloneGitHubRepository, type RepositoryStreamEvent } from "./repository";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

const analysisSessionLifetimeMs = 30 * 60 * 1_000;
const analysisSessions = new AnalysisSessionStore(analysisSessionLifetimeMs);

function issueSourceLinks(
  analysis: AnalysisModel,
  source: { webUrl: string; revision: string },
): IssueSourceLink[] {
  return buildGitHubIssueSources(analysisIssueSources(analysis), source.webUrl, source.revision);
}

function getAnalysisSession(id: string) {
  return analysisSessions.get(id);
}

function beginSse(res: express.Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(": keep-alive\n\n");
  }, 15_000);
  const send = (event: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  return { send, close: () => { clearInterval(keepAlive); res.end(); } };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mistral-city-agent-bridge" });
});

app.post("/api/analyze-repository", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  const stream = beginSse(res);
  const send = (event: RepositoryStreamEvent | object) => stream.send(event);

  let repository: Awaited<ReturnType<typeof cloneGitHubRepository>> | undefined;
  let repositoryRetained = false;
  try {
    send({ type: "repository.started", data: { url } });
    repository = await cloneGitHubRepository(url);
    send({ type: "repository.cloned", data: { name: repository.name } });
    const snapshot = { ...(await snapshotRepository(repository.root)), repoName: repository.name };
    let analysis: AnalysisModel | undefined;
    const model = await scanRepository(snapshot, {
      analysisProfile: "fast",
      mode: "live",
      emit: (event) => send(event),
      log: (message) => console.log(`[city-intel] ${message}`),
      onAnalysis: (value) => { analysis = value; },
    });
    if (analysis) {
      const source = { webUrl: repository.webUrl, revision: repository.revision };
      send({ type: "analysis.sources", data: { sources: issueSourceLinks(analysis, source) } });
      const id = analysisSessions.save({ snapshot, analysis, source, cleanup: repository.cleanup });
      repositoryRetained = true;
      send({ type: "analysis.session", data: { id } });
    }
    send({ type: "city.model", data: model });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Repository analysis failed", message);
    send({ type: "repository.failed", data: { message } });
  } finally {
    if (!repositoryRetained) await repository?.cleanup();
    stream.close();
  }
});

app.post("/api/scout", async (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const systemId = typeof req.body?.systemId === "string" ? req.body.systemId : "";
  const stream = beginSse(res);

  try {
    if (!sessionId || !systemId) throw new Error("Scout Cat needs a repository session and a system to inspect.");
    const session = getAnalysisSession(sessionId);
    const config = loadConfig();
    if (!config.apiKey) throw new Error("MISTRAL_API_KEY is not configured for Scout Cat.");
    const revealed = await scoutSystem(systemId, session.analysis, session.snapshot, {
      client: new MistralClient(config.apiKey, config.apiBase, config.retries, config.requestTimeoutMs),
      cache: new DiskCache(config.cacheDir),
      discoveryModel: config.discoveryModel,
      codeModel: config.codeModel,
      smallModel: config.smallModel,
      emit: (event) => {
        if (event.type === "agent.progress") {
          stream.send({ type: "scout.progress", data: { systemId, message: event.data.plainText } });
        }
      },
    });

    session.analysis = replaceSystem(session.analysis, revealed);
    stream.send({
      type: "scout.complete",
      data: {
        systemId,
        model: normalizeCityModel(session.snapshot, session.analysis),
        health: revealed.health,
        status: revealed.status,
        summary: `Scout Cat mapped ${revealed.name}.`,
        detail: revealed.plainDescription,
        files: revealed.files,
        sources: issueSourceLinks(session.analysis, session.source),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scout Cat failed", message);
    stream.send({ type: "scout.failed", data: { systemId, message } });
  } finally {
    stream.close();
  }
});

app.post("/api/dispatch-cat", async (req, res) => {
  const request = req.body as CatDispatchRequest;

  if (!request || request.schema !== "mistral.city.cat-dispatch/v1") {
    res.status(400).json({ error: "Invalid cat dispatch request." });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Repair the repository the city was built from, so the cat edits the code
  // the user is actually looking at. Without a live session it falls back to
  // the bundled demo repo.
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  let repoPath: string | undefined;
  if (sessionId) {
    try {
      repoPath = getAnalysisSession(sessionId).snapshot.root;
    } catch {
      // An expired session is not worth failing the dispatch over.
    }
  }

  try {
    for await (const event of dispatchCat(request, repoPath ? { repoPath } : undefined)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    console.error("Cat runtime failed", error);
    const failedEvent: FailedEvent = {
      schema: "mistral.city.cat-event/v1",
      runId: request.runId,
      sequence: 0,
      emittedAt: new Date().toISOString(),
      agent: request.agent,
      phase: "FAILED",
      systemId: request.systemId,
      message: "The Repair Cat runtime could not complete the repair.",
      payload: {
        code: "AGENT_ERROR",
        summary: "The agent bridge encountered an unexpected error.",
        retryable: true,
        details: error instanceof Error ? error.message : "Unknown runtime error.",
      },
    };
    res.write(`data: ${JSON.stringify(failedEvent)}\n\n`);
  } finally {
    res.end();
  }
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Mistral City agent bridge listening on http://localhost:${port}`);
  console.log(`CORS allowed origin: ${clientOrigin}`);
});
