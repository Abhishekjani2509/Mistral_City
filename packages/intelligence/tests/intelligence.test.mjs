import assert from "node:assert/strict";
import test from "node:test";
import {
  EventCollector,
  MemoryCache,
  calibrateAuthenticationAcceptance,
  enforceConsistency,
  gradeSystem,
  loadConfig,
  loadDemoSnapshot,
  normalizeSystems,
  OWASP_WSTG_50,
  runSecurityProbeSuite,
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
    discoveryModel: "mistral-large-2512", codeModel: "devstral-2512", smallModel: "mistral-small-2506",
  });
  assert.equal(config.requestTimeoutMs, 30_000);
  assert.throws(() => loadConfig({ smallModel: "mistral-small-latest" }), /explicitly pinned/);
});

test("Authentication hero delta lands at 65 and rises above 90", () => {
  const beforeQuality = {
    ...bestQuality,
    security: { ...bestQuality.security, tier: "breachable" },
    modularity: { ...bestQuality.modularity, tier: "tangled" },
  };
  const before = systemHealth(beforeQuality, { failingTests: [{ name: "session should persist after refresh" }] });
  const after = systemHealth(bestQuality, {});
  assert.equal(before, 65);
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
    client, cache: new MemoryCache(), codeModel: "devstral-2512", smallModel: "mistral-small-2506",
    repoFiles: [{ path: "src/auth.ts", content: "export const session = true;\ntest('session persists', verifySession);\n" }],
    hardSignals: { failingTests: [{ name: "session persists", file: "src/auth.ts", line: 2, evidence: "test('session persists', verifySession);" }] },
  });
  assert.equal(graded.health, 69);
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
    modelRun: { model: "devstral-2512", promptVersion: "grade-code-v1", tokens: 0, cached: true },
  };
  const revealed = await scoutSystem("search", { city: { health: 0, schemaVersion: "1.0.0" }, systems: [unknown], warnings: [] }, {
    root: "/fixture", repoName: "fixture", files: [{ path: "src/search.ts", content: "export const find = () => [];\n" }],
  }, {
    client, cache, discoveryModel: "mistral-large-2512", codeModel: "devstral-2512", smallModel: "mistral-small-2506", emit: collector.sink,
  });
  assert.equal(revealed.status, "healthy");
  assert.ok(revealed.discoveryConfidence >= 0.75);
  assert.deepEqual(client.schemas, ["scout_system", "code_quality_grades", "deployment_grade"]);
  assert.equal(collector.events.at(-1).type, "system.revealed");
});

test("committed snapshot has the calibrated hero system and non-degenerate tiers", async () => {
  const snapshot = await loadDemoSnapshot();
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

test("OWASP WSTG 50 harness exercises the mock codebase end to end", async () => {
  const snapshot = await snapshotRepository(new URL("../fixtures/mock-vulnerable-repo", import.meta.url).pathname);
  snapshot.analyzedAt = "2026-08-22T20:00:00.000Z";
  const security = runSecurityProbeSuite(snapshot.files);
  assert.equal(OWASP_WSTG_50.length, 50);
  assert.equal(new Set(OWASP_WSTG_50.map((probe) => probe.id)).size, 50);
  assert.equal(security.detected, 50);
  assert.ok(security.findings.every((finding) => snapshot.files.some((file) => file.path === finding.file && file.content.split(/\r?\n/)[finding.line - 1]?.includes(finding.evidence))));

  let audit;
  const city = await scanRepository(snapshot, { client: new VulnerableRepoClient(), cache: new MemoryCache(), mode: "mock", onAudit: (value) => { audit = value; } });
  assert.equal(city.schema, "mistral.city-model/v1");
  assert.equal(city.systems.length, 5);
  assert.equal(city.systems.find((system) => system.id === "auth").status, "broken");
  assert.equal(city.systems.find((system) => system.id === "auth").health, 52);
  assert.equal(city.city.health, 65);
  assert.ok(city.systems.find((system) => system.id === "auth").issues.length > 0);
  assert.ok(city.systems.find((system) => system.id === "auth").issues.some((issue) => issue.summary === "Credentials sent over an unencrypted channel"));
  assert.ok(city.connections.some((connection) => connection.id === "auth-database"));
  assert.ok(city.connections.every((connection) => city.systems.some((system) => system.id === connection.from) && city.systems.some((system) => system.id === connection.to)));
  assert.equal(audit.mode, "mock");
  assert.equal(audit.outcome, "complete");
  assert.equal(audit.modelCalls.length, 14);
});

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
