import type { Dimension, Finding, RawFinding, RepoFile } from "./schema.js";

export interface VerificationResult {
  findings: Finding[];
  dropped: Array<{ finding: RawFinding; reason: string }>;
}

export function verifyFindings(
  rawFindings: RawFinding[],
  dimension: Dimension,
  plainDescriptions: Record<string, string> = {},
  files: RepoFile[],
): VerificationResult {
  const byPath = new Map(files.map((file) => [normalize(file.path), file]));
  const findings: Finding[] = [];
  const dropped: VerificationResult["dropped"] = [];
  for (const raw of rawFindings) {
    const file = byPath.get(normalize(raw.file));
    if (!file) { dropped.push({ finding: raw, reason: "file does not exist in system input" }); continue; }
    const lines = file.content.split(/\r?\n/);
    const actual = lines[raw.line - 1];
    if (actual === undefined) { dropped.push({ finding: raw, reason: "line does not exist" }); continue; }
    if (!snippetMatches(actual, raw.evidence)) {
      dropped.push({ finding: raw, reason: "evidence is not present at the cited line" });
      continue;
    }
    findings.push({
      ...raw,
      file: normalize(raw.file),
      dimension,
      plainDescription: plainDescriptions[raw.id] ?? fallbackPlainDescription(raw),
    });
  }
  return { findings, dropped };
}

function snippetMatches(line: string, evidence: string): boolean {
  const compact = (value: string) => value.trim().replace(/\s+/g, " ");
  const actual = compact(line);
  const claimed = compact(evidence);
  return claimed.length >= 3 && (actual.includes(claimed) || claimed.includes(actual));
}

function normalize(path: string): string { return path.replace(/^\.\//, "").replaceAll("\\", "/"); }

function fallbackPlainDescription(finding: RawFinding): string {
  if (finding.severity === "critical") return "This can cause the feature to fail or put users at risk.";
  if (finding.severity === "major") return "This part could break in an important situation.";
  return "This could make the feature less reliable over time.";
}
