import { z } from "zod";
import type { CacheStore } from "../cache.js";
import { cacheKey } from "../cache.js";
import type { IntelligenceModelClient } from "../client.js";
import { enforceConsistency } from "../consistency.js";
import { codeGradesJsonSchema, deploymentGradeJsonSchema, fastQualityGradesJsonSchema, plainJsonSchema } from "../json-schemas.js";
import { ensurePlainEnglish } from "../plain.js";
import { GRADE_CODE_PROMPT, GRADE_CODE_VERSION, GRADE_DEPLOYMENT_PROMPT, GRADE_DEPLOYMENT_VERSION, GRADE_FAST_PROMPT, GRADE_FAST_VERSION, PLAIN_PROMPT, PLAIN_VERSION } from "../prompts.js";
import { rawGradeSchema, type Dimension, type DiscoveredSystem, type Finding, type QualityBlock, type RawGrade, type RepoFile, type SystemModel } from "../schema.js";
import { runSecurityProbeSuite } from "../security/attack-catalog.js";
import { systemHealth, systemStatus } from "../synthesize.js";
import { verifyFindings } from "../verify.js";

const codeGradesSchema = z.object({ security: rawGradeSchema, scalability: rawGradeSchema, modularity: rawGradeSchema });
const fastQualityGradesSchema = z.object({ security: rawGradeSchema, scalability: rawGradeSchema, deployment: rawGradeSchema, modularity: rawGradeSchema });
const plainResponseSchema = z.object({ issues: z.array(z.object({ id: z.string(), plainDescription: z.string().min(1) })) });

export interface GradeSystemOptions {
  client: IntelligenceModelClient; cache: CacheStore; codeModel: string; smallModel: string;
  repoFiles: RepoFile[]; hardSignals?: Parameters<typeof systemHealth>[1]; deeplyAnalyzed?: boolean;
  cacheContext?: string;
  timeoutMs?: number;
  profile?: "fast" | "comprehensive";
  onDroppedFinding?: (message: string) => void;
}

export async function gradeSystem(system: DiscoveredSystem, options: GradeSystemOptions): Promise<SystemModel> {
  const files = system.files.map((path) => options.repoFiles.find((file) => file.path === path)).filter((file): file is RepoFile => Boolean(file));
  let rawByDimension: Record<Dimension, RawGrade>;
  let gradingTokens: number;
  const gradingModel = options.codeModel;
  if (options.profile === "fast") {
    const combined = await cachedCompletion(options.cache, files, contextualVersion(GRADE_FAST_VERSION, options.cacheContext), gradingModel, () => options.client.complete({
      model: gradingModel, promptVersion: GRADE_FAST_VERSION, system: GRADE_FAST_PROMPT,
      user: gradeInput(system, files, 35_000), schemaName: "quality_grades_fast", jsonSchema: fastQualityGradesJsonSchema,
      parser: fastQualityGradesSchema, maxTokens: 3_500, timeoutMs: options.timeoutMs,
    }));
    rawByDimension = combined.value;
    gradingTokens = combined.tokens;
  } else {
    const [code, deployment] = await Promise.all([
      cachedCompletion(options.cache, files, contextualVersion(GRADE_CODE_VERSION, options.cacheContext), options.codeModel, () => options.client.complete({
        model: options.codeModel, promptVersion: GRADE_CODE_VERSION, system: GRADE_CODE_PROMPT,
        user: gradeInput(system, files, 90_000), schemaName: "code_quality_grades", jsonSchema: codeGradesJsonSchema,
        parser: codeGradesSchema, maxTokens: 5_000, timeoutMs: options.timeoutMs,
      })),
      cachedCompletion(options.cache, files, contextualVersion(GRADE_DEPLOYMENT_VERSION, options.cacheContext), options.smallModel, () => options.client.complete({
        model: options.smallModel, promptVersion: GRADE_DEPLOYMENT_VERSION, system: GRADE_DEPLOYMENT_PROMPT,
        user: gradeInput(system, files, 40_000), schemaName: "deployment_grade", jsonSchema: deploymentGradeJsonSchema,
        parser: rawGradeSchema, maxTokens: 1_500, timeoutMs: options.timeoutMs,
      })),
    ]);
    rawByDimension = { ...code.value, deployment: deployment.value };
    gradingTokens = code.tokens + deployment.tokens;
  }
  const verifiedByDimension = {} as Record<Dimension, ReturnType<typeof verifyFindings>>;
  for (const dimension of Object.keys(rawByDimension) as Dimension[]) {
    verifiedByDimension[dimension] = verifyFindings(rawByDimension[dimension].findings, dimension, {}, files);
    for (const dropped of verifiedByDimension[dimension].dropped) options.onDroppedFinding?.(`${system.id}/${dimension}/${dropped.finding.id}: ${dropped.reason}`);
  }
  const verifiedTests = verifyFailingTests(system.id, options.hardSignals?.failingTests ?? [], files);
  verifiedByDimension.modularity.findings.push(...verifiedTests.findings);
  for (const dropped of verifiedTests.dropped) options.onDroppedFinding?.(`${system.id}/modularity/${dropped.finding.id}: ${dropped.reason}`);
  const securityProbeFindings: Finding[] = runSecurityProbeSuite(files).findings.map((finding) => ({
    id: `${system.id}-${finding.probeId.toLowerCase()}`,
    type: "security_probe",
    technicalDescription: `${finding.probeId}: ${finding.name}.`,
    plainDescription: finding.severity === "critical" ? "An attacker could use this weakness to access or change protected information." : "This protection is weaker than it should be and could put people at risk.",
    file: finding.file,
    line: finding.line,
    evidence: finding.evidence,
    severity: finding.severity,
    confidence: 0.98,
    dimension: "security",
  }));
  verifiedByDimension.security.findings.push(...securityProbeFindings);
  for (const dimension of Object.keys(verifiedByDimension) as Dimension[]) {
    verifiedByDimension[dimension].findings = verifiedByDimension[dimension].findings
      .sort((a, b) => severityValue(b.severity) * b.confidence - severityValue(a.severity) * a.confidence || a.id.localeCompare(b.id))
      .slice(0, 6);
  }
  const allRawVerified = (Object.keys(verifiedByDimension) as Dimension[]).flatMap((dimension) => verifiedByDimension[dimension].findings);
  const plain = options.profile === "fast"
    ? {
        descriptions: Object.fromEntries(allRawVerified.map((finding) => [finding.id, ensurePlainEnglish(finding.technicalDescription, finding.plainDescription)])),
        tokens: 0,
        cached: true,
      }
    : await plainDescriptions(system, allRawVerified, files, options);
  const quality = {} as QualityBlock;
  const issues: Finding[] = [];
  for (const dimension of Object.keys(rawByDimension) as Dimension[]) {
    const withPlain = verifiedByDimension[dimension].findings.map((finding) => ({
      ...finding,
      plainDescription: ensurePlainEnglish(
        plain.descriptions[finding.id] ?? finding.plainDescription,
        finding.severity === "critical" ? "This can cause the feature to fail or put people at risk." : "This could make the feature less reliable over time.",
      ),
    }));
    const consistent = enforceConsistency(dimension, rawByDimension[dimension], withPlain);
    quality[dimension] = consistent.grade;
    issues.push(...consistent.findings);
  }
  const hardSignals = options.hardSignals ?? {};
  const health = systemHealth(quality, hardSignals, issues);
  const deeplyAnalyzed = options.deeplyAnalyzed ?? true;
  return {
    ...system, health, status: systemStatus(health, issues, hardSignals, system.discoveryConfidence, deeplyAnalyzed),
    issues: issues.sort((a, b) => a.id.localeCompare(b.id)), quality, deeplyAnalyzed,
    // All component results have been persisted before the system is emitted. Keeping
    // this artifact-level flag stable makes unchanged scans byte-deterministic.
    modelRun: { model: gradingModel, promptVersion: options.profile === "fast" ? GRADE_FAST_VERSION : GRADE_CODE_VERSION, tokens: gradingTokens + plain.tokens, cached: true },
  };
}

async function plainDescriptions(
  system: DiscoveredSystem, findings: Finding[], files: RepoFile[], options: GradeSystemOptions,
): Promise<{ descriptions: Record<string, string>; tokens: number; cached: boolean }> {
  if (findings.length === 0) return { descriptions: {}, tokens: 0, cached: true };
  const result = await cachedCompletion(options.cache, files, contextualVersion(PLAIN_VERSION, options.cacheContext), options.smallModel, () => options.client.complete({
    model: options.smallModel, promptVersion: PLAIN_VERSION, system: PLAIN_PROMPT,
    user: JSON.stringify({ system: { name: system.name, plainDescription: system.plainDescription }, issues: findings.map(({ id, technicalDescription, severity }) => ({ id, technicalDescription, severity })) }),
    schemaName: "plain_issues", jsonSchema: plainJsonSchema, parser: plainResponseSchema, maxTokens: 1_200, timeoutMs: options.timeoutMs,
  }));
  return { descriptions: Object.fromEntries(result.value.issues.map((issue) => [issue.id, issue.plainDescription])), tokens: result.tokens, cached: result.cached };
}

async function cachedCompletion<T>(
  cache: CacheStore, files: RepoFile[], promptVersion: string, model: string,
  run: () => Promise<{ value: T; tokens: number }>,
): Promise<{ value: T; tokens: number; cached: boolean }> {
  const key = cacheKey(files, promptVersion, model);
  const hit = await cache.get<{ value: T; tokens: number }>(key);
  if (hit) return { ...hit, cached: true };
  const result = await run();
  const value = { value: result.value, tokens: result.tokens };
  await cache.put(key, value);
  return { ...value, cached: false };
}

function gradeInput(system: DiscoveredSystem, files: RepoFile[], characterBudget: number): string {
  let remaining = characterBudget;
  const bounded = [...files]
    .sort((a, b) => Number(/(?:test|spec|route|schema|auth)/i.test(b.path)) - Number(/(?:test|spec|route|schema|auth)/i.test(a.path)) || a.path.localeCompare(b.path))
    .flatMap((file) => {
      if (remaining <= 0) return [];
      const content = file.content.slice(0, Math.min(remaining, 15_000));
      remaining -= content.length;
      return [{ path: file.path, numberedContent: content.split(/\r?\n/).map((line, index) => `${index + 1}: ${line}`).join("\n") }];
    });
  return JSON.stringify({ system, files: bounded });
}

function contextualVersion(version: string, context?: string): string { return context ? `${version}:${context}` : version; }
function severityValue(severity: Finding["severity"]): number { return { info: 0, minor: 1, major: 2, critical: 3 }[severity]; }

function verifyFailingTests(
  systemId: string,
  tests: NonNullable<NonNullable<GradeSystemOptions["hardSignals"]>["failingTests"]>,
  files: RepoFile[],
): ReturnType<typeof verifyFindings> {
  return verifyFindings(tests.filter((test) => test.file && test.line && test.evidence).map((test, index) => ({
    id: `${systemId}-failing-test-${index + 1}`,
    type: "failing_test",
    technicalDescription: `The test "${test.name}" fails.`,
    file: test.file!,
    line: test.line!,
    evidence: test.evidence!,
    severity: "critical" as const,
    confidence: 1,
  })), "modularity", {}, files);
}
