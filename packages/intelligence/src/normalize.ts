import { basename, extname } from "node:path";
import type { AnalysisModel, CityConnection, CityIssue, CityModel, CitySystem, ConnectionKind, Finding, HealthSignal, RepoSnapshot, SystemKind, SystemModel } from "./schema.js";

/** Converts private analysis detail into the stable renderer-facing CityModel. */
export function normalizeCityModel(snapshot: RepoSnapshot, analysis: AnalysisModel): CityModel {
  const systems = analysis.systems.map((system) => normalizeSystem(system, snapshot));
  const byId = new Map(systems.map((system) => [system.id, system]));
  const connections = analysis.systems.flatMap((system) => system.connections
    .filter((to) => byId.has(to))
    .map((to) => normalizeConnection(system, byId.get(to)!)));
  return validateCityModel({
    schema: "mistral.city-model/v1",
    repository: {
      name: snapshot.repoName,
      detectedStack: detectStack(snapshot),
      analyzedAt: snapshot.analyzedAt ?? new Date().toISOString(),
    },
    city: { health: analysis.city.health, status: cityStatus(systems, analysis.city.health) },
    systems,
    connections: connections.sort((a, b) => a.id.localeCompare(b.id)),
  });
}

/** Private bridge metadata used to connect normalized issues back to verified evidence. */
export function analysisIssueSources(analysis: AnalysisModel): Array<{
  issueId: string;
  systemId: string;
  file: string;
  line: number;
}> {
  return analysis.systems.flatMap((system) => system.issues.map((finding) => ({
    issueId: issueIdForFinding(system, finding),
    systemId: system.id,
    file: finding.file,
    line: finding.line,
  })));
}

/** Runtime guard for the shared SWE 2 → SWE 1 JSON contract. */
export function validateCityModel(model: CityModel): CityModel {
  assertExactKeys(model, ["schema", "repository", "city", "systems", "connections"], "CityModel");
  if (model.schema !== "mistral.city-model/v1") throw new Error("Unsupported CityModel schema");
  assertExactKeys(model.repository, ["name", "detectedStack", "analyzedAt"], "repository");
  assertExactKeys(model.city, ["health", "status"], "city");
  if (!model.repository.name || Number.isNaN(Date.parse(model.repository.analyzedAt))) throw new Error("CityModel repository metadata is invalid");
  if (!Array.isArray(model.repository.detectedStack) || model.repository.detectedStack.some((item) => typeof item !== "string")) throw new Error("CityModel detectedStack is invalid");
  if (!isStatus(model.city.status) || !validScore(model.city.health, 100)) throw new Error("CityModel city health is invalid");
  const ids = new Set<string>();
  for (const system of model.systems) {
    assertExactKeys(system, ["id", "name", "kind", "description", "files", "entrypoints", "health", "status", "healthSignals", "issues", "confidence"], `system ${system.id}`);
    if (!/^[a-z][a-z0-9-]*$/.test(system.id) || ids.has(system.id)) throw new Error(`Invalid or duplicate system id: ${system.id}`);
    ids.add(system.id);
    if (!system.name || !system.description || !isSystemKind(system.kind) || !isStatus(system.status) || !validScore(system.health, 100) || !validScore(system.confidence, 1)) throw new Error(`Invalid system: ${system.id}`);
    if (system.files.some((file) => !isRelativePath(file))) throw new Error(`System ${system.id} includes a non-relative file path`);
    if (system.entrypoints?.some((file) => !isRelativePath(file))) throw new Error(`System ${system.id} includes a non-relative entrypoint`);
    for (const signal of system.healthSignals) {
      assertExactKeys(signal, ["kind", "label", "severity", "evidence"], `health signal in ${system.id}`);
      if (!HEALTH_SIGNAL_KINDS.has(signal.kind) || !HEALTH_SIGNAL_SEVERITIES.has(signal.severity) || !signal.label || signal.evidence.some((file) => !isRelativePath(file))) throw new Error(`System ${system.id} includes an invalid health signal`);
    }
    for (const issue of system.issues) {
      assertExactKeys(issue, ["id", "type", "summary", "description", "files", "reproduction"], `issue ${issue.id}`);
      if (!CITY_ISSUE_TYPES.has(issue.type) || !issue.id || !issue.summary || !issue.description) throw new Error(`System ${system.id} includes an invalid issue`);
    }
    if (system.issues.some((issue) => issue.files.some((file) => !isRelativePath(file)))) throw new Error(`System ${system.id} includes an issue with a non-relative file path`);
  }
  const connectionIds = new Set<string>();
  for (const connection of model.connections) {
    assertExactKeys(connection, ["id", "from", "to", "kind", "label", "evidence", "confidence"], `connection ${connection.id}`);
    if (connectionIds.has(connection.id)) throw new Error(`Duplicate connection id: ${connection.id}`);
    connectionIds.add(connection.id);
    if (!ids.has(connection.from) || !ids.has(connection.to)) throw new Error(`Connection ${connection.id} has an unknown endpoint`);
    if (!CONNECTION_KINDS.has(connection.kind) || !validScore(connection.confidence, 1)) throw new Error(`Connection ${connection.id} is invalid`);
    if (connection.evidence.some((file) => !isRelativePath(file))) throw new Error(`Connection ${connection.id} includes a non-relative evidence path`);
  }
  return model;
}

function normalizeSystem(system: SystemModel, snapshot: RepoSnapshot): CitySystem {
  const issues = system.issues.map((issue) => normalizeIssue(system, issue, snapshot));
  const signals: HealthSignal[] = issues.map((issue, index) => {
    const finding = system.issues[index]!;
    const securityProbe = finding.type === "security_probe";
    return {
      kind: issue.type === "unknown" ? "runtime_error" : issue.type,
      label: issue.summary,
      severity: issue.type === "failing_test" || issue.type === "build_error" || (securityProbe && finding.severity === "critical") ? "error" as const : "warning" as const,
      evidence: issue.files,
    };
  });
  if (system.discoveryConfidence < 0.55 || !system.deeplyAnalyzed) {
    signals.push({ kind: "low_confidence", label: "This area still needs a deeper review.", severity: "warning", evidence: [] });
  }
  const entrypoints = system.files.filter((file) => /(?:^|\/)(?:app|main|index|server|route|page)\.[^.]+$/i.test(file));
  return {
    id: system.id,
    name: system.name,
    kind: inferSystemKind(system),
    description: system.plainDescription,
    files: [...system.files].sort(),
    ...(entrypoints.length ? { entrypoints } : {}),
    health: system.health,
    status: system.status,
    healthSignals: signals,
    issues,
    confidence: system.discoveryConfidence,
  };
}

function normalizeIssue(system: SystemModel, finding: Finding, snapshot: RepoSnapshot): CityIssue {
  const type = issueType(finding);
  const failing = snapshot.hardSignals?.[system.id]?.failingTests?.find((test) => test.file === finding.file && test.line === finding.line);
  const securityProbe = finding.type === "security_probe";
  return {
    id: issueIdForFinding(system, finding),
    type,
    summary: securityProbe ? sentence(finding.technicalDescription.replace(/^WSTG-[A-Z]+-\d+:\s*/i, "")) : sentence(finding.plainDescription),
    description: finding.plainDescription,
    files: [...new Set([finding.file, ...(failing?.file ? [failing.file] : [])])],
    ...(failing ? { reproduction: `Run the focused test: ${failing.name}.` } : {}),
  };
}

function issueIdForFinding(system: SystemModel, finding: Finding): string {
  return finding.type === "security_probe"
    ? finding.id
    : stableIssueId(system.id, issueType(finding), finding.file, finding.line);
}

function issueType(finding: Finding): CityIssue["type"] {
  return /(?:fail|test)/i.test(finding.type)
    ? "failing_test"
    : /build/i.test(finding.type)
      ? "build_error"
      : /runtime|error/i.test(finding.type)
        ? "runtime_error"
        : "unknown";
}

function normalizeConnection(from: SystemModel, to: CitySystem): CityConnection {
  const kind = connectionKind(inferSystemKind(from), to.kind);
  return {
    id: `${from.id}-${to.id}`,
    from: from.id,
    to: to.id,
    kind,
    evidence: from.files.slice(0, 2),
    confidence: Math.min(from.discoveryConfidence, to.confidence),
  };
}

export function inferSystemKind(system: Pick<SystemModel, "buildingType" | "name" | "files">): SystemKind {
  const words = `${system.name} ${system.files.join(" ")}`.toLowerCase();
  if (/auth|login|session/.test(words)) return "auth";
  if (/database|\bdb\b|schema|migration/.test(words)) return "database";
  if (/test|spec/.test(words)) return "tests";
  if (/readme|docs|documentation/.test(words)) return "documentation";
  if (/external|notification|payment|port/.test(words)) return "external";
  if (/api|route|server/.test(words)) return "api";
  if (/\.tsx\b|frontend|client|dashboard/.test(words)) return "frontend";
  if (system.buildingType === "district" || system.buildingType === "workshop" || system.buildingType === "tower") return "backend";
  return "unknown";
}

function connectionKind(from: SystemKind, to: SystemKind): ConnectionKind {
  if (from === "tests") return "tests";
  if (to === "auth") return "authenticates";
  if (to === "database") return from === "auth" || from === "api" ? "writes" : "reads";
  if (to === "external") return "calls";
  return "depends_on";
}

function cityStatus(systems: CitySystem[], health: number): CitySystem["status"] {
  if (systems.length === 0 || systems.every((system) => system.status === "unknown")) return "unknown";
  const known = systems.filter((system) => system.status !== "unknown");
  const totalFiles = known.reduce((sum, system) => sum + Math.max(1, system.files.length), 0);
  const brokenFiles = known.filter((system) => system.status === "broken").reduce((sum, system) => sum + Math.max(1, system.files.length), 0);
  if (health < 50 || brokenFiles / Math.max(1, totalFiles) >= 0.5) return "broken";
  if (health < 85 || systems.some((system) => system.status !== "healthy")) return "warning";
  return "healthy";
}

function detectStack(snapshot: RepoSnapshot): string[] {
  const content = snapshot.files.map((file) => file.content).join("\n");
  const extensions = new Set(snapshot.files.map((file) => extname(file.path)));
  const stack: string[] = [];
  if (extensions.has(".ts") || extensions.has(".tsx")) stack.push("TypeScript");
  if (/\b(?:react|next)\b/i.test(content) || extensions.has(".tsx")) stack.push("React");
  if (/\b(?:node|express|fastify|nestjs)\b/i.test(content)) stack.push("Node");
  if (/\bpostgres(?:ql)?\b|\bpg\b/i.test(content)) stack.push("Postgres");
  if (/\bsqlite\b/i.test(content)) stack.push("SQLite");
  return stack;
}

function stableIssueId(systemId: string, type: string, file: string, line: number): string {
  return `${systemId}-${type}-${basename(file, extname(file)).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${line}`;
}

function sentence(value: string): string { return value.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, ""); }
function isRelativePath(path: string): boolean { return Boolean(path) && !path.startsWith("/") && !path.startsWith("../") && !/^[A-Za-z]:[\\/]/.test(path); }
function validScore(value: number, maximum: number): boolean { return Number.isFinite(value) && value >= 0 && value <= maximum; }
function isStatus(value: string): value is CitySystem["status"] { return STATUS_VALUES.has(value as CitySystem["status"]); }
function isSystemKind(value: string): value is SystemKind { return SYSTEM_KINDS.has(value as SystemKind); }
function assertExactKeys(value: object, allowed: readonly string[], label: string): void {
  const allowedKeys = new Set(allowed);
  const extras = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (extras.length) throw new Error(`${label} contains unsupported fields: ${extras.join(", ")}`);
}

const STATUS_VALUES = new Set<CitySystem["status"]>(["healthy", "warning", "broken", "unknown"]);
const SYSTEM_KINDS = new Set<SystemKind>(["frontend", "backend", "auth", "api", "database", "external", "tests", "documentation", "unknown"]);
const CONNECTION_KINDS = new Set(["calls", "reads", "writes", "authenticates", "tests", "depends_on"]);
const HEALTH_SIGNAL_KINDS = new Set(["failing_test", "runtime_error", "build_error", "missing_test", "low_confidence"]);
const HEALTH_SIGNAL_SEVERITIES = new Set(["info", "warning", "error"]);
const CITY_ISSUE_TYPES = new Set(["failing_test", "runtime_error", "build_error", "unknown"]);
