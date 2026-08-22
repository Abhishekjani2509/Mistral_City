/**
 * Integration contract between the cat-agent runtime (SWE 3) and the city
 * shell (SWE 1).
 *
 * Transport is intentionally unspecified. These values can be sent over
 * stdout, WebSocket, HTTP streaming, or an in-process callback.
 */

export const CAT_EVENT_SCHEMA = "mistral.city.cat-event/v1" as const;
export const CAT_DISPATCH_SCHEMA = "mistral.city.cat-dispatch/v1" as const;

export type CatKind = "repair" | "scout" | "guard";

/** The only lifecycle phases the city renderer needs to understand. */
export type CatPhase =
  | "DISPATCHED"
  | "TRAVELING"
  | "INSPECTING"
  | "ISSUE_FOUND"
  | "EDITING"
  | "TESTING"
  | "SUCCESS"
  | "FAILED";

export type IssueType =
  | "failing_test"
  | "runtime_error"
  | "build_error"
  | "unknown";

export interface CityIssue {
  id: string;
  type: IssueType;
  summary: string;
  description: string;
  /** Repository-relative paths. */
  files: string[];
  reproduction?: string;
}

export interface CatDispatchRequest {
  schema: typeof CAT_DISPATCH_SCHEMA;
  runId: string;
  agent: CatKind;
  systemId: string;
  issue: CityIssue;
  /** Optional context produced by SWE 2 or the city inspector. */
  context?: {
    relatedSystemIds?: string[];
    suggestedCommands?: string[];
    relevantFiles?: string[];
  };
}

export interface CatEventBase {
  schema: typeof CAT_EVENT_SCHEMA;
  runId: string;
  /** Starts at 0 and increments by exactly 1 for each event in a run. */
  sequence: number;
  emittedAt: string;
  agent: CatKind;
  phase: CatPhase;
  systemId: string;
  /** Plain-English text suitable for the activity panel. */
  message: string;
  /** Starts at 1. Increment when the agent retries verification. */
  attempt?: number;
}

export interface DispatchedEvent extends CatEventBase {
  phase: "DISPATCHED";
  payload: {
    issue: CityIssue;
  };
}

export interface TravelingEvent extends CatEventBase {
  phase: "TRAVELING";
  payload: {
    from: string;
    to: string;
  };
}

export interface InspectingEvent extends CatEventBase {
  phase: "INSPECTING";
  payload: {
    files: string[];
    commands?: string[];
  };
}

export interface IssueFoundEvent extends CatEventBase {
  phase: "ISSUE_FOUND";
  payload: {
    issue: CityIssue;
    confidence?: number;
  };
}

export interface EditingEvent extends CatEventBase {
  phase: "EDITING";
  payload: {
    changedFiles: string[];
    diffSummary?: string;
  };
}

export interface TestingEvent extends CatEventBase {
  phase: "TESTING";
  payload: {
    command: string;
    status: "running" | "passed" | "failed";
    passed?: number;
    failed?: number;
  };
}

export interface SuccessEvent extends CatEventBase {
  phase: "SUCCESS";
  payload: {
    summary: string;
    changedFiles: string[];
    verification: {
      commands: string[];
      testsPassed?: number;
      testsFailed?: number;
    };
  };
}

export interface FailedEvent extends CatEventBase {
  phase: "FAILED";
  payload: {
    code:
      | "ISSUE_NOT_REPRODUCED"
      | "TESTS_FAILED"
      | "EDIT_FAILED"
      | "TIMEOUT"
      | "AGENT_ERROR";
    summary: string;
    retryable: boolean;
    details?: string;
  };
}

export type CatEvent =
  | DispatchedEvent
  | TravelingEvent
  | InspectingEvent
  | IssueFoundEvent
  | EditingEvent
  | TestingEvent
  | SuccessEvent
  | FailedEvent;

export type TerminalCatEvent = SuccessEvent | FailedEvent;

export function isTerminalCatEvent(event: CatEvent): event is TerminalCatEvent {
  return event.phase === "SUCCESS" || event.phase === "FAILED";
}
