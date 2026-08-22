import { fileURLToPath } from "node:url";
import { MemoryCache, runSecurityProbeSuite, scanRepository, snapshotRepository } from "../dist/index.js";

class MockAnalysisClient {
  async complete(request) {
    const grade = (tier, rationale) => ({ tier, confidence: 0.95, rationale, findings: [] });
    if (request.schemaName === "semantic_systems") return result(request, { systems: [
      { id: "login-area", name: "Authentication", plainDescription: "Handles login and sessions.", buildingType: "gate", files: ["src/auth.ts"], connections: ["data-layer"], discoveryConfidence: 0.98 },
      { id: "service", name: "Application API", plainDescription: "Handles requests from the application.", buildingType: "port", files: ["src/api.ts", "src/config.ts", "package.json"], connections: ["data-layer"], discoveryConfidence: 0.95 },
      { id: "data-layer", name: "Database", plainDescription: "Stores user information.", buildingType: "vault", files: ["src/db.ts"], connections: [], discoveryConfidence: 0.96 },
      { id: "web-app", name: "Frontend", plainDescription: "Shows the application to people.", buildingType: "district", files: ["src/frontend.tsx"], connections: ["login-area"], discoveryConfidence: 0.93 },
      { id: "checks", name: "Tests", plainDescription: "Checks whether important behavior still works.", buildingType: "guard_tower", files: ["tests/security.test.ts"], connections: ["login-area"], discoveryConfidence: 0.91 },
    ] });
    if (request.schemaName === "code_quality_grades") return result(request, {
      security: grade("undefended", "Concrete exploitable weaknesses are present in the supplied evidence."),
      scalability: grade("load_bearing", "The fixture has no meaningful load surface."),
      modularity: grade("well_walled", "The fixture separates its demonstration areas."),
    });
    if (request.schemaName === "deployment_grade") return result(request, grade("sputtering", "The fixture is intentionally not deployable."));
    if (request.schemaName === "plain_issues") {
      const input = JSON.parse(request.user);
      return result(request, { issues: input.issues.map((issue) => ({ id: issue.id, plainDescription: "An attacker could use this weakness to access or change protected information." })) });
    }
    throw new Error(`Unexpected mock schema: ${request.schemaName}`);
  }
}

function result(request, value) {
  return { value, model: request.model, promptVersion: request.promptVersion, tokens: 0 };
}

const fixture = fileURLToPath(new URL("../fixtures/mock-vulnerable-repo", import.meta.url));
const snapshot = await snapshotRepository(fixture);
snapshot.analyzedAt = "2026-08-22T20:00:00.000Z";
const security = runSecurityProbeSuite(snapshot.files);
const city = await scanRepository(snapshot, {
  client: new MockAnalysisClient(), cache: new MemoryCache(), mode: "mock",
  onAudit: (audit) => process.stderr.write(`[city-intel] MOCK ANALYSIS — no Mistral API was contacted; simulatedCalls=${audit.modelCalls.length} elapsedMs=${audit.elapsedMs}\n`),
});

process.stderr.write(`[city-intel] static OWASP fixture coverage: ${security.detected}/${security.total}\n`);
process.stdout.write(`${JSON.stringify(city, null, 2)}\n`);
