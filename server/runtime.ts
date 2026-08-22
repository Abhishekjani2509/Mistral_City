import fs from "node:fs/promises";
import path from "node:path";
import type { CatDispatchRequest, CatEvent } from "../contracts/cat-events";

export type CatRuntime = (
  request: CatDispatchRequest,
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

// SWE 3 integration point. Replace this assignment with an adapter around
// runRepair(request) once the real runtime is available on the branch.
export const dispatchCat: CatRuntime = replayRepair;
