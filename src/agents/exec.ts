/**
 * SWE 3: Cat Agent Runtime - process execution helpers
 *
 * Thin wrapper around child_process.spawn with a hard wall-clock timeout.
 * Every external command the Repair Cat runs (git, npm, vibe) goes through
 * here so timeouts and output capture behave identically everywhere.
 */

import { spawn } from "child_process";

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  /** Combined stdout + stderr in arrival order is not preserved; use for matching only. */
  output: string;
  timedOut: boolean;
}

export interface RunOptions {
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Run a command to completion. Never rejects on a non-zero exit code - the
 * caller decides what a failure means, since a failing test suite is an
 * expected outcome rather than an error.
 */
export function run(
  command: string,
  args: string[],
  options: RunOptions
): Promise<RunResult> {
  const { cwd, timeoutMs = 120_000, env } = options;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
      // stdin must be closed, not an idle pipe. Vibe's programmatic mode
      // blocks waiting on stdin if it stays open, which reads as a hang and
      // burns the entire time budget without emitting anything.
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const finish = (code: number | null) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, output: stdout + stderr, timedOut });
    };

    child.on("error", (error) => {
      stderr += `\n${error.message}`;
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}
