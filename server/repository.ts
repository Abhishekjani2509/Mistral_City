import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { CityModel } from "../contracts/city-model";
import type { IssueSourceLink } from "../contracts/issue-sources";

type AnalysisIssueSource = Omit<IssueSourceLink, "url">;

const execFileAsync = promisify(execFile);

export type RepositoryStreamEvent =
  | { type: "repository.started"; data: { url: string } }
  | { type: "repository.cloned"; data: { name: string } }
  | { type: "city.model"; data: CityModel };

export function normalizeGitHubUrl(input: string): { cloneUrl: string; webUrl: string; name: string } {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Paste a valid GitHub repository URL.");
  }

  if (parsed.protocol !== "https:" || !["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase())) {
    throw new Error("Only public https://github.com/{owner}/{repository} URLs are supported.");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error("Use a repository URL such as https://github.com/mistralai/cookbook.");
  }

  const owner = segments[0];
  const name = segments[1].replace(/\.git$/, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error("The GitHub owner or repository name is invalid.");
  }

  const webUrl = `https://github.com/${owner}/${name}`;
  return { cloneUrl: `${webUrl}.git`, webUrl, name };
}

export function buildGitHubIssueSources(
  sources: readonly AnalysisIssueSource[],
  webUrl: string,
  revision: string,
): IssueSourceLink[] {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(webUrl)) {
    throw new Error("Cannot create issue links for an invalid GitHub repository URL.");
  }
  if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error("Cannot create issue links without an exact Git revision.");

  return sources.flatMap((source) => {
    if (!isSafeRelativePath(source.file) || !Number.isInteger(source.line) || source.line < 1) return [];
    const encodedPath = source.file.split("/").map(encodeURIComponent).join("/");
    return [{ ...source, url: `${webUrl}/blob/${revision}/${encodedPath}#L${source.line}` }];
  });
}

export async function cloneGitHubRepository(input: string): Promise<{
  cloneUrl: string;
  webUrl: string;
  name: string;
  revision: string;
  root: string;
  cleanup: () => Promise<void>;
}> {
  const { cloneUrl, webUrl, name } = normalizeGitHubUrl(input);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mistral-city-repo-"));
  const root = path.join(tempRoot, "repo");

  try {
    await execFileAsync("git", ["clone", "--depth", "1", "--single-branch", "--no-tags", cloneUrl, root], {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not clone ${name}: ${detail}`);
  }

  let revision: string;
  try {
    const { stdout } = await execFileAsync("git", ["-C", root, "rev-parse", "HEAD"], {
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    revision = stdout.trim();
    if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error("Git returned an invalid revision.");
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not resolve the cloned revision for ${name}: ${detail}`);
  }

  return {
    cloneUrl,
    webUrl,
    name,
    revision,
    root,
    cleanup: () => rm(tempRoot, { recursive: true, force: true }),
  };
}

function isSafeRelativePath(value: string): boolean {
  return Boolean(value)
    && !value.startsWith("/")
    && !value.startsWith("../")
    && !value.includes("/../")
    && !/^[A-Za-z]:[\\/]/.test(value);
}
