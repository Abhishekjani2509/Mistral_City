import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import type { RepoFile, RepoSnapshot } from "./schema.js";

const IGNORED = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".city-intel-cache"]);
const INCLUDED_NAMES = new Set(["README", "Dockerfile", "package.json", "tsconfig.json", "vite.config.ts", "next.config.js"]);
const INCLUDED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".sql", ".md", ".yaml", ".yml", ".toml"]);

export async function snapshotRepository(root: string, maxFiles = 1_500): Promise<RepoSnapshot> {
  const absoluteRoot = resolve(root);
  const paths: string[] = [];
  await walk(absoluteRoot, absoluteRoot, paths, maxFiles);
  const files: RepoFile[] = [];
  for (const path of paths.sort()) {
    const info = await stat(path);
    if (info.size > 100_000) continue;
    files.push({ path: relative(absoluteRoot, path).replaceAll("\\", "/"), content: await readFile(path, "utf8") });
  }
  return { root: absoluteRoot, repoName: basename(absoluteRoot), files };
}

async function walk(root: string, directory: string, paths: string[], maxFiles: number): Promise<void> {
  if (paths.length >= maxFiles) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (IGNORED.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(root, path, paths, maxFiles);
    else if (isRelevant(entry.name)) paths.push(path);
    if (paths.length >= maxFiles) return;
  }
}

function isRelevant(name: string): boolean {
  return INCLUDED_NAMES.has(name) || INCLUDED_NAMES.has(name.replace(/\.[^.]+$/, "")) || INCLUDED_EXTENSIONS.has(extname(name));
}

export function selectDiscoverySamples(files: RepoFile[], limit = 24): RepoFile[] {
  const highSignal = /(^|\/)(readme|package\.json|.*route.*|.*schema.*|.*test.*|.*spec.*)/i;
  return [...files]
    .sort((a, b) => Number(highSignal.test(b.path)) - Number(highSignal.test(a.path)) || b.content.length - a.content.length)
    .slice(0, limit)
    .map((file) => ({ ...file, content: file.content.slice(0, 12_000) }));
}
