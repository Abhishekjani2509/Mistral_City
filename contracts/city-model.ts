import type { CityIssue } from "./cat-events";

export type SystemKind =
  | "frontend"
  | "backend"
  | "auth"
  | "api"
  | "database"
  | "external"
  | "tests"
  | "documentation"
  | "unknown";

export type HealthStatus = "healthy" | "warning" | "broken" | "unknown";

export type ConnectionKind =
  | "calls"
  | "reads"
  | "writes"
  | "authenticates"
  | "tests"
  | "depends_on";

export interface HealthSignal {
  kind:
    | "failing_test"
    | "runtime_error"
    | "build_error"
    | "missing_test"
    | "low_confidence";
  label: string;
  severity: "info" | "warning" | "error";
  evidence: string[];
}

export interface CitySystem {
  id: string;
  name: string;
  kind: SystemKind;
  description: string;
  files: string[];
  entrypoints?: string[];
  health: number;
  status: HealthStatus;
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

export interface CityModel {
  schema: "mistral.city-model/v1";
  repository: {
    name: string;
    detectedStack: string[];
    analyzedAt: string;
  };
  city: {
    health: number;
    status: HealthStatus;
    energy: number;
  };
  systems: CitySystem[];
  connections: CityConnection[];
}
