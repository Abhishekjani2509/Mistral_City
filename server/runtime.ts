import fs from "node:fs/promises";
import path from "node:path";
import type { CatDispatchRequest, CatEvent } from "../contracts/cat-events";
import { runRepair } from "../src/agents/repair";

export interface CatRuntimeOptions {
  /**
   * Repository the cat should repair. Normally the clone made when the city
   * was analyzed, so the cat edits the codebase the user is looking at.
   * Falls back to the bundled demo repo when absent.
   */
  repoPath?: string;
}

export type CatRuntime = (
  request: CatDispatchRequest,
  options?: CatRuntimeOptions,
) => AsyncIterable<CatEvent>;

/**
 * Temporary runtime used while SWE 3 finishes the real agent.
 *
 * The HTTP contract is already real: only this function gets replaced with
 * an adapter around SWE 3's runRepair implementation.
 */
export const replayRepair: CatRuntime = async function* (request) {
  const fixturePath = path.resolve(process.cwd(), "contracts/repair-run.example.ndjson");
  const fixture = await fs.readFile(fixturePath, "utf8");
  const events = fixture
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as CatEvent);

  for (const event of events) {
    await new Promise((resolve) => setTimeout(resolve, 250));

    const remappedEvent = {
      ...event,
      runId: request.runId,
      systemId: request.systemId,
      payload: event.phase === "DISPATCHED"
        ? { issue: request.issue }
        : event.payload,
    } as CatEvent;

    yield remappedEvent;
  }
};

/**
 * SWE 3 integration point, now wired to the real Repair Cat.
 *
 * runRepair already matches CatRuntime, so no adapter is needed. It repairs
 * the bundled demo repo by default; pass `repoPath` to point it elsewhere.
 *
 * Set CAT_RUNTIME=replay to fall back to the fixture. A real run takes
 * roughly 20-45s because it runs Mistral and the test suite for real, where
 * the replay always takes 2s.
 */
export const dispatchCat: CatRuntime = (request, options) =>
  process.env.CAT_RUNTIME === "replay"
    ? replayRepair(request)
    : runRepair(request, options?.repoPath ? { repoPath: options.repoPath } : {});
