/**
 * Golden path reliability harness.
 *
 *   npm run repair:golden          # 10 runs
 *   npm run repair:golden -- 3     # 3 runs
 *
 * Each iteration resets the demo repo to its buggy state, runs the Repair
 * Cat for real, records the stream, and validates it with the same
 * validator used in CI. Reports how many runs a judge would see succeed.
 *
 * Every run costs a Mistral API call. Results are written incrementally so
 * a partial run is still useful if it is interrupted.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

import { runRepair } from "./repair";
import { resetRepo } from "./repo";
import { run } from "./exec";
import { CatDispatchRequest, CatEvent, isTerminalCatEvent } from "../../contracts/cat-events";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoPath = path.join(projectRoot, "demo-repo");
const outDir = path.join(projectRoot, ".golden");

interface RunRecord {
  run: number;
  terminal: string;
  seconds: number;
  attempts: number;
  changedFiles: string[];
  schemaValid: boolean;
  failureCode?: string;
}

function buildRequest(index: number): CatDispatchRequest {
  return {
    schema: "mistral.city.cat-dispatch/v1",
    runId: `golden-${Date.now()}-${index}`,
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
}

async function validateStream(file: string): Promise<boolean> {
  const result = await run("npx", ["tsx", "src/agents/repair.test.ts", file], {
    cwd: projectRoot,
    timeoutMs: 120_000,
  });
  return result.code === 0;
}

async function main() {
  const total = Number(process.argv[2] ?? 10);
  fs.mkdirSync(outDir, { recursive: true });

  const records: RunRecord[] = [];
  console.log(`Golden path: ${total} live runs against ${path.relative(projectRoot, repoPath)}\n`);

  for (let i = 1; i <= total; i++) {
    await resetRepo(repoPath);

    const started = Date.now();
    const events: CatEvent[] = [];
    let terminal = "NONE";
    let failureCode: string | undefined;
    let changed: string[] = [];
    let attempts = 0;

    try {
      for await (const event of runRepair(buildRequest(i), { repoPath })) {
        events.push(event);
        if (typeof event.attempt === "number") attempts = Math.max(attempts, event.attempt);
        if (event.phase === "SUCCESS") changed = event.payload.changedFiles;
        if (isTerminalCatEvent(event)) {
          terminal = event.phase;
          if (event.phase === "FAILED") failureCode = event.payload.code;
        }
      }
    } catch (error) {
      terminal = "CRASH";
      failureCode = (error as Error).message.slice(0, 200);
    }

    const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
    const file = path.join(outDir, `run-${String(i).padStart(2, "0")}.ndjson`);
    fs.writeFileSync(file, events.map((event) => JSON.stringify(event)).join("\n") + "\n");
    const schemaValid = events.length > 0 ? await validateStream(file) : false;

    const record: RunRecord = {
      run: i,
      terminal,
      seconds,
      attempts,
      changedFiles: changed,
      schemaValid,
      ...(failureCode ? { failureCode } : {}),
    };
    records.push(record);
    fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(records, null, 2));

    const mark = terminal === "SUCCESS" && schemaValid ? "PASS" : "FAIL";
    console.log(
      `[${mark}] run ${i}/${total}  ${terminal}  ${seconds}s  attempts=${attempts}  ` +
        `schema=${schemaValid ? "ok" : "INVALID"}  ${failureCode ? `(${failureCode})` : ""}`
    );
  }

  await resetRepo(repoPath);

  const passes = records.filter((r) => r.terminal === "SUCCESS" && r.schemaValid);
  const times = records.map((r) => r.seconds).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;

  console.log(`\n${"=".repeat(56)}`);
  console.log(`Golden path: ${passes.length}/${records.length} runs succeeded and validated`);
  console.log(`Duration: min ${times[0]}s  median ${median}s  max ${times[times.length - 1]}s`);

  const failures = records.filter((r) => !(r.terminal === "SUCCESS" && r.schemaValid));
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach((f) =>
      console.log(`  run ${f.run}: ${f.terminal} ${f.failureCode ?? ""} schema=${f.schemaValid}`)
    );
  }
  console.log("=".repeat(56));

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("golden path crashed:", error);
  process.exit(1);
});
