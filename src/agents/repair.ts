/**
 * SWE 3: Cat Agent Runtime - Repair Cat Implementation
 * 
 * Implements runRepair(request: CatDispatchRequest): AsyncIterable<CatEvent>
 * for the deterministic auth session-persistence bug.
 */

import {
  CAT_EVENT_SCHEMA,
  CatDispatchRequest,
  CatEvent,
  DispatchedEvent,
  TravelingEvent,
  InspectingEvent,
  IssueFoundEvent,
  EditingEvent,
  TestingEvent,
  SuccessEvent,
} from "../../contracts/cat-events";

/**
 * The deterministic auth session-persistence bug repair flow.
 * 
 * This is a mock implementation that simulates the Repair Cat agent's work
 * for the specific bug where session is stored in React component state
 * (lost on refresh) instead of persistent storage.
 * 
 * In production, this would integrate with Mistral Vibe CLI to actually
 * analyze and fix the code, but for the MVP we simulate the expected behavior.
 */
export async function* runRepair(
  request: CatDispatchRequest
): AsyncIterable<CatEvent> {
  const { runId, systemId, issue } = request;
  
  // Validate we're handling a repair request
  if (request.agent !== "repair") {
    throw new Error(`runRepair can only handle repair agent, got: ${request.agent}`);
  }

  // Sequence counter - starts at 0 and increments by exactly 1
  let sequence = 0;

  // Helper to create base event with incrementing sequence
  const baseEvent = (phase: CatEvent["phase"], message: string): Omit<CatEvent, "payload"> => ({
    schema: CAT_EVENT_SCHEMA,
    runId,
    sequence: sequence++,
    emittedAt: new Date().toISOString(),
    agent: "repair",
    phase,
    systemId,
    message,
  });

  // 0. DISPATCHED - First event, stable runId
  yield {
    ...baseEvent("DISPATCHED", "Repair Cat dispatched to Authentication."),
    payload: { issue },
  } as DispatchedEvent;

  // 1. TRAVELING - Cat moves from hut to building
  yield {
    ...baseEvent("TRAVELING", "Repair Cat is traveling to Authentication."),
    payload: { from: "repair-hut", to: systemId },
  } as TravelingEvent;

  // 2. INSPECTING - Cat examines the relevant files
  yield {
    ...baseEvent("INSPECTING", "Inspecting the session flow and its failing test."),
    payload: {
      files: issue.files,
      commands: ["npm test -- session.test.ts"],
    },
  } as InspectingEvent;

  // 3. ISSUE_FOUND - Cat identifies the root cause
  yield {
    ...baseEvent("ISSUE_FOUND", "The session is stored only in component state, so refresh clears it."),
    payload: {
      issue: {
        id: issue.id,
        type: issue.type,
        summary: "Session is not persisted",
        description: "The session is held in transient component state instead of the configured session store.",
        files: ["src/auth/session.ts", "src/auth/Login.tsx"],
        reproduction: issue.reproduction,
      },
      confidence: 0.98,
    },
  } as IssueFoundEvent;

  // 4. EDITING - Cat applies the fix
  yield {
    ...baseEvent("EDITING", "Updating session persistence."),
    payload: {
      changedFiles: ["src/auth/session.ts", "src/auth/Login.tsx"],
      diffSummary: "Persist the authenticated session and restore it on application startup.",
    },
  } as EditingEvent;

  // 5. TESTING - First attempt (running)
  yield {
    ...baseEvent("TESTING", "Running authentication tests."),
    payload: {
      command: "npm test -- session.test.ts",
      status: "running",
    },
  } as TestingEvent;

  // Simulate test execution delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // 6. TESTING - Results (passed)
  yield {
    ...baseEvent("TESTING", "Authentication tests passed."),
    payload: {
      command: "npm test -- session.test.ts",
      status: "passed",
      passed: 3,
      failed: 0,
      attempt: 1,
    },
  } as TestingEvent;

  // 7. SUCCESS - Terminal event (only emitted after tests pass)
  yield {
    ...baseEvent("SUCCESS", "Repair Cat fixed session persistence and verified the authentication flow."),
    payload: {
      summary: "Session now survives a page refresh.",
      changedFiles: ["src/auth/session.ts", "src/auth/Login.tsx"],
      verification: {
        commands: ["npm test -- session.test.ts"],
        testsPassed: 3,
        testsFailed: 0,
      },
    },
  } as SuccessEvent;
}
