import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { CityModel } from "../contracts/city-model";

const execFileAsync = promisify(execFile);

export type RepositoryStreamEvent =
  | { type: "repository.started"; data: { url: string } }
  | { type: "repository.cloned"; data: { name: string } }
  | { type: "city.model"; data: CityModel };

export function normalizeGitHubUrl(input: string): { cloneUrl: string; name: string } {
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

  return { cloneUrl: `https://github.com/${owner}/${name}.git`, name };
}

export async function cloneGitHubRepository(input: string): Promise<{
  cloneUrl: string;
  name: string;
  root: string;
  cleanup: () => Promise<void>;
}> {
  const { cloneUrl, name } = normalizeGitHubUrl(input);
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

  return {
    cloneUrl,
    name,
    root,
    cleanup: () => rm(tempRoot, { recursive: true, force: true }),
  };
}
