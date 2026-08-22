import cors from "cors";
import express from "express";
import type { CatDispatchRequest, FailedEvent } from "../contracts/cat-events";
import { dispatchCat } from "./runtime";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mistral-city-agent-bridge" });
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

  try {
    for await (const event of dispatchCat(request)) {
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

app.listen(port, () => {
  console.log(`Mistral City agent bridge listening on http://localhost:${port}`);
  console.log(`CORS allowed origin: ${clientOrigin}`);
});
