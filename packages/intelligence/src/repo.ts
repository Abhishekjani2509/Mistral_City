import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import type { RepoFile, RepoSnapshot } from "./schema.js";

const IGNORED = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".city-intel-cache", "target", "vendor"]);
const INCLUDED_NAMES = new Set([
  "readme", "dockerfile", "package.json", "tsconfig.json", "vite.config.ts", "next.config.js",
  "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts",
  "gradlew", "go.mod", "cargo.toml", "composer.json", "gemfile", "requirements.txt",
  "pyproject.toml", "makefile", "cmakelists.txt",
]);
const INCLUDED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".sql", ".md", ".yaml", ".yml", ".toml",
  ".java", ".kt", ".kts", ".groovy", ".gradle", ".xml", ".properties",
  ".py", ".go", ".rs", ".rb", ".php", ".cs", ".fs", ".vb",
  ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".swift", ".scala", ".sh", ".bash", ".zsh",
  ".html", ".css", ".scss", ".sass", ".vue", ".svelte",
]);
const DEFAULT_MAX_FILES = 3_000;
const MAX_CANDIDATE_FILES = 20_000;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_CONTENT_BYTES = 20 * 1024 * 1024;

export async function snapshotRepository(root: string, maxFiles = DEFAULT_MAX_FILES): Promise<RepoSnapshot> {
  const absoluteRoot = resolve(root);
  const collected = await collectCandidates(absoluteRoot, MAX_CANDIDATE_FILES);
  const selected = selectBalancedPaths(collected.paths, maxFiles);
  const files: RepoFile[] = [];
  let skippedLargeFiles = 0;
  let skippedForContentBudget = 0;
  let consumedBytes = 0;

  for (const path of selected) {
    const info = await stat(path);
    if (info.size > MAX_FILE_BYTES) {
      skippedLargeFiles += 1;
      continue;
    }
    if (consumedBytes + info.size > MAX_CONTENT_BYTES) {
      skippedForContentBudget += 1;
      continue;
    }
    try {
      const content = await readFile(path, "utf8");
      consumedBytes += info.size;
      files.push({ path: relative(absoluteRoot, path).replaceAll("\\", "/"), content });
    } catch {
      // A file can disappear or become unreadable between enumeration and read.
      skippedLargeFiles += 1;
    }
  }

  // A few oversized artifacts do not make the source tree incomplete. Only a
  // candidate/selection cap is treated as an incomplete architectural view.
  const truncated = collected.truncated || collected.paths.length > selected.length || skippedForContentBudget > 0;
  return {
    root: absoluteRoot,
    repoName: basename(absoluteRoot),
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    coverage: {
      candidateFiles: collected.paths.length,
      loadedFiles: files.length,
      skippedLargeFiles,
      truncated,
    },
  };
}

async function collectCandidates(root: string, maximum: number): Promise<{ paths: string[]; truncated: boolean }> {
  const directories = [root];
  const paths: string[] = [];

  // Breadth-first enumeration prevents one deeply nested directory from
  // consuming the whole budget before sibling modules are even considered.
  while (directories.length > 0) {
    const directory = directories.shift()!;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      if (IGNORED.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) directories.push(path);
      else if (isRelevant(entry.name)) paths.push(path);
      if (paths.length >= maximum) return { paths, truncated: true };
    }
  }
  return { paths, truncated: false };
}

function selectBalancedPaths(paths: string[], maximum: number): string[] {
  if (paths.length <= maximum) return [...paths].sort();
  const priority = paths.filter((path) => isPriorityFile(basename(path)));
  const selected = priority.sort((a, b) => a.localeCompare(b)).slice(0, maximum);
  const selectedSet = new Set(selected);
  const buckets = new Map<string, string[]>();
  for (const path of paths) {
    if (selectedSet.has(path)) continue;
    const key = sourceBucket(path);
    const bucket = buckets.get(key) ?? [];
    bucket.push(path);
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) bucket.sort((a, b) => stableHash(a) - stableHash(b) || a.localeCompare(b));
  const keys = [...buckets.keys()].sort();
  while (selected.length < maximum) {
    let added = false;
    for (const key of keys) {
      const path = buckets.get(key)?.shift();
      if (!path) continue;
      selected.push(path);
      added = true;
      if (selected.length === maximum) break;
    }
    if (!added) break;
  }
  return selected.sort();
}

function isRelevant(name: string): boolean {
  const lower = name.toLowerCase();
  return INCLUDED_NAMES.has(lower) || INCLUDED_EXTENSIONS.has(extname(lower));
}

function isPriorityFile(name: string): boolean { return INCLUDED_NAMES.has(name.toLowerCase()); }

function sourceBucket(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/");
  const sourceIndex = parts.lastIndexOf("src");
  if (sourceIndex > 0) return parts.slice(Math.max(0, sourceIndex - 1), Math.min(parts.length - 1, sourceIndex + 2)).join("/");
  return parts.slice(Math.max(0, parts.length - 4), -1).join("/") || parts[0]!;
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  return hash >>> 0;
}

export function selectDiscoverySamples(files: RepoFile[], limit = 24): RepoFile[] {
  const priority = files.filter((file) => discoveryScore(file.path) >= 100)
    .sort((a, b) => discoveryScore(b.path) - discoveryScore(a.path) || a.path.localeCompare(b.path))
    .slice(0, Math.min(6, limit));
  const selected = [...priority];
  const selectedPaths = new Set(selected.map((file) => file.path));
  const buckets = new Map<string, RepoFile[]>();
  for (const file of files) {
    if (selectedPaths.has(file.path)) continue;
    const bucket = buckets.get(sourceBucket(file.path)) ?? [];
    bucket.push(file);
    buckets.set(sourceBucket(file.path), bucket);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => discoveryScore(b.path) - discoveryScore(a.path) || stableHash(a.path) - stableHash(b.path) || a.path.localeCompare(b.path));
  }
  const keys = [...buckets.keys()].sort();
  while (selected.length < limit) {
    let added = false;
    for (const key of keys) {
      const file = buckets.get(key)?.shift();
      if (!file) continue;
      selected.push(file);
      added = true;
      if (selected.length === limit) break;
    }
    if (!added) break;
  }
  return selected.map((file) => ({ ...file, content: file.content.slice(0, 12_000) }));
}

function discoveryScore(path: string): number {
  const lower = path.toLowerCase();
  const name = basename(lower);
  if (isPriorityFile(name)) return 120;
  if (/(?:^|\/)(?:test|tests|spec|__tests__)(?:\/|$)/.test(lower)) return 95;
  if (/\.(?:ts|tsx|js|jsx|java|kt|kts|py|go|rs|rb|php|cs|c|cc|cpp|swift|scala)$/.test(lower)) return 80;
  if (/readme|docs?\//.test(lower)) return 35;
  return 50;
}
