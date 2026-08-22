import { z } from "zod";
import type { CacheStore } from "./cache.js";
import { cacheKey } from "./cache.js";
import type { IntelligenceModelClient } from "./client.js";
import { guardJsonSchema } from "./json-schemas.js";
import { ensurePlainEnglish } from "./plain.js";
import { GUARD_PROMPT, GUARD_VERSION } from "./prompts.js";
import { guardGapSchema, type EventSink, type GuardGap, type RepoFile, type RepoSnapshot, type SystemModel } from "./schema.js";

const guardResponseSchema = z.object({ gaps: z.array(guardGapSchema).max(6) });

export async function guardSystem(
  system: SystemModel,
  snapshot: RepoSnapshot,
  options: { client: IntelligenceModelClient; cache: CacheStore; model: string; emit?: EventSink },
): Promise<GuardGap[]> {
  const files = system.files.map((path) => snapshot.files.find((file) => file.path === path)).filter((file): file is RepoFile => Boolean(file));
  const testCount = files.filter((file) => /(?:test|spec)\.[^.]+$/i.test(file.path)).length;
  await options.emit?.({ type: "agent.progress", data: { systemId: system.id, step: "tests.mapped", plainText: `Guard found ${testCount} test files among the files assigned to ${system.name}.` } });
  const key = cacheKey(files, GUARD_VERSION, options.model);
  let value = await options.cache.get<{ gaps: GuardGap[] }>(key);
  if (!value) {
    const result = await options.client.complete({
      model: options.model, promptVersion: GUARD_VERSION, system: GUARD_PROMPT,
      user: JSON.stringify({ system: { id: system.id, name: system.name, health: system.health, issues: system.issues }, files: numberFiles(files) }),
      schemaName: "guard_test_gaps", jsonSchema: guardJsonSchema, parser: guardResponseSchema, maxTokens: 2_000,
    });
    value = result.value;
    await options.cache.put(key, value);
  }
  const existing = new Set(files.map((file) => file.path));
  const risk = Math.max(0.01, 1 - system.health / 100);
  const gaps = value.gaps
    .map((gap) => ({
      ...gap,
      whyItMatters: ensurePlainEnglish(gap.whyItMatters, "This behavior could fail without anyone noticing."),
      files: gap.files.filter((file) => existing.has(file)),
    }))
    .filter((gap) => gap.files.length > 0)
    .sort((a, b) => b.blastRadius * risk - a.blastRadius * risk || b.priority - a.priority);
  await options.emit?.({ type: "agent.progress", data: { systemId: system.id, step: "gaps.ranked", plainText: `Guard ranked ${gaps.length} missing protections by risk.` } });
  return gaps;
}

function numberFiles(files: RepoFile[]): Array<{ path: string; numberedContent: string }> {
  return files.map((file) => ({ path: file.path, numberedContent: file.content.split(/\r?\n/).map((line, index) => `${index + 1}: ${line}`).join("\n") }));
}
