/**
 * Contract validation for the Repair Cat event stream.
 *
 *   npm run validate                      # validates the golden fixture
 *   npm run validate -- .last-run.ndjson  # validates a recorded live run
 *
 * This validates against contracts/cat-events.schema.json itself, including
 * `additionalProperties: false` on every payload. The previous version only
 * checked that keys existed, which is why a misplaced `attempt` field inside
 * the TESTING payload passed as green.
 *
 * Deliberately does not invoke runRepair: a live run costs an API call and
 * mutates the demo repo, so recording and validating are separate steps.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
// The contract schemas declare draft 2020-12, which needs ajv's 2020 build;
// the default export only understands draft-07.
import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv";
import addFormats from "ajv-formats";

import { CatEvent, isTerminalCatEvent } from "../../contracts/cat-events";

const contractsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../contracts");
const eventSchema = JSON.parse(
  fs.readFileSync(path.join(contractsDir, "cat-events.schema.json"), "utf-8")
);

const target = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(contractsDir, "repair-run.example.ndjson");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const compiled = ajv.compile(eventSchema);
// Wrapped as a plain predicate: ajv types compile() as a type guard, which
// would narrow a CatEvent to `never` inside the failure branch.
const isSchemaValid = (data: unknown): boolean => compiled(data) as boolean;

const problems: string[] = [];
const fail = (message: string) => problems.push(message);

const describe = (errors: ErrorObject[] | null | undefined): string =>
  (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");

function main() {
  if (!fs.existsSync(target)) {
    console.error(`✖ No event stream at ${target}`);
    console.error("  Record one with: npm run repair:live");
    process.exit(1);
  }

  const events: CatEvent[] = fs
    .readFileSync(target, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Line ${index + 1} of ${target} is not valid JSON`);
      }
    });

  console.log(`Validating ${events.length} events from ${path.relative(process.cwd(), target)}\n`);

  if (events.length === 0) fail("Stream is empty");

  // 1. Every event must satisfy the published JSON Schema.
  events.forEach((event, index) => {
    if (!isSchemaValid(event)) {
      fail(`Event ${index} (${event.phase}) violates cat-events.schema.json: ${describe(compiled.errors)}`);
    }
  });

  // 2. sequence starts at 0 and increments by exactly 1 (contract rule 2).
  events.forEach((event, index) => {
    if (event.sequence !== index) {
      fail(`Event at index ${index} has sequence ${event.sequence}, expected ${index}`);
    }
  });

  // 3. runId is stable for the whole run (contract rule 1).
  const runIds = new Set(events.map((event) => event.runId));
  if (runIds.size > 1) {
    fail(`runId is not stable: ${[...runIds].join(", ")}`);
  }

  // 4. DISPATCHED is first (contract rule 1).
  if (events[0] && events[0].phase !== "DISPATCHED") {
    fail(`First event is ${events[0].phase}, expected DISPATCHED`);
  }

  // 5. Exactly one terminal event, and it is last (contract rule 4).
  const terminals = events.filter(isTerminalCatEvent);
  if (terminals.length !== 1) {
    fail(`Expected exactly 1 terminal event, found ${terminals.length}`);
  } else if (!isTerminalCatEvent(events[events.length - 1])) {
    fail("Terminal event is not the last event in the stream");
  }

  // 6. SUCCESS only after a passing verification (contract rule 5).
  const success = events.find((event) => event.phase === "SUCCESS");
  if (success) {
    const passingTest = events.some(
      (event) => event.phase === "TESTING" && event.payload.status === "passed"
    );
    if (!passingTest) {
      fail("SUCCESS emitted without a TESTING event reporting status 'passed'");
    }
    if (success.payload.changedFiles.length === 0) {
      fail("SUCCESS reports no changed files");
    }
  }

  // 7. Paths stay repository-relative (contract rule 6).
  const suspectPath = (file: string) => path.isAbsolute(file) || file.startsWith("../");
  events.forEach((event, index) => {
    const payload = event.payload as Record<string, unknown>;
    for (const key of ["files", "changedFiles"]) {
      const value = payload?.[key];
      if (Array.isArray(value)) {
        value.filter((file): file is string => typeof file === "string")
          .filter(suspectPath)
          .forEach((file) => fail(`Event ${index} has non-repository-relative path: ${file}`));
      }
    }
  });

  if (problems.length > 0) {
    console.error("✖ Contract violations:\n");
    problems.forEach((problem) => console.error(`  - ${problem}`));
    console.error(`\n${problems.length} violation(s).`);
    process.exit(1);
  }

  const phases = events.map((event) => event.phase).join(" → ");
  console.log("✓ Schema valid for every event");
  console.log("✓ sequence 0.. with no gaps, stable runId");
  console.log("✓ DISPATCHED first, exactly one terminal event last");
  console.log("✓ SUCCESS backed by a passing verification");
  console.log("✓ All paths repository-relative\n");
  console.log(`Phases: ${phases}`);
  console.log(`Result: ${events[events.length - 1]?.phase}`);
}

try {
  main();
} catch (error) {
  console.error("✖ Validation crashed:", (error as Error).message);
  process.exit(1);
}
