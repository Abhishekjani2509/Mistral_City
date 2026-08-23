import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EventCollector,
  MemoryCache,
  MistralClient,
  analysisIssueSources,
  calibrateAuthenticationAcceptance,
  enforceConsistency,
  gradeSystem,
  loadConfig,
  loadDemoSnapshot,
  normalizeSystems,
  OWASP_WSTG_50,
  runSecurityProbeSuite,
  runHealthBenchmark,
  scanRepository,
  scoutSystem,
  systemHealth,
  snapshotRepository,
  validateCityModel,
  verifyFindings,
} from "../dist/index.js";

const bestQuality = {
  security: { tier: "fortified", confidence: 1, rationale: "No relevant weaknesses.", findingIds: [] },
  scalability: { tier: "load_bearing", confidence: 1, rationale: "Work is bounded.", findingIds: [] },
  deployment: { tier: "forged", confidence: 1, rationale: "Configuration is externalized.", findingIds: [] },
  modularity: { tier: "well_walled", confidence: 1, rationale: "Interfaces are narrow.", findingIds: [] },
};

test("live model configuration pins IDs and gives code analysis enough time", () => {
  const config = loadConfig({
    discoveryModel: "mistral-large-2512", codeModel: "mistral-medium-3-5", smallModel: "mistral-small-2603",
  });
  assert.equal(config.requestTimeoutMs, 30_000);
  assert.equal(config.maxConcurrentModelCalls, 2);
  assert.throws(() => loadConfig({ smallModel: "mistral-small-latest" }), /explicitly pinned/);
  assert.throws(() => loadConfig({ maxConcurrentModelCalls: 0 }), /MODEL_CONCURRENCY/);
});

test("a timed-out Mistral attempt is retried with a fresh timeout", async () => {
  let attempts = 0;
  const fetchImpl = async (_url, init) => {
    attempts += 1;
    if (attempts === 1) {
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    }
    return new Response(JSON.stringify({
      model: "mistral-small-latest",
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      usage: { total_tokens: 3 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const parser = { parse: (value) => value };
  const client = new MistralClient("test-key", "https://example.invalid/v1", 2, 5, fetchImpl);
  const result = await client.complete({
    model: "mistral-small-2603", promptVersion: "test-v1", system: "test", user: "test",
    schemaName: "test_schema", jsonSchema: { type: "object" }, parser, maxTokens: 10,
  });
  assert.equal(attempts, 2);
  assert.equal(result.model, "mistral-small-latest");
  assert.deepEqual(result.value, { ok: true });
});

test("a rate-limited Mistral request honors Retry-After and retries", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) return new Response(JSON.stringify({ message: "rate limited" }), { status: 429, headers: { "retry-after": "0" } });
    return new Response(JSON.stringify({
      model: "mistral-small-2603", choices: [{ message: { content: JSON.stringify({ ok: true }) } }], usage: { total_tokens: 3 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new MistralClient("test-key", "https://example.invalid/v1", 2, 1_000, fetchImpl);
  const result = await client.complete({
    model: "mistral-small-2603", promptVersion: "test-v1", system: "test", user: "test",
    schemaName: "test_schema", jsonSchema: { type: "object" }, parser: { parse: (value) => value }, maxTokens: 10,
  });
  assert.equal(attempts, 2);
  assert.deepEqual(result.value, { ok: true });
});

test("Authentication hero delta lands in the 60–70 band and rises above 90", () => {
  const beforeQuality = {
    ...bestQuality,
    security: { ...bestQuality.security, tier: "breachable" },
    modularity: { ...bestQuality.modularity, tier: "tangled" },
  };
  const before = systemHealth(beforeQuality, { failingTests: [{ name: "session should persist after refresh" }] });
  const after = systemHealth(bestQuality, {});
  assert.equal(before, 69);
  assert.equal(after, 100);
  assert.equal(calibrateAuthenticationAcceptance(before, after).passes, true);
});

test("evidence verification drops nonexistent files, lines, and snippets", () => {
  const raw = (id, overrides = {}) => ({
    id, type: "risk", technicalDescription: "A concrete risk.", file: "src/a.ts", line: 2,
    evidence: "const safe = true", severity: "major", confidence: 0.9, ...overrides,
  });
  const result = verifyFindings([
    raw("valid"),
    raw("bad-file", { file: "src/missing.ts" }),
    raw("bad-line", { line: 20 }),
    raw("bad-evidence", { evidence: "invented()" }),
  ], "security", { valid: "People are protected at this boundary." }, [{ path: "src/a.ts", content: "export {}\nconst safe = true\n" }]);
  assert.deepEqual(result.findings.map((finding) => finding.id), ["valid"]);
  assert.equal(result.dropped.length, 3);
});

test("tier consistency is derived from verified findings", () => {
  const middle = enforceConsistency("security", {
    tier: "undefended", confidence: 0.9, rationale: "Claimed worst.", findings: [],
  }, []);
  assert.equal(middle.grade.tier, "breachable");
  const finding = {
    id: "major", type: "auth", technicalDescription: "Missing boundary check.", plainDescription: "Someone could reach a protected action.",
    file: "src/a.ts", line: 1, evidence: "run()", severity: "major", confidence: 0.9, dimension: "security",
  };
  const promoted = enforceConsistency("security", {
    tier: "fortified", confidence: 0.9, rationale: "Claimed best.", findings: [],
  }, [finding]);
  assert.equal(promoted.grade.tier, "breachable");
});

test("semantic normalization enforces 5–8 systems and unique file ownership", () => {
  const files = Array.from({ length: 10 }, (_, index) => ({ path: `src/feature-${index}.ts`, content: `export const value${index} = ${index};` }));
  const raw = files.map((file, index) => ({
    id: `feature-${index}`, name: `Feature ${index}`, plainDescription: `Handles feature ${index}.`, buildingType: "district",
    files: index === 1 ? [files[0].path, file.path] : [file.path], connections: [], discoveryConfidence: 0.8,
  }));
  const normalized = normalizeSystems(raw, files);
  assert.equal(normalized.length, 8);
  const assigned = normalized.flatMap((system) => system.files);
  assert.equal(new Set(assigned).size, assigned.length);
});

test("an unchanged scan is identical and makes zero additional model calls", async () => {
  const client = new FixtureClient();
  const cache = new MemoryCache();
  const snapshot = fixtureRepo();
  let firstAudit;
  let secondAudit;
  const first = await scanRepository(snapshot, { client, cache, onAudit: (audit) => { firstAudit = audit; } });
  const callsAfterFirst = client.calls;
  const second = await scanRepository(snapshot, { client, cache, onAudit: (audit) => { secondAudit = audit; } });
  assert.ok(callsAfterFirst > 0);
  assert.equal(client.calls, callsAfterFirst);
  assert.equal(firstAudit.modelCalls.length, 11);
  assert.equal(secondAudit.modelCalls.length, 0);
  assert.ok(secondAudit.cache.hits >= 11);
  assert.deepEqual(second, first);
  assert.equal(second.schema, "mistral.city-model/v1");
  assert.equal(second.systems.length, 5);
  assert.ok(second.systems.every((system) => !("quality" in system) && Array.isArray(system.healthSignals)));
  assert.ok(second.connections.every((connection) => second.systems.some((system) => system.id === connection.from) && second.systems.some((system) => system.id === connection.to)));
});

test("one rate-limited system stays under fog without discarding successful grades", async () => {
  const collector = new EventCollector();
  let audit;
  let analysis;
  const model = await scanRepository(fixtureRepo(), {
    client: new OneSystemFailureClient(), cache: new MemoryCache(), emit: collector.sink,
    onAudit: (value) => { audit = value; }, onAnalysis: (value) => { analysis = value; },
  });
  assert.equal(model.systems.length, 5);
  assert.equal(model.systems.filter((system) => system.status === "unknown").length, 1);
  assert.equal(model.systems.find((system) => system.id === "system-2").health, 0);
  assert.equal(analysis.systems.length, 5);
  assert.equal(audit.outcome, "partial");
  assert.equal(collector.events.at(-1).type, "analysis.complete");
  assert.ok(collector.events.at(-1).data.warnings.some((warning) => warning.includes("System 2")));
});

test("fast analysis uses one combined grading call per system and no translation pass", async () => {
  const client = new FixtureClient();
  let audit;
  const model = await scanRepository(fixtureRepo(), {
    client, cache: new MemoryCache(), analysisProfile: "fast", onAudit: (value) => { audit = value; },
  });
  assert.equal(model.systems.length, 5);
  assert.equal(audit.profile, "fast");
  assert.equal(audit.modelCalls.length, 6);
  assert.equal(audit.modelCalls.filter((call) => call.schemaName === "semantic_systems").length, 1);
  assert.equal(audit.modelCalls.filter((call) => call.schemaName === "quality_grades_fast").length, 5);
  assert.ok(audit.modelCalls.filter((call) => call.schemaName === "quality_grades_fast").every((call) => call.model === "mistral-medium-3-5"));
  assert.equal(audit.modelCalls.filter((call) => call.schemaName === "deployment_grade" || call.schemaName === "plain_issues").length, 0);
});

test("failed semantic discovery produces a local fogged city and completes analysis", async () => {
  const collector = new EventCollector();
  let audit;
  const model = await scanRepository(fixtureRepo(), {
    client: { async complete() { throw new Error("Mistral API 429: rate limited"); } },
    cache: new MemoryCache(), emit: collector.sink, onAudit: (value) => { audit = value; },
  });
  assert.equal(model.systems.length, 5);
  assert.ok(model.systems.every((system) => system.status === "unknown"));
  assert.equal(model.city.status, "unknown");
  assert.equal(audit.outcome, "partial");
  assert.ok(collector.events.some((event) => event.type === "system.discovered"));
  assert.equal(collector.events.at(-1).type, "analysis.complete");
});

test("model orchestration respects the configured concurrency limit", async () => {
  const client = new ConcurrentFixtureClient();
  await scanRepository(fixtureRepo(), { client, cache: new MemoryCache(), config: { maxConcurrentModelCalls: 1 } });
  assert.equal(client.maximumActive, 1);
});

test("network failure falls back to the pinned snapshot and preserves fog", async () => {
  const collector = new EventCollector();
  const failingClient = { async complete() { throw new Error("network disconnected"); } };
  const model = await scanRepository({ root: "/demo", repoName: "demo-repo", files: [] }, {
    client: failingClient, cache: new MemoryCache(), emit: collector.sink,
  });
  assert.equal(model.systems.find((system) => system.id === "auth").health, 65);
  assert.ok(model.systems.some((system) => system.status === "unknown"));
  assert.equal(collector.events.at(-1).type, "analysis.complete");
});

test("verified failing tests become critical plain-English issues", async () => {
  const client = new FixtureClient();
  const system = {
    id: "auth", name: "Authentication", plainDescription: "Keeps people signed in.", buildingType: "gate",
    files: ["src/auth.ts"], connections: [], discoveryConfidence: 0.9,
  };
  const graded = await gradeSystem(system, {
    client, cache: new MemoryCache(), codeModel: "mistral-medium-3-5", smallModel: "mistral-small-2603",
    repoFiles: [{ path: "src/auth.ts", content: "export const session = true;\ntest('session persists', verifySession);\n" }],
    hardSignals: { failingTests: [{ name: "session persists", file: "src/auth.ts", line: 2, evidence: "test('session persists', verifySession);" }] },
  });
  assert.equal(graded.health, 71);
  assert.equal(graded.status, "broken");
  assert.equal(graded.issues[0].severity, "critical");
  assert.equal(graded.issues[0].plainDescription, "People lose their session after a refresh.");
});

test("Scout performs separate deep discovery and lifts fog", async () => {
  const client = new ScoutClient();
  const cache = new MemoryCache();
  const collector = new EventCollector();
  const unknown = {
    id: "search", name: "Search", plainDescription: "Helps people find information.", buildingType: "library",
    files: ["src/search.ts"], connections: [], discoveryConfidence: 0.4,
    health: 86, status: "unknown", issues: [], quality: bestQuality, deeplyAnalyzed: false,
    modelRun: { model: "mistral-medium-3-5", promptVersion: "grade-code-v1", tokens: 0, cached: true },
  };
  const revealed = await scoutSystem("search", { city: { health: 0, schemaVersion: "1.0.0" }, systems: [unknown], warnings: [] }, {
    root: "/fixture", repoName: "fixture", files: [{ path: "src/search.ts", content: "export const find = () => [];\n" }],
  }, {
    client, cache, discoveryModel: "mistral-large-2512", codeModel: "mistral-medium-3-5", smallModel: "mistral-small-2603", emit: collector.sink,
  });
  assert.equal(revealed.status, "healthy");
  assert.ok(revealed.discoveryConfidence >= 0.75);
  assert.deepEqual(client.schemas, ["scout_system", "code_quality_grades", "deployment_grade"]);
  assert.equal(collector.events.at(-1).type, "system.revealed");
});

test("committed snapshot has the calibrated hero system and non-degenerate tiers", async () => {
  const snapshot = await loadDemoSnapshot();
  assert.deepEqual(snapshot.city, { health: 84, status: "warning" });
  assert.equal(snapshot.systems.find((system) => system.id === "auth").status, "broken");
  assert.ok(snapshot.systems.find((system) => system.id === "search").status === "unknown");
  assert.equal(snapshot.schema, "mistral.city-model/v1");
  assert.ok(snapshot.connections.every((connection) => snapshot.systems.some((system) => system.id === connection.from) && snapshot.systems.some((system) => system.id === connection.to)));
});

test("CityModel validation rejects a connection with an unknown endpoint", () => {
  assert.throws(() => validateCityModel({
    schema: "mistral.city-model/v1",
    repository: { name: "repo", detectedStack: [], analyzedAt: "2026-08-22T20:00:00.000Z" },
    city: { health: 80, status: "healthy" },
    systems: [{ id: "frontend", name: "Frontend", kind: "frontend", description: "Shows the application.", files: ["src/App.tsx"], health: 80, status: "healthy", healthSignals: [], issues: [], confidence: 0.9 }],
    connections: [{ id: "bad", from: "frontend", to: "missing", kind: "calls", evidence: ["src/App.tsx"], confidence: 0.9 }],
  }), /unknown endpoint/);
});

test("CityModel validation rejects leaked internal analysis fields", async () => {
  const snapshot = await loadDemoSnapshot();
  assert.throws(() => validateCityModel({ ...snapshot, warnings: [] }), /unsupported fields: warnings/);
});

test("published CityModel JSON Schema matches the frozen renderer contract", async () => {
  const path = new URL("../contracts/city-model.schema.json", import.meta.url);
  const schema = JSON.parse(await readFile(path, "utf8"));
  assert.equal(schema.properties.schema.const, "mistral.city-model/v1");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["schema", "repository", "city", "systems", "connections"]);
  assert.deepEqual(Object.keys(schema.$defs.CitySystem.properties).sort(), [
    "confidence", "description", "entrypoints", "files", "health", "healthSignals", "id", "issues", "kind", "name", "status",
  ]);
  assert.deepEqual(schema.$defs.HealthStatus.enum, ["healthy", "warning", "broken", "unknown"]);
  assert.deepEqual(schema.$defs.CityConnection.properties.kind.enum, ["calls", "reads", "writes", "authenticates", "tests", "depends_on"]);
  const sample = await loadDemoSnapshot();
  assert.equal(sample.schema, schema.properties.schema.const);
  assert.ok(sample.systems.some((system) => system.id === "auth"));
});

test("OWASP WSTG 50 harness exercises the mock codebase end to end", async () => {
  const snapshot = await snapshotRepository(new URL("../fixtures/mock-vulnerable-repo", import.meta.url).pathname);
  snapshot.analyzedAt = "2026-08-22T20:00:00.000Z";
  const security = runSecurityProbeSuite(snapshot.files);
  assert.equal(OWASP_WSTG_50.length, 50);
  assert.equal(new Set(OWASP_WSTG_50.map((probe) => probe.id)).size, 50);
  assert.equal(security.detected, 50);
  assert.ok(security.findings.every((finding) => snapshot.files.some((file) => file.path === finding.file && file.content.split(/\r?\n/)[finding.line - 1]?.includes(finding.evidence))));

  let audit;
  let analysis;
  const city = await scanRepository(snapshot, {
    client: new VulnerableRepoClient(), cache: new MemoryCache(), mode: "mock",
    onAudit: (value) => { audit = value; }, onAnalysis: (value) => { analysis = value; },
  });
  assert.equal(city.schema, "mistral.city-model/v1");
  assert.equal(city.systems.length, 5);
  assert.equal(city.systems.find((system) => system.id === "auth").status, "broken");
  assert.equal(city.systems.find((system) => system.id === "auth").health, 32);
  assert.equal(city.city.health, 49);
  assert.ok(city.systems.find((system) => system.id === "auth").issues.length > 0);
  assert.ok(city.systems.find((system) => system.id === "auth").issues.some((issue) => issue.summary === "Credentials sent over an unencrypted channel"));
  assert.ok(city.connections.some((connection) => connection.id === "auth-database"));
  assert.ok(city.connections.every((connection) => city.systems.some((system) => system.id === connection.from) && city.systems.some((system) => system.id === connection.to)));
  assert.equal(audit.mode, "mock");
  assert.equal(audit.outcome, "complete");
  assert.equal(audit.modelCalls.length, 14);
  const sources = analysisIssueSources(analysis);
  const publicIssues = city.systems.flatMap((system) => system.issues.map((issue) => ({ systemId: system.id, issue })));
  assert.equal(sources.length, publicIssues.length);
  assert.ok(publicIssues.every(({ systemId, issue }) => sources.some((source) => source.systemId === systemId && source.issueId === issue.id && issue.files.includes(source.file))));
  assert.ok(sources.every((source) => snapshot.files.some((file) => file.path === source.file && file.content.split(/\r?\n/)[source.line - 1])));
});

for (const [fixture, expectedHealth, expectedStatus] of [
  ["healthy-commerce", 99, "healthy"],
  ["average-commerce", 79, "warning"],
  ["critical-commerce", 11, "broken"],
]) {
  test(`health benchmark classifies ${fixture}`, async () => {
    const root = new URL(`../fixtures/health-benchmarks/${fixture}`, import.meta.url).pathname;
    const result = await runHealthBenchmark(root);
    assert.equal(result.passed, true);
    assert.equal(result.model.city.health, expectedHealth);
    assert.equal(result.model.city.status, expectedStatus);
    assert.equal(result.model.systems.length, 6);
    assert.ok(result.audit.modelCalls.length >= 13);
  });
}

class FixtureClient {
  calls = 0;
  async complete(request) {
    this.calls += 1;
    if (request.schemaName === "semantic_systems") {
      return { value: { systems: Array.from({ length: 5 }, (_, index) => ({
        id: `system-${index}`, name: `System ${index}`, plainDescription: `Handles capability ${index} for people.`, buildingType: "district",
        files: [`src/system-${index}.ts`], connections: [], discoveryConfidence: 0.9,
      })) }, model: request.model, promptVersion: request.promptVersion, tokens: 10 };
    }
    const grade = (tier, rationale) => ({ tier, confidence: 0.9, rationale, findings: [] });
    if (request.schemaName === "code_quality_grades") return {
      value: {
        security: grade("fortified", "No security surface."), scalability: grade("load_bearing", "Work is bounded."), modularity: grade("well_walled", "The interface is narrow."),
      }, model: request.model, promptVersion: request.promptVersion, tokens: 10,
    };
    if (request.schemaName === "quality_grades_fast") return {
      value: {
        security: grade("fortified", "No security surface."), scalability: grade("load_bearing", "Work is bounded."),
        deployment: grade("forged", "There is no separate deployment surface."), modularity: grade("well_walled", "The interface is narrow."),
      }, model: request.model, promptVersion: request.promptVersion, tokens: 12,
    };
    if (request.schemaName === "deployment_grade") return {
      value: grade("forged", "There is no separate deployment surface."), model: request.model, promptVersion: request.promptVersion, tokens: 5,
    };
    if (request.schemaName === "plain_issues") return {
      value: { issues: [{ id: "auth-failing-test-1", plainDescription: "People lose their session after a refresh." }] },
      model: request.model, promptVersion: request.promptVersion, tokens: 4,
    };
    throw new Error(`Unexpected schema ${request.schemaName}`);
  }
}

class ScoutClient extends FixtureClient {
  schemas = [];
  async complete(request) {
    this.schemas.push(request.schemaName);
    if (request.schemaName === "scout_system") return {
      value: { systems: [{
        id: "search", name: "Search", plainDescription: "Helps people find information.", buildingType: "library",
        files: ["src/search.ts"], connections: [], discoveryConfidence: 0.88,
      }] }, model: request.model, promptVersion: request.promptVersion, tokens: 8,
    };
    return super.complete(request);
  }
}

class OneSystemFailureClient extends FixtureClient {
  async complete(request) {
    if (request.schemaName === "code_quality_grades" && JSON.parse(request.user).system.id === "system-2") {
      throw new Error("Mistral API 429: rate limited");
    }
    return super.complete(request);
  }
}

class ConcurrentFixtureClient extends FixtureClient {
  active = 0;
  maximumActive = 0;
  async complete(request) {
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return await super.complete(request);
    } finally {
      this.active -= 1;
    }
  }
}

class VulnerableRepoClient extends FixtureClient {
  async complete(request) {
    if (request.schemaName === "semantic_systems") return {
      value: { systems: [
        { id: "login-area", name: "Authentication", plainDescription: "Handles login and sessions.", buildingType: "gate", files: ["src/auth.ts"], connections: ["data-layer"], discoveryConfidence: 0.98 },
        { id: "service", name: "Application API", plainDescription: "Handles requests from the application.", buildingType: "port", files: ["src/api.ts", "src/config.ts", "package.json"], connections: ["data-layer"], discoveryConfidence: 0.95 },
        { id: "data-layer", name: "Database", plainDescription: "Stores user information.", buildingType: "vault", files: ["src/db.ts"], connections: [], discoveryConfidence: 0.96 },
        { id: "web-app", name: "Frontend", plainDescription: "Shows the application to people.", buildingType: "district", files: ["src/frontend.tsx"], connections: ["login-area"], discoveryConfidence: 0.93 },
        { id: "checks", name: "Tests", plainDescription: "Checks whether important behavior still works.", buildingType: "guard_tower", files: ["tests/security.test.ts"], connections: ["login-area"], discoveryConfidence: 0.91 },
      ] }, model: request.model, promptVersion: request.promptVersion, tokens: 20,
    };
    const grade = (tier, rationale) => ({ tier, confidence: 0.95, rationale, findings: [] });
    if (request.schemaName === "code_quality_grades") return {
      value: {
        security: grade("undefended", "Concrete exploitable weaknesses are present."),
        scalability: grade("load_bearing", "The fixture has no meaningful load surface."),
        modularity: grade("well_walled", "The fixture separates its demonstration areas."),
      }, model: request.model, promptVersion: request.promptVersion, tokens: 10,
    };
    if (request.schemaName === "deployment_grade") return {
      value: grade("sputtering", "The fixture is intentionally not deployable."), model: request.model, promptVersion: request.promptVersion, tokens: 5,
    };
    if (request.schemaName === "plain_issues") {
      const input = JSON.parse(request.user);
      return { value: { issues: input.issues.map((issue) => ({ id: issue.id, plainDescription: "An attacker could use this weakness to access protected information." })) }, model: request.model, promptVersion: request.promptVersion, tokens: 10 };
    }
    return super.complete(request);
  }
}

function fixtureRepo() {
  return {
    root: "/fixture", repoName: "fixture", analyzedAt: "2026-08-22T20:00:00.000Z",
    files: Array.from({ length: 5 }, (_, index) => ({ path: `src/system-${index}.ts`, content: `export const system${index} = true;\n` })),
  };
}
