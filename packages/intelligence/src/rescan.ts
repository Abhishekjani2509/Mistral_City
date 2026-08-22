import type { CacheStore } from "./cache.js";
import type { IntelligenceModelClient } from "./client.js";
import { gradeSystem } from "./grade/index.js";
import type { EventSink, RepoSnapshot, SystemModel } from "./schema.js";

export async function rescanSystem(
  previous: SystemModel,
  snapshot: RepoSnapshot,
  options: { client: IntelligenceModelClient; cache: CacheStore; codeModel: string; smallModel: string; emit: EventSink },
): Promise<SystemModel> {
  const current = await gradeSystem(previous, {
    client: options.client, cache: options.cache, codeModel: options.codeModel, smallModel: options.smallModel,
    repoFiles: snapshot.files, hardSignals: snapshot.hardSignals?.[previous.id], deeplyAnalyzed: true, timeoutMs: 4_500,
  });
  await options.emit({ type: "system.rescanned", data: { id: previous.id, healthBefore: previous.health, healthAfter: current.health } });
  return current;
}

export interface RepairPayload {
  systemId: string;
  issue: SystemModel["issues"][number];
  relevantFiles: string[];
  reproduction: string;
  hypothesis: string;
  verification: string;
}

export function createRepairPayload(system: SystemModel, issueId: string, failingTest?: string): RepairPayload {
  const issue = system.issues.find((candidate) => candidate.id === issueId);
  if (!issue) throw new Error(`Unknown issue ${issueId} in ${system.id}`);
  return {
    systemId: system.id,
    issue,
    relevantFiles: [...new Set([issue.file, ...system.files])],
    reproduction: failingTest ? `test: ${failingTest}` : `Reproduce the behavior described by issue ${issue.id}.`,
    hypothesis: issue.technicalDescription,
    verification: failingTest ? `npm test -- ${failingTest}` : `Run the focused tests for ${system.name}.`,
  };
}
