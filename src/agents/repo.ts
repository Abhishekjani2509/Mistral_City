/**
 * SWE 3: Cat Agent Runtime - repository inspection
 *
 * Everything the Repair Cat needs to observe the target repository: which
 * files actually changed, and whether the verification command passes.
 *
 * Changed files are *observed* from git rather than taken from the model's
 * word, so `changedFiles` in the event stream always reflects reality.
 */

import fs from "fs/promises";
import path from "path";
import { run } from "./exec";

export interface TestOutcome {
  command: string;
  passed: number;
  failed: number;
  /** True only when the runner exited 0. */
  ok: boolean;
  timedOut: boolean;
  /**
   * The repository defines no such script, so there is nothing to verify
   * against. Distinct from `!ok`: a failing suite is a repairable signal,
   * a missing runner means no repair can ever be proven.
   */
  missingScript: boolean;
  /** Trimmed tail of the runner output, for FAILED event details. */
  details: string;
}

/**
 * Resolve the git worktree containing `repoPath`.
 *
 * The demo repo is tracked inside the parent project rather than being its
 * own repository, so the git root is usually an ancestor of repoPath. All
 * path arithmetic below accounts for that.
 */
export async function gitRoot(repoPath: string): Promise<string | null> {
  const result = await run("git", ["rev-parse", "--show-toplevel"], {
    cwd: repoPath,
    timeoutMs: 15_000,
  });
  if (result.code !== 0) return null;
  return result.stdout.trim() || null;
}

/**
 * Files modified inside `repoPath`, as paths relative to `repoPath`.
 *
 * Includes tracked modifications and untracked new files, so a fix that adds
 * a file is reported as faithfully as one that edits in place.
 */
export async function changedFiles(repoPath: string): Promise<string[]> {
  const root = await gitRoot(repoPath);
  if (!root) return [];

  // Paths git reports are relative to the worktree root; strip the prefix so
  // callers receive paths relative to the repository under repair.
  const prefix = path.relative(root, repoPath);
  const toRepoRelative = (line: string): string | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const rel = prefix ? path.relative(prefix, trimmed) : trimmed;
    // Anything outside repoPath (e.g. sibling agent code) is not ours to report.
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return rel;
  };

  const [modified, untracked] = await Promise.all([
    run("git", ["diff", "--name-only", "--", repoPath], {
      cwd: root,
      timeoutMs: 15_000,
    }),
    run("git", ["ls-files", "--others", "--exclude-standard", "--", repoPath], {
      cwd: root,
      timeoutMs: 15_000,
    }),
  ]);

  const files = [...modified.stdout.split("\n"), ...untracked.stdout.split("\n")]
    .map(toRepoRelative)
    .filter((value): value is string => value !== null);

  return [...new Set(files)].sort();
}

/**
 * The actual patch the cat produced, as a unified diff.
 *
 * This is what makes a repair inspectable rather than something the user has
 * to take on trust: the city can show the real before/after instead of only
 * a list of filenames. Read-only - it never stages or mutates anything.
 *
 * Covers tracked edits, which is what a repair to existing code produces. A
 * brand new file shows up in `changedFiles` but has no diff to render.
 */
export async function unifiedDiff(
  repoPath: string,
  files: string[],
  maxChars = 6000
): Promise<string> {
  if (files.length === 0) return "";

  const result = await run("git", ["diff", "--", ...files], {
    cwd: repoPath,
    timeoutMs: 20_000,
  });
  if (result.code !== 0) return "";

  const patch = result.stdout.trim();
  if (patch.length <= maxChars) return patch;
  return `${patch.slice(0, maxChars)}\n... diff truncated ...`;
}

/** Restore `repoPath` to its committed state, discarding agent edits. */
export async function resetRepo(repoPath: string): Promise<void> {
  const root = await gitRoot(repoPath);
  if (!root) return;
  await run("git", ["checkout", "--", repoPath], { cwd: root, timeoutMs: 30_000 });
  await run("git", ["clean", "-fd", "--", repoPath], { cwd: root, timeoutMs: 30_000 });
}

/**
 * Can this repository run the verification command at all?
 *
 * Checked before repairing rather than inferred from npm's stderr. npm fails
 * differently for a missing script and a missing package.json, and matching
 * that text was already wrong twice: both look like "the command failed",
 * which the cat would otherwise read as a reproduced bug and try to fix.
 */
export async function verifyCommandAvailable(
  repoPath: string,
  args: string[]
): Promise<{ available: boolean; reason?: string }> {
  const manifestPath = path.join(repoPath, "package.json");

  let manifest: { scripts?: Record<string, string> };
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
  } catch {
    return { available: false, reason: "it has no package.json" };
  }

  // `npm test` runs scripts.test; `npm run <name>` runs scripts[name].
  const script = args[0] === "run" ? args[1] : args[0];
  if (!script) return { available: false, reason: "no verification command was given" };

  if (!manifest.scripts?.[script]) {
    return { available: false, reason: `it defines no "${script}" script` };
  }

  return { available: true };
}

/**
 * Parse a Jest summary line: "Tests: 1 failed, 2 passed, 3 total".
 * Absent counts mean zero rather than unknown.
 */
export function parseJestSummary(output: string): { passed: number; failed: number } {
  const line = output.match(/Tests:\s+(.+)/);
  if (!line) return { passed: 0, failed: 0 };
  const failed = line[1].match(/(\d+)\s+failed/);
  const passed = line[1].match(/(\d+)\s+passed/);
  return {
    passed: passed ? Number(passed[1]) : 0,
    failed: failed ? Number(failed[1]) : 0,
  };
}

/**
 * Run the verification command. A non-zero exit is a normal result, not an
 * error - the caller turns it into a TESTING/FAILED event.
 */
export async function runTests(
  repoPath: string,
  args: string[] = ["test"],
  timeoutMs = 180_000
): Promise<TestOutcome> {
  const result = await run("npm", args, { cwd: repoPath, timeoutMs });
  const { passed, failed } = parseJestSummary(result.output);

  return {
    command: `npm ${args.join(" ")}`,
    passed,
    failed,
    ok: result.code === 0 && !result.timedOut,
    timedOut: result.timedOut,
    missingScript: /Missing script/i.test(result.output),
    details: result.output.trim().slice(-2000),
  };
}
