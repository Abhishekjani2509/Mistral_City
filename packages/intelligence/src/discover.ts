import { z } from "zod";
import type { CacheStore } from "./cache.js";
import { cacheKey } from "./cache.js";
import type { IntelligenceModelClient } from "./client.js";
import { discoveryJsonSchema } from "./json-schemas.js";
import { ensurePlainEnglish } from "./plain.js";
import { inferSystemKind } from "./normalize.js";
import { DISCOVER_PROMPT, DISCOVER_VERSION } from "./prompts.js";
import { selectDiscoverySamples } from "./repo.js";
import { discoveredSystemSchema, type DiscoveredSystem, type EventSink, type RepoFile, type RepoSnapshot } from "./schema.js";

const discoveryResponseSchema = z.object({ systems: z.array(discoveredSystemSchema).min(1).max(20) });

export interface DiscoveryResult { systems: DiscoveredSystem[]; tokens: number; cached: boolean; }

export async function discoverSystems(
  snapshot: RepoSnapshot,
  client: IntelligenceModelClient,
  cache: CacheStore,
  model: string,
  emit: EventSink,
): Promise<DiscoveryResult> {
  const samples = selectDiscoverySamples(snapshot.files);
  const key = cacheKey(samples, DISCOVER_VERSION, model);
  let result = await cache.get<{ systems: DiscoveredSystem[]; tokens: number }>(key);
  let cached = true;
  if (!result) {
    cached = false;
    const completion = await client.complete({
      model, promptVersion: DISCOVER_VERSION, system: DISCOVER_PROMPT,
      user: discoveryInput(snapshot.files, samples), schemaName: "semantic_systems", jsonSchema: discoveryJsonSchema,
      parser: discoveryResponseSchema, maxTokens: 4_000,
    });
    result = { systems: completion.value.systems, tokens: completion.tokens };
    await cache.put(key, result);
  }
  const systems = normalizeSystems(result.systems, snapshot.files);
  for (const system of systems) {
    await emit({ type: "system.discovered", data: { id: system.id, name: system.name, kind: inferSystemKind(system), description: system.plainDescription, confidence: system.discoveryConfidence } });
  }
  for (const system of systems) for (const connection of system.connections) {
    await emit({ type: "system.connected", data: { from: system.id, to: connection } });
  }
  return { systems, tokens: result.tokens, cached };
}

function discoveryInput(files: RepoFile[], samples: RepoFile[]): string {
  return JSON.stringify({
    fileTree: files.map((file) => file.path),
    samples: samples.map((file) => ({ path: file.path, numberedContent: numbered(file.content) })),
  });
}

export function normalizeSystems(rawSystems: DiscoveredSystem[], repoFiles: RepoFile[]): DiscoveredSystem[] {
  const existing = new Set(repoFiles.map((file) => normalize(file.path)));
  const claimed = new Set<string>();
  const usedIds = new Set<string>();
  const idMap = new Map(rawSystems.map((system) => [system.id, stableSystemId(system.name, usedIds)]));
  let systems = rawSystems.map((system) => ({
    ...system,
    id: idMap.get(system.id)!,
    plainDescription: ensurePlainEnglish(system.plainDescription, `Supports ${system.name.toLowerCase()} for people using the application.`),
    files: system.files.map(normalize).filter((file) => existing.has(file) && !claimed.has(file) && claimed.add(file)),
    connections: [...new Set(system.connections.map((id) => idMap.get(id) ?? id).filter((id) => id !== idMap.get(system.id)))],
  })).filter((system) => system.files.length > 0);
  while (systems.length > 8) systems = mergeSmallest(systems);
  while (systems.length < 5 && systems.some((system) => system.files.length > 1)) systems = splitLargest(systems);
  const ids = new Set(systems.map((system) => system.id));
  systems = systems.map((system) => ({
    ...system,
    connections: system.connections.filter((target) => ids.has(target) && connectionIsSupported(system, systems.find((candidate) => candidate.id === target)!, repoFiles)),
  }));
  return systems.sort((a, b) => a.id.localeCompare(b.id));
}

function mergeSmallest(systems: DiscoveredSystem[]): DiscoveredSystem[] {
  const source = [...systems].sort((a, b) => a.files.length - b.files.length || a.id.localeCompare(b.id))[0]!;
  const candidates = systems.filter((system) => system.id !== source.id);
  const target = candidates.find((system) => source.connections.includes(system.id) || system.connections.includes(source.id)) ?? candidates[0]!;
  return systems.filter((system) => system.id !== source.id).map((system) => system.id === target.id ? {
    ...system, files: [...system.files, ...source.files].sort(),
    connections: [...new Set([...system.connections.filter((id) => id !== source.id), ...source.connections.filter((id) => id !== target.id)])],
    discoveryConfidence: Math.min(system.discoveryConfidence, source.discoveryConfidence),
  } : { ...system, connections: system.connections.map((id) => id === source.id ? target.id : id) });
}

function splitLargest(systems: DiscoveredSystem[]): DiscoveredSystem[] {
  const source = [...systems].sort((a, b) => b.files.length - a.files.length || a.id.localeCompare(b.id))[0]!;
  const midpoint = Math.ceil(source.files.length / 2);
  const supportId = uniqueId(`${source.id}-support`, new Set(systems.map((system) => system.id)));
  const core: DiscoveredSystem = { ...source, name: `${source.name} Core`, files: source.files.slice(0, midpoint), connections: [...new Set([...source.connections, supportId])] };
  const support: DiscoveredSystem = { ...source, id: supportId, name: `${source.name} Support`, files: source.files.slice(midpoint), connections: [source.id], discoveryConfidence: Math.max(0.4, source.discoveryConfidence - 0.1) };
  return [...systems.filter((system) => system.id !== source.id), core, support];
}

function connectionIsSupported(from: DiscoveredSystem, to: DiscoveredSystem, files: RepoFile[]): boolean {
  const byPath = new Map(files.map((file) => [normalize(file.path), file.content]));
  const imports = (system: DiscoveredSystem) => new Set(system.files.flatMap((path) => extractImports(byPath.get(path) ?? "")));
  const fromImports = imports(from); const toImports = imports(to);
  if ([...fromImports].some((item) => toImports.has(item))) return true;
  const tokens = to.files.flatMap((path) => [path.replace(/\.[^.]+$/, ""), path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? ""]).filter((token) => token.length > 1);
  return from.files.some((path) => tokens.some((token) => (byPath.get(path) ?? "").includes(token)));
}

function extractImports(content: string): string[] {
  return [...content.matchAll(/(?:from\s+|require\s*\(|import\s*\()["']([^"']+)["']/g)].map((match) => match[1]!).filter(Boolean);
}

function numbered(content: string): string { return content.split(/\r?\n/).map((line, index) => `${index + 1}: ${line}`).join("\n"); }
function normalize(path: string): string { return path.replace(/^\.\//, "").replaceAll("\\", "/"); }
function uniqueId(base: string, ids: Set<string>): string { let id = base; let suffix = 2; while (ids.has(id)) id = `${base}-${suffix++}`; return id; }
function stableSystemId(name: string, ids: Set<string>): string {
  const lower = name.toLowerCase();
  const preferred = /auth|login|session/.test(lower) ? "auth" : /database|data store/.test(lower) ? "database" : /test/.test(lower) ? "tests" : /front.?end|customer app/.test(lower) ? "frontend" : /api/.test(lower) ? "api" : lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "system";
  return uniqueId(preferred, ids);
}
