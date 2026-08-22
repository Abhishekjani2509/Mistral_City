import type { Dimension, Finding, QualityGrade, RawGrade, Severity, Tier } from "./schema.js";
import { TIERS_BY_DIMENSION } from "./schema.js";

const severityRank: Record<Severity, number> = { info: 0, minor: 1, major: 2, critical: 3 };

export function enforceConsistency(dimension: Dimension, grade: RawGrade, verified: Finding[]): { grade: QualityGrade; findings: Finding[] } {
  const tiers = TIERS_BY_DIMENSION[dimension];
  let tier: Tier = tiers.includes(grade.tier) ? grade.tier : tiers[1];
  const findings = [...verified]
    .sort((a, b) => severityRank[b.severity] * b.confidence - severityRank[a.severity] * a.confidence)
    .slice(0, 6);
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const hasMajor = findings.some((finding) => severityRank[finding.severity] >= severityRank.major);
  const explicitlyNoSurface = findings.length === 0 && /\b(?:no|without)\b.{0,30}\b(?:surface|relevant code|applicable)\b/i.test(grade.rationale);
  if (explicitlyNoSurface) tier = tiers[0];
  if (tier === tiers[2] && !hasCritical) tier = tiers[1];
  if (tier === tiers[0] && hasMajor) tier = tiers[1];
  return {
    grade: { tier, confidence: grade.confidence, rationale: grade.rationale, findingIds: findings.map((finding) => finding.id) },
    findings,
  };
}

export function tierHistogram(systems: Array<{ quality: Record<Dimension, QualityGrade> }>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const system of systems) for (const dimension of Object.keys(system.quality) as Dimension[]) {
    const tier = system.quality[dimension].tier;
    result[tier] = (result[tier] ?? 0) + 1;
  }
  return result;
}

export function histogramWarnings(systems: Array<{ quality: Record<Dimension, QualityGrade> }>): string[] {
  if (systems.length === 0) return [];
  const warnings: string[] = [];
  for (const dimension of Object.keys(TIERS_BY_DIMENSION) as Dimension[]) {
    const counts = new Map<string, number>();
    for (const system of systems) counts.set(system.quality[dimension].tier, (counts.get(system.quality[dimension].tier) ?? 0) + 1);
    for (const [tier, count] of counts) if (count / systems.length > 0.7) {
      warnings.push(`${dimension} grading is concentrated: ${count}/${systems.length} systems are ${tier}`);
    }
  }
  return warnings;
}
