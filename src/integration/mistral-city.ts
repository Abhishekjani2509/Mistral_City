import type { CatDispatchRequest, CatEvent, CityIssue } from "../../contracts/cat-events";
import type { CityModel, CitySystem, HealthStatus, SystemKind } from "../../contracts/city-model";
import type { IssueSourceLink } from "../../contracts/issue-sources";
import type { RepositoryEvent } from "../api/repository";

// The designer renderer intentionally owns its visual schema. This adapter is the
// boundary between that schema and the canonical contracts used by SWE 2/SWE 3.
// Layout coordinates stay renderer-owned: omitted coordinates auto-place systems.
export type RendererKind =
  | "tower"
  | "gate"
  | "workshop"
  | "vault"
  | "district"
  | "house"
  | "watch"
  | "library"
  | "port";

export type RendererIssue = CityIssue & {
  t: string;
  d: string;
  w?: boolean;
  source?: IssueSourceLink;
};

export type RendererSystem = {
  id: string;
  name: string;
  kind: RendererKind;
  health: number;
  status: HealthStatus;
  blurb: string;
  files: string[];
  connections: string[];
  issues: RendererIssue[];
};

export type RendererModel = {
  repo: {
    name: string;
    tests: { pass: number; total: number };
  };
  city: {
    health: number;
    security: { passed: string[]; score?: number };
  };
  systems: RendererSystem[];
};

export type RendererDispatch = {
  agent: CatDispatchRequest["agent"];
  systemId: string;
  issue?: RendererIssue;
  files: string[];
  connections: string[];
};

export type RendererEvent =
  | { type: "agent.start"; agent: CatDispatchRequest["agent"]; target: string }
  | { type: "agent.log"; level?: "code" | "bad" | "good" | "sys" | ""; text: string }
  | { type: "agent.edit"; file: string }
  | { type: "agent.test"; suite: string; pass?: number; fail?: number }
  | {
      type: "agent.done";
      target: string;
      health: number;
      status: HealthStatus;
      summary: string;
      detail: string;
      files: string[];
    };

const kindMap: Record<SystemKind, RendererKind> = {
  frontend: "district",
  backend: "workshop",
  auth: "gate",
  api: "workshop",
  database: "vault",
  external: "port",
  tests: "watch",
  documentation: "library",
  unknown: "house",
};

function issueForRenderer(issue: CityIssue, source?: IssueSourceLink): RendererIssue {
  return {
    ...issue,
    t: issue.summary,
    d: issue.description,
    w: issue.type !== "failing_test",
    ...(source ? { source } : {}),
  };
}

function issueFromDispatch(dispatch: RendererDispatch): CityIssue {
  if (dispatch.issue) {
    return {
      id: dispatch.issue.id,
      type: dispatch.issue.type,
      summary: dispatch.issue.summary || dispatch.issue.t,
      description: dispatch.issue.description || dispatch.issue.d,
      files: dispatch.issue.files,
      reproduction: dispatch.issue.reproduction,
    };
  }

  return {
    id: `${dispatch.systemId}-issue`,
    type: "unknown",
    summary: `Investigate ${dispatch.systemId}`,
    description: `No structured issue was provided for ${dispatch.systemId}.`,
    files: dispatch.files,
  };
}

function testsFor(city: CityModel): { pass: number; total: number } {
  // The current canonical CityModel carries system health, not repository test
  // counts. Keep the renderer demo honest until SWE 2 publishes repo.test data.
  const testSystem = city.systems.find((system) => system.kind === "tests");
  if (!testSystem || testSystem.status === "unknown") return { pass: 0, total: 0 };
  const total = 19;
  const pass = Math.max(0, Math.min(total, Math.round((testSystem.health / 100) * total)));
  return { pass, total };
}

export function toRendererModel(
  city: CityModel,
  issueSources: readonly IssueSourceLink[] = [],
): RendererModel {
  const knownIds = new Set(city.systems.map((system) => system.id));
  const sourcesByIssue = new Map(issueSources.map((source) => [`${source.systemId}\0${source.issueId}`, source]));
  const existingTower = city.systems.find((system) => system.id === "tower");
  const systems: RendererSystem[] = city.systems.map((system) => ({
    id: system.id,
    name: system.name,
    kind: kindMap[system.kind],
    health: system.health,
    status: system.status,
    blurb: system.description,
    files: system.files,
    connections: city.connections
      .filter((connection) => connection.from === system.id || connection.to === system.id)
      .map((connection) => (connection.from === system.id ? connection.to : connection.from))
      .filter((id, index, ids) => knownIds.has(id) && ids.indexOf(id) === index),
    issues: system.issues.map((issue) => issueForRenderer(issue, sourcesByIssue.get(`${system.id}\0${issue.id}`))),
  }));

  if (!existingTower) {
    systems.unshift({
      id: "tower",
      name: "Town Hall",
      kind: "tower",
      health: 100,
      status: "healthy",
      blurb: `The ${city.repository.name} repository and its overall health.`,
      files: [],
      connections: city.systems.map((system) => system.id),
      issues: [],
    });
  }

  return {
    repo: {
      name: city.repository.name,
      tests: testsFor(city),
    },
    city: {
      health: city.city.health,
      /* The renderer drives the whole board from this. A continuous 0..100
         score lets the town sit genuinely between two eras; the checklist is
         the fallback and can only ever produce five states.

         CityModel v1 carries no security data yet, so this reads defensively
         and the town stays at its current era until the contract gains a
         `city.security.score`. The ask is one number: see mistral-city/README.md. */
      security: readSecurity(city),
    },
    systems,
  };
}

/** Reads a security score off the model if the scan produced one. */
function readSecurity(city: CityModel): { score?: number; passed: string[] } {
  const raw = (city.city as { security?: { score?: number; passed?: string[] } }).security;
  if (raw && typeof raw.score === "number" && Number.isFinite(raw.score)) {
    return { score: Math.max(0, Math.min(100, raw.score)), passed: raw.passed ?? [] };
  }
  if (raw && Array.isArray(raw.passed)) return { passed: raw.passed };
  return { passed: [] };
}

export function emptyCityModel(repositoryName: string): CityModel {
  return {
    schema: "mistral.city-model/v1",
    repository: {
      name: repositoryName || "GitHub repository",
      detectedStack: [],
      analyzedAt: new Date().toISOString(),
    },
    city: { health: 0, status: "unknown" },
    systems: [],
    connections: [],
  };
}

export function applyRepositoryEvent(model: CityModel, event: RepositoryEvent): CityModel {
  switch (event.type) {
    case "repository.started":
      return emptyCityModel(repositoryNameFromUrl(event.data.url));
    case "system.discovered": {
      const existing = model.systems.find((system) => system.id === event.data.id);
      const system: CitySystem = existing
        ? { ...existing, name: event.data.name, kind: event.data.kind, description: event.data.description, confidence: event.data.confidence }
        : {
            id: event.data.id,
            name: event.data.name,
            kind: event.data.kind,
            description: event.data.description,
            files: [],
            health: 0,
            status: "unknown",
            healthSignals: [],
            issues: [],
            confidence: event.data.confidence,
          };
      return { ...model, systems: [...model.systems.filter((candidate) => candidate.id !== system.id), system] };
    }
    case "system.connected": {
      const id = `${event.data.from}-${event.data.to}`;
      if (model.connections.some((connection) => connection.id === id)) return model;
      return {
        ...model,
        connections: [
          ...model.connections,
          {
            id,
            from: event.data.from,
            to: event.data.to,
            kind: "depends_on",
            evidence: [],
            confidence: 0.5,
          },
        ],
      };
    }
    case "system.graded":
      return {
        ...model,
        systems: model.systems.map((system) => system.id === event.data.id
          ? { ...system, health: event.data.health, status: event.data.status }
          : system),
      };
    case "city.health":
      return { ...model, city: { ...model.city, health: event.data.value, status: statusForHealth(event.data.value) } };
    case "analysis.complete":
      return { ...model, city: { ...model.city, health: event.data.cityHealth, status: statusForHealth(event.data.cityHealth) } };
    case "city.model":
      return event.data;
    case "repository.cloned":
    case "analysis.started":
    case "analysis.session":
    case "analysis.sources":
    case "repository.failed":
      return model;
  }
}

function statusForHealth(health: number): HealthStatus {
  if (health <= 0) return "unknown";
  if (health < 50) return "broken";
  if (health < 85) return "warning";
  return "healthy";
}

function repositoryNameFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return (parts[1] ?? parts[0] ?? "GitHub repository").replace(/\.git$/, "");
  } catch {
    return "GitHub repository";
  }
}

export function toRendererEvent(event: CatEvent, model: RendererModel): RendererEvent {
  switch (event.phase) {
    case "DISPATCHED":
      return { type: "agent.start", agent: event.agent, target: event.systemId };
    case "TRAVELING":
      return { type: "agent.log", level: "sys", text: event.message };
    case "INSPECTING":
      return { type: "agent.log", level: "code", text: event.message };
    case "ISSUE_FOUND":
      return { type: "agent.log", level: "bad", text: event.message };
    case "EDITING":
      return event.payload.changedFiles[0]
        ? { type: "agent.edit", file: event.payload.changedFiles[0] }
        : { type: "agent.log", level: "code", text: event.message };
    case "TESTING":
      return event.payload.status === "running"
        ? { type: "agent.log", level: "code", text: event.message }
        : {
            type: "agent.test",
            suite: event.payload.command,
            pass: event.payload.passed,
            fail: event.payload.failed,
          };
    case "SUCCESS": {
      const system = model.systems.find((candidate) => candidate.id === event.systemId);
      const before = system?.health ?? 64;
      return {
        type: "agent.done",
        target: event.systemId,
        health: Math.max(before, Math.min(99, before + 30)),
        status: "healthy",
        summary: event.payload.summary,
        detail: event.message,
        files: event.payload.changedFiles,
      };
    }
    case "FAILED": {
      const system = model.systems.find((candidate) => candidate.id === event.systemId);
      return {
        type: "agent.done",
        target: event.systemId,
        health: system?.health ?? 0,
        status: "broken",
        summary: event.payload.summary,
        detail: event.message,
        files: [],
      };
    }
  }
}

export function dispatchFromRenderer(dispatch: RendererDispatch): CatDispatchRequest {
  return {
    schema: "mistral.city.cat-dispatch/v1",
    runId: `${dispatch.agent}-${dispatch.systemId}-${Date.now()}`,
    agent: dispatch.agent,
    systemId: dispatch.systemId,
    issue: issueFromDispatch(dispatch),
    context: {
      relevantFiles: dispatch.files,
      relatedSystemIds: dispatch.connections,
    },
  };
}
