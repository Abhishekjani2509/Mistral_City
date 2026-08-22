import type { Dimension, Finding, HardSignals, QualityBlock, Status, SystemModel, Tier } from "./schema.js";

const TIER_SCORE: Record<Tier, number> = {
  fortified: 100, breachable: 65, undefended: 25,
  load_bearing: 100, strained: 65, buckling: 25,
  forged: 100, sputtering: 65, cold_forge: 25,
  well_walled: 100, tangled: 65, labyrinth: 25,
};
const WEIGHTS: Record<Dimension, number> = { security: 0.3, scalability: 0.2, deployment: 0.2, modularity: 0.3 };

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
  const evidenceAdjustedSignals = Math.max(0, hardSignalScore(signals) - securityEvidencePenalty(findings));
  return Math.round(0.6 * evidenceAdjustedSignals + 0.4 * dimensionScore(quality));
}

/** Verified security evidence is a hard signal, unlike an unverified model opinion. */
export function securityEvidencePenalty(findings: Finding[]): number {
  const penalty = findings
    .filter((finding) => finding.dimension === "security")
    .reduce((sum, finding) => sum + ({ info: 0, minor: 2, major: 7, critical: 20 }[finding.severity]), 0);
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
  if (findings.some((finding) => finding.severity === "critical") || (signals.failingTests?.length ?? 0) > 0 || health < 50) return "broken";
  if (health < 80 || findings.some((finding) => finding.severity === "major")) return "warning";
  return "healthy";
}

export function cityHealth(systems: SystemModel[]): number {
  const known = systems.filter((system) => system.status !== "unknown");
  if (known.length === 0) return 0;
  const totalFiles = known.reduce((sum, system) => sum + Math.max(1, system.files.length), 0);
  return Math.round(known.reduce((sum, system) => sum + system.health * Math.max(1, system.files.length), 0) / totalFiles);
}

export function calibrateAuthenticationAcceptance(before: number, after: number): { passes: boolean; message: string } {
  const passes = before >= 60 && before <= 70 && after > 90;
  return { passes, message: passes ? "Authentication hero delta is calibrated." : `Expected Authentication at 60–70 before and >90 after; received ${before} and ${after}.` };
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
