/**
 * SWE 3: Cat Agent Runtime - Repair Cat
 *
 * runRepair(request) drives a real Mistral Vibe agent against a real
 * repository and reports what actually happened:
 *
 *   reproduce the failure -> let Vibe edit -> observe the diff -> verify
 *
 * Nothing in the event stream is asserted ahead of time. `changedFiles`
 * comes from git, test counts come from the runner, and SUCCESS is emitted
 * only after the verification command exits 0.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";

import {
  CAT_EVENT_SCHEMA,
  CatDispatchRequest,
  CatEvent,
  CatPhase,
  DispatchedEvent,
  TravelingEvent,
  InspectingEvent,
  IssueFoundEvent,
  EditingEvent,
  TestingEvent,
  SuccessEvent,
  FailedEvent,
} from "../../contracts/cat-events";
import { changedFiles, runTests } from "./repo";
import { runVibeRepair } from "./vibe";

export interface RepairOptions {
  /**
   * Repository the cat operates on. Defaults to the bundled demo repo.
   *
   * This is an option rather than a request field on purpose: the dispatch
   * schema is frozen (`additionalProperties: false`), so the city shell can
   * keep calling runRepair(request) unchanged.
   */
  repoPath?: string;
  /** Verification command, as npm arguments. */
  testArgs?: string[];
  /** Verification attempts before giving up. */
  maxAttempts?: number;
  vibeTimeoutMs?: number;
}

const DEFAULT_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../demo-repo");

export async function* runRepair(
  request: CatDispatchRequest,
  options: RepairOptions = {}
): AsyncIterable<CatEvent> {
  const { runId, systemId, issue } = request;

  if (request.agent !== "repair") {
    throw new Error(`runRepair can only handle repair agent, got: ${request.agent}`);
  }

  const repoPath = options.repoPath ?? DEFAULT_REPO;
  const testArgs = options.testArgs ?? ["test"];
  const maxAttempts = options.maxAttempts ?? 2;
  const verifyCommand = `npm ${testArgs.join(" ")}`;

  let sequence = 0;
  const base = (phase: CatPhase, message: string, attempt?: number) => ({
    schema: CAT_EVENT_SCHEMA,
    runId,
    sequence: sequence++,
    emittedAt: new Date().toISOString(),
    agent: "repair" as const,
    phase,
    systemId,
    message,
    // `attempt` belongs at the top level; the TESTING payload forbids it.
    ...(attempt !== undefined ? { attempt } : {}),
  });

  const fail = (
    code: FailedEvent["payload"]["code"],
    message: string,
    summary: string,
    retryable: boolean,
    details?: string,
    attempt?: number
  ): FailedEvent =>
    ({
      ...base("FAILED", message, attempt),
      payload: { code, summary, retryable, ...(details ? { details } : {}) },
    }) as FailedEvent;

  yield {
    ...base("DISPATCHED", "Repair Cat dispatched to Authentication."),
    payload: { issue },
  } as DispatchedEvent;

  yield {
    ...base("TRAVELING", "Repair Cat is traveling to Authentication."),
    payload: { from: "repair-hut", to: systemId },
  } as TravelingEvent;

  // Report the files that are genuinely present, so the inspector never
  // shows a path the cat could not open.
  const presentFiles: string[] = [];
  for (const file of issue.files) {
    try {
      await fs.access(path.join(repoPath, file));
      presentFiles.push(file);
    } catch {
      // Missing hint files are not fatal; Vibe can still locate the code.
    }
  }

  yield {
    ...base("INSPECTING", "Inspecting the session flow and its failing test."),
    payload: {
      files: presentFiles.length > 0 ? presentFiles : issue.files,
      commands: [verifyCommand],
    },
  } as InspectingEvent;

  // Reproduce before repairing. A green suite here means the city's model of
  // this system is stale, which is a different problem from a failed repair.
  const baseline = await runTests(repoPath, testArgs);

  if (baseline.timedOut) {
    yield fail(
      "TIMEOUT",
      "The verification command did not finish.",
      `\`${verifyCommand}\` timed out before the failure could be reproduced.`,
      true,
      baseline.details
    );
    return;
  }

  // No verification command at all. Bail immediately rather than editing code
  // whose repair could never be proven - a green cat here would be a lie.
  if (baseline.missingScript) {
    yield fail(
      "ISSUE_NOT_REPRODUCED",
      "Repair Cat found no way to verify a repair here.",
      `This repository defines no \`${verifyCommand}\` script, so a fix cannot be proven.`,
      false,
      baseline.details
    );
    return;
  }

  if (baseline.ok) {
    yield fail(
      "ISSUE_NOT_REPRODUCED",
      "Repair Cat could not reproduce the reported problem.",
      `\`${verifyCommand}\` already passes, so there is nothing to repair.`,
      false,
      baseline.details
    );
    return;
  }

  yield {
    ...base(
      "ISSUE_FOUND",
      `Reproduced the failure: ${baseline.failed} test(s) failing in ${systemId}.`
    ),
    payload: {
      issue: {
        id: issue.id,
        type: issue.type,
        summary: issue.summary,
        description: issue.description,
        files: presentFiles.length > 0 ? presentFiles : issue.files,
        ...(issue.reproduction ? { reproduction: issue.reproduction } : {}),
      },
      confidence: 0.95,
    },
  } as IssueFoundEvent;

  let lastDetails = baseline.details;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const vibe = await runVibeRepair(issue, verifyCommand, {
      repoPath,
      ...(options.vibeTimeoutMs !== undefined ? { timeoutMs: options.vibeTimeoutMs } : {}),
    });

    if (vibe.timedOut) {
      yield fail(
        "TIMEOUT",
        "Repair Cat ran out of time.",
        "The Mistral agent exceeded its time budget.",
        true,
        vibe.raw.output.slice(-2000),
        attempt
      );
      return;
    }

    // Observed, not claimed: whatever Vibe actually wrote to disk.
    const edited = await changedFiles(repoPath);

    if (edited.length === 0) {
      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt) {
        yield fail(
          "EDIT_FAILED",
          "Repair Cat could not apply a fix.",
          vibe.ok
            ? "The Mistral agent finished without changing any files."
            : "The Mistral agent could not be run.",
          true,
          vibe.raw.output.slice(-2000),
          attempt
        );
        return;
      }
      continue;
    }

    yield {
      ...base("EDITING", "Updating session persistence.", attempt),
      payload: {
        changedFiles: edited,
        ...(vibe.summary ? { diffSummary: vibe.summary } : {}),
      },
    } as EditingEvent;

    yield {
      ...base("TESTING", "Running authentication tests.", attempt),
      payload: { command: verifyCommand, status: "running" },
    } as TestingEvent;

    const verification = await runTests(repoPath, testArgs);
    lastDetails = verification.details;

    yield {
      ...base(
        "TESTING",
        verification.ok ? "Authentication tests passed." : "Authentication tests still failing.",
        attempt
      ),
      payload: {
        command: verifyCommand,
        status: verification.ok ? "passed" : "failed",
        passed: verification.passed,
        failed: verification.failed,
      },
    } as TestingEvent;

    if (verification.ok) {
      yield {
        ...base(
          "SUCCESS",
          "Repair Cat fixed session persistence and verified the authentication flow.",
          attempt
        ),
        payload: {
          summary: vibe.summary || "The reported problem is resolved and the suite is green.",
          changedFiles: edited,
          verification: {
            commands: [verifyCommand],
            testsPassed: verification.passed,
            testsFailed: verification.failed,
          },
        },
      } as SuccessEvent;
      return;
    }
  }

  yield fail(
    "TESTS_FAILED",
    "Repair Cat could not verify a fix.",
    `\`${verifyCommand}\` still fails after ${maxAttempts} attempt(s).`,
    true,
    lastDetails,
    maxAttempts
  );
}
