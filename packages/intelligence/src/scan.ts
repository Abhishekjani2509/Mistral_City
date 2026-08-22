import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { CacheStore } from "./cache.js";
import { DiskCache } from "./cache.js";
import type { IntelligenceConfig } from "./config.js";
import { loadConfig } from "./config.js";
import type { CompletionRequest, CompletionResult, IntelligenceModelClient } from "./client.js";
import { MissingClient, MistralClient } from "./client.js";
import { histogramWarnings, tierHistogram } from "./consistency.js";
import { discoverSystems } from "./discover.js";
import { noopEventSink } from "./events.js";
import { gradeSystem } from "./grade/index.js";
import { normalizeCityModel, validateCityModel } from "./normalize.js";
import type { AnalysisModel, CityModel, EventSink, RepoSnapshot, SystemModel } from "./schema.js";
import { cityHealth } from "./synthesize.js";

export interface ScanOptions {
  client?: IntelligenceModelClient;
  cache?: CacheStore;
  config?: Partial<IntelligenceConfig>;
  emit?: EventSink;
  fallback?: CityModel;
  log?: (message: string) => void;
  mode?: "live" | "mock" | "injected";
  onAudit?: (audit: AnalysisRunAudit) => void;
  /**
   * Delivers the private, evidence-rich analysis for trusted server-side
   * follow-up actions such as Scout. This must never be sent to the renderer.
   */
  onAnalysis?: (analysis: AnalysisModel) => void | Promise<void>;
}

export interface AnalysisRunAudit {
  mode: "live" | "mock" | "injected";
  outcome: "complete" | "fallback" | "failed";
  elapsedMs: number;
  cache: { hits: number; misses: number; writes: number };
  modelCalls: Array<{ model: string; responseModel?: string; promptVersion: string; schemaName: string; elapsedMs: number; tokens: number; succeeded: boolean }>;
}

export async function scanRepository(snapshot: RepoSnapshot, options: ScanOptions = {}): Promise<CityModel> {
  const config = loadConfig(options.config);
  const emit = deduplicatingSink(options.emit ?? noopEventSink);
  const startedAt = Date.now();
  const audit: AnalysisRunAudit = {
    mode: options.mode ?? (options.client ? "injected" : "live"), outcome: "failed", elapsedMs: 0,
    cache: { hits: 0, misses: 0, writes: 0 }, modelCalls: [],
  };
  const rawClient = options.client ?? (config.apiKey ? new MistralClient(config.apiKey, config.apiBase, config.retries, config.requestTimeoutMs) : new MissingClient());
  const client = auditedClient(rawClient, audit);
  const cache = auditedCache(options.cache ?? new DiskCache(config.cacheDir), audit);
  await emit({ type: "analysis.started", data: { repoName: snapshot.repoName, estimatedSystems: 6 } });
  try {
    const discovery = await discoverSystems(snapshot, client, cache, config.discoveryModel, emit);
    const gradedPromises = discovery.systems.map(async (system) => {
      const graded = await gradeSystem(system, {
        client, cache, codeModel: config.codeModel, smallModel: config.smallModel,
        repoFiles: snapshot.files, hardSignals: snapshot.hardSignals?.[system.id],
        onDroppedFinding: (message) => options.log?.(`Dropped unverifiable finding: ${message}`),
      });
      await emit({ type: "system.graded", data: { id: graded.id, health: graded.health, status: graded.status } });
      return graded;
    });
    const systems = (await Promise.all(gradedPromises)).sort((a, b) => a.id.localeCompare(b.id));
    const warnings = histogramWarnings(systems);
    const health = cityHealth(systems);
    const analysis: AnalysisModel = { city: { health, schemaVersion: "1.0.0" }, systems, warnings };
    const model = normalizeCityModel(snapshot, analysis);
    await options.onAnalysis?.(structuredClone(analysis));
    options.log?.(`Tier histogram: ${JSON.stringify(tierHistogram(systems))}`);
    await emit({ type: "city.health", data: { value: health } });
    await emit({ type: "analysis.complete", data: { cityHealth: health, systemCount: systems.length, warnings } });
    finishAudit(audit, startedAt, "complete", options.onAudit);
    return model;
  } catch (error) {
    const fallback = options.fallback ?? ((config.demoMode || snapshot.repoName === "demo-repo") ? await loadDemoSnapshot() : undefined);
    if (!fallback) {
      finishAudit(audit, startedAt, "failed", options.onAudit);
      throw error;
    }
    if (!config.demoMode) options.log?.(`Live analysis failed; using pinned demo snapshot: ${error instanceof Error ? error.message : String(error)}`);
    await emitFallback(fallback, emit);
    finishAudit(audit, startedAt, "fallback", options.onAudit);
    return structuredClone(fallback);
  }
}

function auditedClient(client: IntelligenceModelClient, audit: AnalysisRunAudit): IntelligenceModelClient {
  return {
    async complete<T>(request: CompletionRequest<T>): Promise<CompletionResult<T>> {
      const startedAt = Date.now();
      try {
        const result = await client.complete(request);
        audit.modelCalls.push({
          model: request.model,
          ...(result.model !== request.model ? { responseModel: result.model } : {}),
          promptVersion: request.promptVersion,
          schemaName: request.schemaName,
          elapsedMs: Date.now() - startedAt,
          tokens: result.tokens,
          succeeded: true,
        });
        return result;
      } catch (error) {
        audit.modelCalls.push({ model: request.model, promptVersion: request.promptVersion, schemaName: request.schemaName, elapsedMs: Date.now() - startedAt, tokens: 0, succeeded: false });
        throw error;
      }
    },
  };
}

function auditedCache(cache: CacheStore, audit: AnalysisRunAudit): CacheStore {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const value = await cache.get<T>(key);
      if (value === undefined) audit.cache.misses += 1;
      else audit.cache.hits += 1;
      return value;
    },
    async put<T>(key: string, value: T): Promise<void> {
      audit.cache.writes += 1;
      await cache.put(key, value);
    },
  };
}

function finishAudit(audit: AnalysisRunAudit, startedAt: number, outcome: AnalysisRunAudit["outcome"], onAudit?: (audit: AnalysisRunAudit) => void): void {
  audit.outcome = outcome;
  audit.elapsedMs = Date.now() - startedAt;
  onAudit?.(structuredClone(audit));
}

export async function loadDemoSnapshot(): Promise<CityModel> {
  const path = fileURLToPath(new URL("../fixtures/demo-repo-snapshot.json", import.meta.url));
  return validateCityModel(JSON.parse(await readFile(path, "utf8")) as CityModel);
}

async function emitFallback(model: CityModel, emit: EventSink): Promise<void> {
  for (const system of model.systems) {
    await emit({ type: "system.discovered", data: { id: system.id, name: system.name, kind: system.kind, description: system.description, confidence: system.confidence } });
    await emit({ type: "system.graded", data: { id: system.id, health: system.health, status: system.status } });
  }
  for (const connection of model.connections) await emit({ type: "system.connected", data: { from: connection.from, to: connection.to } });
  await emit({ type: "city.health", data: { value: model.city.health } });
  await emit({ type: "analysis.complete", data: { cityHealth: model.city.health, systemCount: model.systems.length, warnings: [] } });
}

export function replaceSystem(model: AnalysisModel, replacement: SystemModel): AnalysisModel {
  const systems = model.systems.map((system) => system.id === replacement.id ? replacement : system).sort((a, b) => a.id.localeCompare(b.id));
  return { city: { ...model.city, health: cityHealth(systems) }, systems, warnings: histogramWarnings(systems) };
}

function deduplicatingSink(downstream: EventSink): EventSink {
  const discovered = new Set<string>();
  const connected = new Set<string>();
  return async (event) => {
    if (event.type === "system.discovered") {
      if (discovered.has(event.data.id)) return;
      discovered.add(event.data.id);
    }
    if (event.type === "system.connected") {
      const key = `${event.data.from}\0${event.data.to}`;
      if (connected.has(key)) return;
      connected.add(key);
    }
    await downstream(event);
  };
}
