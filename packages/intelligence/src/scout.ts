import { z } from "zod";
import type { CacheStore } from "./cache.js";
import { cacheKey } from "./cache.js";
import type { IntelligenceModelClient } from "./client.js";
import { gradeSystem } from "./grade/index.js";
import { discoveryJsonSchema } from "./json-schemas.js";
import { SCOUT_PROMPT, SCOUT_VERSION } from "./prompts.js";
import { discoveredSystemSchema, type AnalysisModel, type EventSink, type RepoFile, type RepoSnapshot, type SystemModel } from "./schema.js";

const scoutResponseSchema = z.object({ systems: z.array(discoveredSystemSchema).length(1) });

export interface ScoutOptions {
  client: IntelligenceModelClient;
  cache: CacheStore;
  discoveryModel: string;
  codeModel: string;
  smallModel: string;
  emit: EventSink;
}

export async function scoutSystem(systemId: string, city: AnalysisModel, snapshot: RepoSnapshot, options: ScoutOptions): Promise<SystemModel> {
  const existing = city.systems.find((system) => system.id === systemId);
  if (!existing) throw new Error(`Unknown system: ${systemId}`);
  const files = existing.files.map((path) => snapshot.files.find((file) => file.path === path)).filter((file): file is RepoFile => Boolean(file));
  await options.emit({ type: "agent.progress", data: { systemId, step: "files.loaded", plainText: `Scout inspected ${files.length} files assigned to ${existing.name}.` } });

  const key = cacheKey(files, SCOUT_VERSION, options.discoveryModel);
  let detail = await options.cache.get<z.infer<typeof scoutResponseSchema>>(key);
  if (!detail) {
    const completion = await options.client.complete({
      model: options.discoveryModel,
      promptVersion: SCOUT_VERSION,
      system: SCOUT_PROMPT,
      user: JSON.stringify({
        currentSystem: existing,
        files: files.map((file) => ({ path: file.path, numberedContent: number(file.content) })),
      }),
      schemaName: "scout_system",
      jsonSchema: {
        ...discoveryJsonSchema,
        properties: {
          systems: { ...discoveryJsonSchema.properties.systems, minItems: 1, maxItems: 1 },
        },
      },
      parser: scoutResponseSchema,
      maxTokens: 2_500,
    });
    detail = completion.value;
    await options.cache.put(key, detail);
  }

  const refined = detail.systems[0]!;
  const allowedFiles = new Set(existing.files);
  const discovered = {
    ...existing,
    ...refined,
    id: existing.id,
    files: refined.files.filter((file) => allowedFiles.has(file)),
    discoveryConfidence: Math.max(0.75, refined.discoveryConfidence),
  };
  await options.emit({ type: "agent.progress", data: { systemId, step: "system.mapped", plainText: `Scout confirmed the boundaries and connections for ${discovered.name}.` } });

  const revealed = await gradeSystem(discovered, {
    client: options.client,
    cache: options.cache,
    codeModel: options.codeModel,
    smallModel: options.smallModel,
    repoFiles: snapshot.files,
    hardSignals: snapshot.hardSignals?.[systemId],
    deeplyAnalyzed: true,
    cacheContext: SCOUT_VERSION,
  });
  await options.emit({ type: "agent.progress", data: { systemId, step: "evidence.verified", plainText: `Scout verified ${revealed.issues.length} evidence-backed findings.` } });
  await options.emit({ type: "system.revealed", data: revealed });
  return revealed;
}

function number(content: string): string {
  return content.split(/\r?\n/).map((line, index) => `${index + 1}: ${line}`).join("\n");
}
