import assert from "node:assert/strict";
import test from "node:test";
import type { CityModel } from "../../contracts/city-model";
import { toRendererModel } from "./mistral-city";

test("attaches source links by both system and issue id", () => {
  const issue = {
    id: "SEC-001",
    type: "unknown" as const,
    summary: "Unsafe boundary",
    description: "The boundary accepts unsafe input.",
    files: ["src/api.ts"],
  };
  const model: CityModel = {
    schema: "mistral.city-model/v1",
    repository: { name: "service", detectedStack: ["TypeScript"], analyzedAt: "2026-08-22T20:00:00.000Z" },
    city: { health: 40, status: "broken" },
    systems: ["api", "worker"].map((id) => ({
      id, name: id, kind: "api" as const, description: `${id} system`, files: [`src/${id}.ts`],
      health: 40, status: "broken" as const, healthSignals: [], issues: [{ ...issue, files: [`src/${id}.ts`] }], confidence: 0.9,
    })),
    connections: [],
  };
  const sources = ["api", "worker"].map((systemId, index) => ({
    issueId: "SEC-001", systemId, file: `src/${systemId}.ts`, line: index + 10,
    url: `https://github.com/example/service/blob/0123456789abcdef0123456789abcdef01234567/src/${systemId}.ts#L${index + 10}`,
  }));

  const rendered = toRendererModel(model, sources);
  assert.equal(rendered.systems.find((system) => system.id === "api")?.issues[0]?.source?.line, 10);
  assert.equal(rendered.systems.find((system) => system.id === "worker")?.issues[0]?.source?.line, 11);
});
