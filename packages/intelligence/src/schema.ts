import { z } from "zod";

export const BUILDING_TYPES = [
  "tower", "gate", "vault", "workshop", "district", "library", "port", "depot", "guard_tower",
] as const;
export const DIMENSIONS = ["security", "scalability", "deployment", "modularity"] as const;
export const SEVERITIES = ["info", "minor", "major", "critical"] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];
export type Dimension = (typeof DIMENSIONS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Status = "unknown" | "broken" | "warning" | "healthy";

export const tierSchema = z.enum([
  "fortified", "breachable", "undefended",
  "load_bearing", "strained", "buckling",
  "forged", "sputtering", "cold_forge",
  "well_walled", "tangled", "labyrinth",
]);
export type Tier = z.infer<typeof tierSchema>;

export const discoveredSystemSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  plainDescription: z.string().min(1),
  buildingType: z.enum(BUILDING_TYPES),
  files: z.array(z.string()),
  connections: z.array(z.string()),
  discoveryConfidence: z.number().min(0).max(1),
});
export type DiscoveredSystem = z.infer<typeof discoveredSystemSchema>;

export const rawFindingSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  technicalDescription: z.string().min(1),
  file: z.string().min(1),
  line: z.number().int().positive(),
  evidence: z.string().min(1),
  severity: z.enum(SEVERITIES),
  confidence: z.number().min(0).max(1),
});
export type RawFinding = z.infer<typeof rawFindingSchema>;

export const findingSchema = rawFindingSchema.extend({
  dimension: z.enum(DIMENSIONS),
  plainDescription: z.string().min(1),
});
export type Finding = z.infer<typeof findingSchema>;

export const rawGradeSchema = z.object({
  tier: tierSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  findings: z.array(rawFindingSchema).max(12),
});
export type RawGrade = z.infer<typeof rawGradeSchema>;

export interface QualityGrade {
  tier: Tier;
  confidence: number;
  rationale: string;
  findingIds: string[];
}

export interface QualityBlock {
  security: QualityGrade;
  scalability: QualityGrade;
  deployment: QualityGrade;
  modularity: QualityGrade;
}

export interface ModelRun {
  model: string;
  promptVersion: string;
  tokens: number;
  cached: boolean;
}

export interface SystemModel extends DiscoveredSystem {
  health: number;
  status: Status;
  issues: Finding[];
  quality: QualityBlock;
  deeplyAnalyzed: boolean;
  modelRun: ModelRun;
}

/** Internal, evidence-rich result. Never send this to the renderer. */
export interface AnalysisModel {
  city: { health: number; schemaVersion: "1.0.0" };
  systems: SystemModel[];
  warnings: string[];
}

export type SystemKind = "frontend" | "backend" | "auth" | "api" | "database" | "external" | "tests" | "documentation" | "unknown";
export type ConnectionKind = "calls" | "reads" | "writes" | "authenticates" | "tests" | "depends_on";
export type HealthSignalKind = "failing_test" | "runtime_error" | "build_error" | "missing_test" | "low_confidence";

export interface HealthSignal {
  kind: HealthSignalKind;
  label: string;
  severity: "info" | "warning" | "error";
  evidence: string[];
}

export interface CityIssue {
  id: string;
  type: "failing_test" | "runtime_error" | "build_error" | "unknown";
  summary: string;
  description: string;
  files: string[];
  reproduction?: string;
}

export interface CitySystem {
  id: string;
  name: string;
  kind: SystemKind;
  description: string;
  files: string[];
  entrypoints?: string[];
  health: number;
  status: Status;
  healthSignals: HealthSignal[];
  issues: CityIssue[];
  confidence: number;
}

export interface CityConnection {
  id: string;
  from: string;
  to: string;
  kind: ConnectionKind;
  label?: string;
  evidence: string[];
  confidence: number;
}

/** Frozen SWE 2 → SWE 1 renderer contract. */
export interface CityModel {
  schema: "mistral.city-model/v1";
  repository: { name: string; detectedStack: string[]; analyzedAt: string };
  city: { health: number; status: Status };
  systems: CitySystem[];
  connections: CityConnection[];
}

export interface HardSignals {
  failingTests?: Array<{ name: string; systemId?: string; file?: string; line?: number; evidence?: string }>;
  runtimeErrorClasses?: string[];
  coverage?: number;
}

export interface RepoFile {
  path: string;
  content: string;
}

export interface RepoSnapshot {
  root: string;
  repoName: string;
  files: RepoFile[];
  hardSignals?: Record<string, HardSignals>;
  analyzedAt?: string;
}

export const guardGapSchema = z.object({
  behaviour: z.string().min(1),
  whyItMatters: z.string().min(1),
  suggestedTestName: z.string().min(1),
  files: z.array(z.string()),
  priority: z.number().int().min(1).max(5),
  blastRadius: z.number().min(0).max(1),
});
export type GuardGap = z.infer<typeof guardGapSchema>;

export type AnalysisEvent =
  | { type: "analysis.started"; data: { repoName: string; estimatedSystems: number } }
  | { type: "system.discovered"; data: { id: string; name: string; kind: SystemKind; description: string; confidence: number } }
  | { type: "system.connected"; data: { from: string; to: string } }
  | { type: "system.graded"; data: { id: string; health: number; status: Status } }
  | { type: "system.revealed"; data: SystemModel }
  | { type: "agent.progress"; data: { systemId: string; step: string; plainText: string } }
  | { type: "system.rescanned"; data: { id: string; healthBefore: number; healthAfter: number } }
  | { type: "city.health"; data: { value: number } }
  | { type: "analysis.complete"; data: { cityHealth: number; systemCount: number; warnings: string[] } };

export type EventSink = (event: AnalysisEvent) => void | Promise<void>;

export const TIERS_BY_DIMENSION: Record<Dimension, readonly [Tier, Tier, Tier]> = {
  security: ["fortified", "breachable", "undefended"],
  scalability: ["load_bearing", "strained", "buckling"],
  deployment: ["forged", "sputtering", "cold_forge"],
  modularity: ["well_walled", "tangled", "labyrinth"],
};
