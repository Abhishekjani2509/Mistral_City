import { fileURLToPath } from "node:url";
import { runHealthBenchmark } from "../dist/index.js";

const live = process.argv.includes("--live");
const profiles = ["healthy-commerce", "average-commerce", "critical-commerce"];
const results = [];
for (const profile of profiles) {
  const root = fileURLToPath(new URL(`../fixtures/health-benchmarks/${profile}`, import.meta.url));
  const result = await runHealthBenchmark(root, { live });
  results.push({
    profile: result.profile,
    cityHealth: result.model.city.health,
    cityStatus: result.model.city.status,
    expected: result.expected,
    passed: result.passed,
    systems: result.model.systems.map(({ id, health, status, issues }) => ({ id, health, status, issues: issues.length })),
    modelCalls: result.audit.modelCalls.length,
    elapsedMs: result.audit.elapsedMs,
  });
}
process.stdout.write(`${JSON.stringify({ mode: live ? "live" : "deterministic", results }, null, 2)}\n`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
