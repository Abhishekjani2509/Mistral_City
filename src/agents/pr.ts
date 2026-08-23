/**
 * SWE 3: Cat Agent Runtime - pull request submission
 *
 * After a verified repair, push the change to the repository the cat was
 * working in and open a pull request against it. That repository is the one
 * the user connected in the city, so the PR lands where they expect.
 *
 * This only ever runs after the verification command has passed. An
 * unverified change must never reach someone's repository.
 */

import path from "path";
import { run } from "./exec";

export interface PullRequestInput {
  /** Repository the cat repaired - normally the clone made for the city. */
  repoPath: string;
  runId: string;
  /** Files the cat actually changed, relative to repoPath. */
  changedFiles: string[];
  issueSummary: string;
  /** What the agent said it did. */
  repairSummary: string;
  verification: {
    command: string;
    testsPassed: number;
    testsFailed: number;
  };
}

export interface PullRequestResult {
  ok: boolean;
  url?: string;
  /** Why no PR was opened, for the event details. */
  reason?: string;
}

/** A GitHub remote we could actually open a PR against. */
async function githubRemote(repoPath: string): Promise<string | null> {
  const result = await run("git", ["remote", "get-url", "origin"], {
    cwd: repoPath,
    timeoutMs: 15_000,
  });
  if (result.code !== 0) return null;
  const url = result.stdout.trim();
  return /github\.com/i.test(url) ? url : null;
}

/** The authenticated account, needed to qualify a fork's head branch. */
async function accountLogin(repoPath: string): Promise<string> {
  const result = await run("gh", ["api", "user", "--jq", ".login"], {
    cwd: repoPath,
    timeoutMs: 20_000,
  });
  return result.code === 0 ? result.stdout.trim() : "";
}

function buildBody(input: PullRequestInput): string {
  const { issueSummary, repairSummary, verification, changedFiles } = input;
  return [
    "Opened by **Repair Cat**, a Mistral coding agent running in Mistral City.",
    "",
    `**Issue** — ${issueSummary}`,
    "",
    `**What changed** — ${repairSummary}`,
    "",
    "**Files**",
    ...changedFiles.map((file) => `- \`${file}\``),
    "",
    "**Verification**",
    "",
    "```",
    `${verification.command}`,
    `${verification.testsPassed} passed, ${verification.testsFailed} failed`,
    "```",
    "",
    "The agent reproduced the failure before editing, and this pull request",
    "was opened only after the command above passed. The change was made by",
    "the agent; please review it as you would any other contribution.",
  ].join("\n");
}

/**
 * Push the repair to a branch and open a pull request.
 *
 * Every failure path is non-fatal and reported through `reason`: a repair
 * that could not be submitted is still a real repair, and the run should not
 * be reported as failed because the user lacks push access.
 */
export async function openPullRequest(
  input: PullRequestInput
): Promise<PullRequestResult> {
  const { repoPath, runId, changedFiles } = input;

  if (changedFiles.length === 0) {
    return { ok: false, reason: "No files changed, so there is nothing to submit." };
  }

  const remote = await githubRemote(repoPath);
  if (!remote) {
    return { ok: false, reason: "This repository has no GitHub origin remote." };
  }

  const gh = await run("gh", ["auth", "status"], { cwd: repoPath, timeoutMs: 20_000 });
  if (gh.code !== 0) {
    return { ok: false, reason: "The GitHub CLI is not authenticated." };
  }

  const branch = `mistral-city/repair-${runId}`;
  const title = `Repair Cat: ${input.issueSummary}`;

  const checkout = await run("git", ["checkout", "-b", branch], {
    cwd: repoPath,
    timeoutMs: 20_000,
  });
  if (checkout.code !== 0) {
    return { ok: false, reason: `Could not create branch ${branch}.` };
  }

  // Stage only what the cat actually touched, so unrelated local state in the
  // clone never rides along into someone's pull request.
  const add = await run("git", ["add", "--", ...changedFiles.map((f) => path.normalize(f))], {
    cwd: repoPath,
    timeoutMs: 20_000,
  });
  if (add.code !== 0) {
    return { ok: false, reason: "Could not stage the repaired files." };
  }

  const commit = await run(
    "git",
    ["commit", "-m", `${title}\n\n${input.repairSummary}\n\nVerified with: ${input.verification.command}`],
    { cwd: repoPath, timeoutMs: 30_000 }
  );
  if (commit.code !== 0) {
    return { ok: false, reason: "Could not commit the repair." };
  }

  // Direct push works only on repositories the account can write to. For any
  // other public repository the contribution has to come from a fork, which
  // is the normal way an outside contributor opens a pull request.
  let pushRemote = "origin";
  const push = await run("git", ["push", "-u", "origin", branch], {
    cwd: repoPath,
    timeoutMs: 120_000,
  });

  if (push.code !== 0) {
    const fork = await run(
      "gh",
      ["repo", "fork", "--remote", "--remote-name", "mistral-city-fork", "--clone=false"],
      { cwd: repoPath, timeoutMs: 120_000 }
    );
    if (fork.code !== 0) {
      return {
        ok: false,
        reason: "No write access, and the repository could not be forked.",
      };
    }

    pushRemote = "mistral-city-fork";
    const forkPush = await run("git", ["push", "-u", pushRemote, branch], {
      cwd: repoPath,
      timeoutMs: 120_000,
    });
    if (forkPush.code !== 0) {
      return { ok: false, reason: "Could not push the branch to the fork." };
    }
  }

  // From a fork the head must be qualified as owner:branch so GitHub knows
  // which side of the pull request the commits live on.
  const head =
    pushRemote === "origin" ? branch : `${await accountLogin(repoPath)}:${branch}`;

  const pr = await run(
    "gh",
    ["pr", "create", "--title", title, "--body", buildBody(input), "--head", head],
    { cwd: repoPath, timeoutMs: 120_000 }
  );
  if (pr.code !== 0) {
    return {
      ok: false,
      reason: "Branch pushed, but the pull request could not be opened.",
    };
  }

  const url = pr.stdout.trim().split("\n").find((line) => line.startsWith("http"));
  return { ok: true, ...(url ? { url } : {}) };
}
