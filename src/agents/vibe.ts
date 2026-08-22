/**
 * SWE 3: Cat Agent Runtime - Mistral Vibe invocation
 *
 * The Repair Cat does not ask the model for a JSON patch and apply it
 * itself. Vibe already has file-editing and shell tools, so it edits the
 * repository directly and we observe the result through git. That removes
 * the brittle exact-string replacement step and means `changedFiles` is
 * measured rather than claimed.
 *
 * Flags are those of vibe 2.24.3:
 *   -p / --prompt   programmatic mode, takes prompt TEXT (not a file)
 *   --output        text | json | streaming
 *   --workdir       directory the agent operates in
 *   --auto-approve  run tools without interactive approval
 *   --max-turns / --max-price  budget guards
 */

import { run, RunResult } from "./exec";
import { CityIssue } from "../../contracts/cat-events";

export interface VibeOptions {
  repoPath: string;
  timeoutMs?: number;
  maxTurns?: number;
  maxPrice?: number;
}

export interface VibeResult {
  ok: boolean;
  timedOut: boolean;
  /** Vibe's final assistant text, when it could be recovered. */
  summary: string;
  raw: RunResult;
}

/**
 * Build the repair instruction.
 *
 * Deliberately does not name the fix. Telling the agent "use localStorage"
 * would make a passing demo prove nothing about the agent - it has to reach
 * the root cause from the failing test.
 */
export function buildRepairPrompt(issue: CityIssue, verifyCommand: string): string {
  return [
    "You are Repair Cat, a focused debugging agent working in this repository.",
    "",
    `Problem: ${issue.summary}`,
    `Details: ${issue.description}`,
    issue.reproduction ? `Reproduction: ${issue.reproduction}` : "",
    `Relevant files: ${issue.files.join(", ")}`,
    "",
    "Do the following:",
    `1. Run \`${verifyCommand}\` and read the failure carefully.`,
    "2. Determine the root cause by reading the implementation and the test.",
    "3. Make the smallest change to the implementation that fixes the root cause.",
    "4. Do not edit, weaken, skip, or delete any test in order to pass.",
    `5. Re-run \`${verifyCommand}\` and confirm every test passes.`,
    "",
    "Finish with one short sentence describing what you changed and why.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Extract the agent's closing message from `--output json`.
 *
 * The exact envelope shape is not contractual, so this walks the payload
 * defensively and falls back to raw stdout rather than failing the run over
 * a formatting change.
 */
export function extractSummary(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    const messages: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as any)?.messages)
        ? (parsed as any).messages
        : [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i] as any;
      if (message?.role && message.role !== "assistant") continue;
      const content = message?.content;
      if (typeof content === "string" && content.trim()) return content.trim();
      if (Array.isArray(content)) {
        const text = content
          .map((part: any) => (typeof part === "string" ? part : part?.text ?? ""))
          .join(" ")
          .trim();
        if (text) return text;
      }
    }

    if (typeof (parsed as any)?.result === "string") return (parsed as any).result.trim();
  } catch {
    // Not JSON - fall through to the raw tail.
  }

  return trimmed.slice(-500);
}

/** Run Vibe against the repository and let it apply its own edits. */
export async function runVibeRepair(
  issue: CityIssue,
  verifyCommand: string,
  options: VibeOptions
): Promise<VibeResult> {
  const { repoPath, timeoutMs = 300_000, maxTurns = 20, maxPrice = 1.0 } = options;

  const result = await run(
    "vibe",
    [
      "-p",
      buildRepairPrompt(issue, verifyCommand),
      "--output",
      "json",
      "--workdir",
      repoPath,
      "--auto-approve",
      "--max-turns",
      String(maxTurns),
      "--max-price",
      String(maxPrice),
    ],
    { cwd: repoPath, timeoutMs }
  );

  return {
    ok: result.code === 0 && !result.timedOut,
    timedOut: result.timedOut,
    summary: extractSummary(result.stdout),
    raw: result,
  };
}
