import type { Dimension, Finding, HardSignals, QualityBlock, Status, SystemModel, Tier } from "./schema.js";

const TIER_SCORE: Record<Tier, number> = {
  fortified: 100, breachable: 65, undefended: 25,
  load_bearing: 100, strained: 65, buckling: 25,
  forged: 100, sputtering: 65, cold_forge: 25,
  well_walled: 100, tangled: 65, labyrinth: 25,
};
const WEIGHTS: Record<Dimension, number> = { security: 0.3, scalability: 0.2, deployment: 0.2, modularity: 0.3 };
const FINDING_DIMENSION_MULTIPLIER: Record<Dimension, number> = { security: 1.2, scalability: 1, deployment: 1.1, modularity: 0.85 };
const REPEAT_MULTIPLIER = [1, 0.65, 0.45, 0.35, 0.3, 0.25] as const;

export function hardSignalScore(signals: HardSignals = {}): number {
  let score = 100;
  if ((signals.failingTests?.length ?? 0) > 0) score -= 45;
  score -= Math.min(30, new Set(signals.runtimeErrorClasses ?? []).size * 15);
  if (signals.coverage !== undefined) score -= 20 * (1 - clamp(signals.coverage, 0, 1));
  return clamp(score, 0, 100);
}

export function dimensionScore(quality: QualityBlock): number {
  return (Object.keys(WEIGHTS) as Dimension[]).reduce(
    (score, dimension) => score + WEIGHTS[dimension] * TIER_SCORE[quality[dimension].tier], 0,
  );
}

export function systemHealth(quality: QualityBlock, signals: HardSignals = {}, findings: Finding[] = []): number {
  const base = 0.4 * hardSignalScore(signals) + 0.6 * dimensionScore(quality);
  let score = base - verifiedFindingPenalty(findings);
  const nonTestCritical = findings.filter((finding) => finding.severity === "critical" && !isFailingTest(finding));
  const criticalSecurity = nonTestCritical.filter((finding) => finding.dimension === "security" && finding.confidence >= 0.8);
  const criticalOperational = nonTestCritical.filter((finding) => /(?:runtime|build|crash|outage)/i.test(finding.type));
  if (criticalSecurity.length >= 2) score = Math.min(score, 35);
  else if (criticalSecurity.length === 1) score = Math.min(score, 55);
  if (criticalOperational.length > 0) score = Math.min(score, 45);
  else if (nonTestCritical.length >= 2) score = Math.min(score, 49);
  else if (nonTestCritical.length === 1) score = Math.min(score, 64);
  return Math.round(clamp(score, 0, 100));
}

/** Findings are verified against source before reaching this function. */
export function verifiedFindingPenalty(findings: Finding[]): number {
  let penalty = 0;
  for (const dimension of Object.keys(WEIGHTS) as Dimension[]) {
    const ranked = findings
      .filter((finding) => finding.dimension === dimension)
      .sort((a, b) => findingImpact(b) - findingImpact(a));
    ranked.forEach((finding, index) => {
      const repeat = REPEAT_MULTIPLIER[Math.min(index, REPEAT_MULTIPLIER.length - 1)]!;
      penalty += findingImpact(finding) * FINDING_DIMENSION_MULTIPLIER[dimension] * repeat;
    });
  }
  return Math.min(60, penalty);
}

export function systemStatus(
  health: number,
  findings: Finding[],
  signals: HardSignals,
  discoveryConfidence: number,
  deeplyAnalyzed: boolean,
): Status {
  if (discoveryConfidence < 0.55 || !deeplyAnalyzed) return "unknown";
  const critical = findings.filter((finding) => finding.severity === "critical" && !isFailingTest(finding));
  const confirmedSecurityFailure = critical.some((finding) => finding.dimension === "security" && finding.confidence >= 0.8);
  const confirmedOperationalFailure = critical.some((finding) => /(?:runtime|build|crash|outage)/i.test(finding.type));
  const hasHardFailure = (signals.failingTests?.length ?? 0) > 0 || (signals.runtimeErrorClasses?.length ?? 0) > 0;
  if (hasHardFailure || confirmedSecurityFailure || confirmedOperationalFailure || critical.length >= 2 || health < 45) return "broken";
  if (health < 80 || findings.some((finding) => finding.severity === "major" || finding.severity === "critical")) return "warning";
  return "healthy";
}

export function cityHealth(systems: SystemModel[]): number {
  const known = systems.filter((system) => system.status !== "unknown");
  if (known.length === 0) return 0;
  const totalFiles = known.reduce((sum, system) => sum + Math.max(1, system.files.length), 0);
  const raw = known.reduce((sum, system) => sum + system.health * Math.max(1, system.files.length), 0) / totalFiles;
  const brokenFiles = known.filter((system) => system.status === "broken").reduce((sum, system) => sum + Math.max(1, system.files.length), 0);
  const unhealthyFiles = known.filter((system) => system.status === "broken" || system.status === "warning").reduce((sum, system) => sum + Math.max(1, system.files.length), 0);
  const brokenShare = brokenFiles / totalFiles;
  const unhealthyShare = unhealthyFiles / totalFiles;
  const brokenCapped = brokenShare >= 0.5 ? Math.min(raw, 49) : brokenShare >= 0.25 ? Math.min(raw, 69) : brokenShare > 0 ? Math.min(raw, 84) : raw;
  const capped = unhealthyShare >= 0.5 ? Math.min(brokenCapped, 79) : unhealthyShare >= 0.25 ? Math.min(brokenCapped, 84) : brokenCapped;
  return Math.round(capped);
}

export function calibrateAuthenticationAcceptance(before: number, after: number): { passes: boolean; message: string } {
  const passes = before >= 60 && before <= 70 && after > 90;
  return { passes, message: passes ? "Authentication hero delta is calibrated." : `Expected Authentication at 60–70 before and >90 after; received ${before} and ${after}.` };
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
function isFailingTest(finding: Finding): boolean { return /(?:failing[_-]?test|test[_-]?failure)/i.test(finding.type); }
function findingImpact(finding: Finding): number {
  if (isFailingTest(finding)) return 6 * finding.confidence;
  const severity = { info: 0, minor: 1.5, major: 4, critical: 14 }[finding.severity];
  return severity * (0.5 + 0.5 * finding.confidence);
}
