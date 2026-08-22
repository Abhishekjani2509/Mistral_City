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
  const specific = finding.technicalDescription
    .replace(/^WSTG-[A-Z]+-\d+:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (specific) return /[.!?]$/.test(specific) ? specific : `${specific}.`;
  return finding.severity === "critical"
    ? "A confirmed weakness can expose people or their data."
    : "Mistral found a specific weakness that needs review.";
}
