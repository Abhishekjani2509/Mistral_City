/**
 * Repair a repository and submit the result as a pull request.
 *
 *   npx tsx src/agents/submit-repair.ts <repoPath> [--system <id>]
 *
 * Point this at a CLONE, never at a working checkout: the submission step
 * creates a branch and commits, which would hijack the repository you are
 * sitting in. The city always clones what it analyzes, so this matches how
 * the product behaves.
 *
 * A pull request is opened only if the verification command passes.
 */

import path from "path";
import { runRepair } from "./repair";
import { CatDispatchRequest, isTerminalCatEvent } from "../../contracts/cat-events";

const repoPath = process.argv[2];
if (!repoPath) {
  console.error("usage: tsx src/agents/submit-repair.ts <repoPath> [--system <id>]");
  process.exit(1);
}

const systemFlag = process.argv.indexOf("--system");
const systemId = systemFlag > -1 ? process.argv[systemFlag + 1] : "auth";

const request: CatDispatchRequest = {
  schema: "mistral.city.cat-dispatch/v1",
  runId: `submit-${Date.now()}`,
  agent: "repair",
  systemId,
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
  const target = path.resolve(repoPath);
  console.log(`Repairing ${target}\n`);

  let terminal: string | null = null;

  for await (const event of runRepair(request, { repoPath: target, openPr: true })) {
    const detail =
      event.phase === "SUCCESS"
        ? event.payload.summary
        : event.phase === "FAILED"
          ? `${event.payload.code}: ${event.payload.summary}`
          : "";
    console.log(`${event.phase.padEnd(13)} ${detail}`);
    if (isTerminalCatEvent(event)) terminal = event.phase;
  }

  process.exit(terminal === "SUCCESS" ? 0 : 1);
}

main().catch((error) => {
  console.error("submit-repair crashed:", error);
  process.exit(1);
});
