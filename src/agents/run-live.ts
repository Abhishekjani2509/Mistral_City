/**
 * Live end-to-end run of the Repair Cat against the demo repo.
 *
 *   npm run repair:live
 *
 * Prints every emitted event as NDJSON, exactly what the city shell receives.
 */

import fs from "fs";
import path from "path";
import { runRepair } from "./repair";
import { resetRepo } from "./repo";
import { CatDispatchRequest, isTerminalCatEvent } from "../../contracts/cat-events";

const repoPath = path.resolve(__dirname, "../../demo-repo");

const request: CatDispatchRequest = {
  schema: "mistral.city.cat-dispatch/v1",
  runId: `repair-auth-${Date.now()}`,
  agent: "repair",
  systemId: "auth",
  issue: {
    id: "auth-session-persistence",
    type: "failing_test",
    summary: "Session does not persist after refresh",
    description:
      "A logged-in user is returned to the login screen after refreshing the page.",
    files: ["src/app/auth/session.ts", "src/app/auth/session.test.ts"],
    reproduction: "Run the authentication test suite and refresh after login.",
  },
};

async function main() {
  const shouldReset = !process.argv.includes("--no-reset");
  if (shouldReset) {
    console.error("[run-live] resetting demo repo to the buggy state...");
    await resetRepo(repoPath);
  }

  const startedAt = Date.now();
  let terminal: string | null = null;
  const lines: string[] = [];

  for await (const event of runRepair(request, { repoPath })) {
    const line = JSON.stringify(event);
    lines.push(line);
    console.log(line);
    if (isTerminalCatEvent(event)) terminal = event.phase;
  }

  // Recorded so `npm run validate -- .last-run.ndjson` can check this exact
  // run against the schema without spending another API call.
  const recordPath = path.resolve(__dirname, "../../.last-run.ndjson");
  fs.writeFileSync(recordPath, lines.join("\n") + "\n");

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.error(`[run-live] finished with ${terminal} in ${seconds}s`);
  console.error(`[run-live] recorded ${lines.length} events to .last-run.ndjson`);
  process.exit(terminal === "SUCCESS" ? 0 : 1);
}

main().catch((error) => {
  console.error("[run-live] crashed:", error);
  process.exit(1);
});
