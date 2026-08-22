import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MemoryCache } from "./cache.js";
import type { CompletionRequest, CompletionResult, IntelligenceModelClient } from "./client.js";
import { snapshotRepository } from "./repo.js";
import { scanRepository, type AnalysisRunAudit } from "./scan.js";
import type { Dimension, DiscoveredSystem, HardSignals, RawFinding, RawGrade, Severity, Tier } from "./schema.js";

interface BenchmarkFinding {
  id: string;
  type: string;
  technicalDescription: string;
  plainDescription: string;
  file: string;
  evidence: string;
  severity: Severity;
  confidence: number;
}

interface BenchmarkGrade {
  tier: Tier;
  rationale: string;
  findings: BenchmarkFinding[];
}

interface BenchmarkSystem extends DiscoveredSystem {
  quality: Record<Dimension, BenchmarkGrade>;
}

interface BenchmarkHardSignals extends Omit<HardSignals, "failingTests"> {
  failingTests?: Array<{ name: string; file: string; evidence: string }>;
}

export interface HealthBenchmarkManifest {
  profile: "healthy" | "average" | "critical";
  systems: BenchmarkSystem[];
  hardSignals?: Record<string, BenchmarkHardSignals>;
  expected: { minimumHealth: number; maximumHealth: number; status: "healthy" | "warning" | "broken" };
}

export interface HealthBenchmarkResult {
  profile: HealthBenchmarkManifest["profile"];
  expected: HealthBenchmarkManifest["expected"];
  model: Awaited<ReturnType<typeof scanRepository>>;
  audit: AnalysisRunAudit;
  passed: boolean;
}

export async function runHealthBenchmark(root: string, options: { live?: boolean } = {}): Promise<HealthBenchmarkResult> {
  const manifest = JSON.parse(await readFile(join(root, "benchmark.json"), "utf8")) as HealthBenchmarkManifest;
  const snapshot = await snapshotRepository(root);
  snapshot.analyzedAt = "2026-08-22T20:00:00.000Z";
  snapshot.hardSignals = resolveHardSignals(manifest, snapshot.files);
  let audit: AnalysisRunAudit | undefined;
  const model = await scanRepository(snapshot, {
    ...(options.live ? {} : { client: new BenchmarkClient(manifest, snapshot.files) }),
    cache: new MemoryCache(), mode: options.live ? "live" : "mock",
    onAudit: (value) => { audit = value; },
  });
  if (!audit) throw new Error(`Benchmark ${manifest.profile} did not produce an audit`);
  const passed = model.city.health >= manifest.expected.minimumHealth
    && model.city.health <= manifest.expected.maximumHealth
    && model.city.status === manifest.expected.status;
  return { profile: manifest.profile, expected: manifest.expected, model, audit, passed };
}

class BenchmarkClient implements IntelligenceModelClient {
  constructor(private readonly manifest: HealthBenchmarkManifest, private readonly files: Array<{ path: string; content: string }>) {}

  async complete<T>(request: CompletionRequest<T>): Promise<CompletionResult<T>> {
    let value: unknown;
    if (request.schemaName === "semantic_systems") {
      value = { systems: this.manifest.systems.map(({ quality: _quality, ...system }) => system) };
    } else {
      const input = JSON.parse(request.user) as { system?: { id?: string }; issues?: Array<{ id: string }> };
      if (request.schemaName === "plain_issues") {
        const descriptions = new Map(this.manifest.systems.flatMap((system) => Object.values(system.quality).flatMap((grade) => grade.findings.map((finding) => [finding.id, finding.plainDescription] as const))));
        value = { issues: (input.issues ?? []).map((issue) => ({ id: issue.id, plainDescription: descriptions.get(issue.id) ?? "This could make the application less safe or reliable." })) };
      } else {
        const system = this.manifest.systems.find((candidate) => candidate.id === input.system?.id);
        if (!system) throw new Error(`Unknown benchmark system: ${input.system?.id ?? "missing"}`);
        value = request.schemaName === "deployment_grade"
          ? this.resolveGrade(system.quality.deployment)
          : {
              security: this.resolveGrade(system.quality.security),
              scalability: this.resolveGrade(system.quality.scalability),
              modularity: this.resolveGrade(system.quality.modularity),
            };
      }
    }
    return { value: value as T, model: request.model, promptVersion: request.promptVersion, tokens: 0 };
  }

  private resolveGrade(grade: BenchmarkGrade): RawGrade {
    return { tier: grade.tier, confidence: 0.95, rationale: grade.rationale, findings: grade.findings.map((finding) => this.resolveFinding(finding)) };
  }

  private resolveFinding(finding: BenchmarkFinding): RawFinding {
    const file = this.files.find((candidate) => candidate.path === finding.file);
    const line = file?.content.split(/\r?\n/).findIndex((candidate) => candidate.includes(finding.evidence)) ?? -1;
    if (!file || line < 0) throw new Error(`Benchmark evidence not found: ${finding.file} — ${finding.evidence}`);
    const { plainDescription: _plainDescription, ...raw } = finding;
    return { ...raw, line: line + 1 };
  }
}

function resolveHardSignals(manifest: HealthBenchmarkManifest, files: Array<{ path: string; content: string }>): Record<string, HardSignals> {
  return Object.fromEntries(Object.entries(manifest.hardSignals ?? {}).map(([systemId, signals]) => [systemId, {
    ...signals,
    ...(signals.failingTests ? { failingTests: signals.failingTests.map((test) => {
      const file = files.find((candidate) => candidate.path === test.file);
      const line = file?.content.split(/\r?\n/).findIndex((candidate) => candidate.includes(test.evidence)) ?? -1;
      if (!file || line < 0) throw new Error(`Benchmark failing-test evidence not found: ${test.file} — ${test.evidence}`);
      return { ...test, line: line + 1 };
    }) } : {}),
  }]));
}
