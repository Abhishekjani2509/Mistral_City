#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { Command } from "commander";
import { MemoryCache } from "./cache.js";
import { ndjsonEventSink } from "./events.js";
import { validateCityModel } from "./normalize.js";
import { snapshotRepository } from "./repo.js";
import { scanRepository, type AnalysisRunAudit } from "./scan.js";
import { runSecurityProbeSuite } from "./security/attack-catalog.js";
import type { CityModel } from "./schema.js";

const program = new Command().name("city-intel").description("Mistral City intelligence layer").version("0.1.0");

program.command("scan")
  .argument("<repo>", "repository directory")
  .option("--stream", "emit NDJSON analysis events")
  .option("--fresh", "bypass the analysis cache and force model calls")
  .option("--fast", "combine grading and skip the extra translation pass")
  .option("-o, --output <file>", "write the final city model to a file")
  .action(async (repo: string, flags: { stream?: boolean; fresh?: boolean; fast?: boolean; output?: string }) => {
    const snapshot = await snapshotRepository(repo);
    let audit: AnalysisRunAudit | undefined;
    const model = await scanRepository(snapshot, {
      ...(flags.stream ? { emit: ndjsonEventSink() } : {}),
      ...(flags.fresh ? { cache: new MemoryCache() } : {}),
      analysisProfile: flags.fast ? "fast" : "comprehensive",
      mode: "live",
      log: (message) => process.stderr.write(`[city-intel] ${message}\n`),
      onAudit: (value) => { audit = value; printAudit(value); },
    });
    if (flags.fresh) assertFreshOrchestration(audit, model, flags.fast ? "fast" : "comprehensive");
    const json = `${JSON.stringify(model, null, 2)}\n`;
    if (flags.output) await writeFile(flags.output, json, "utf8");
    else if (!flags.stream) process.stdout.write(json);
  });

program.command("explain")
  .argument("<systemId>")
  .option("--report <file>", "city model JSON", "city-model.json")
  .action(async (systemId: string, flags: { report: string }) => {
    const report = await readReport(flags.report);
    const system = report.systems.find((candidate) => candidate.id === systemId);
    if (!system) throw new Error(`Unknown system: ${systemId}`);
    process.stdout.write(`${system.name} — health ${system.health} (${system.status}), confidence ${Math.round(system.confidence * 100)}%\n`);
    for (const signal of system.healthSignals) {
      process.stdout.write(`- ${signal.label} (${signal.severity})\n`);
    }
    for (const issue of system.issues) {
      process.stdout.write(`- ${issue.summary}\n  ${issue.description}\n`);
    }
  });

program.command("stats")
  .argument("<report>", "city model JSON")
  .action(async (path: string) => {
    const report = await readReport(path);
    const statuses = Object.fromEntries(["healthy", "warning", "broken", "unknown"].map((status) => [status, report.systems.filter((system) => system.status === status).length]));
    process.stdout.write(`${JSON.stringify({ cityHealth: report.city.health, cityStatus: report.city.status, systems: report.systems.length, statuses, connections: report.connections.length, stack: report.repository.detectedStack }, null, 2)}\n`);
  });

program.command("security")
  .description("run the local OWASP WSTG 50 source-evidence probes")
  .argument("<repo>", "repository directory")
  .option("--json", "print the complete JSON report")
  .action(async (repo: string, flags: { json?: boolean }) => {
    process.stderr.write("[city-intel] static OWASP source probes; Mistral model calls: 0\n");
    const snapshot = await snapshotRepository(repo);
    const report = runSecurityProbeSuite(snapshot.files);
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${report.catalog}: ${report.detected}/${report.total} source indicators detected\n`);
    for (const finding of report.findings) process.stdout.write(`- ${finding.probeId} ${finding.name}\n  ${finding.file}:${finding.line} — ${finding.evidence}\n`);
  });

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function readReport(path: string): Promise<CityModel> { return validateCityModel(JSON.parse(await readFile(path, "utf8")) as CityModel); }

function printAudit(audit: AnalysisRunAudit): void {
  const successful = audit.modelCalls.filter((call) => call.succeeded).length;
  process.stderr.write(`[city-intel] analysis audit: mode=${audit.mode} profile=${audit.profile} outcome=${audit.outcome} modelCalls=${successful}/${audit.modelCalls.length} cacheHits=${audit.cache.hits} cacheMisses=${audit.cache.misses} elapsedMs=${audit.elapsedMs}\n`);
  for (const call of audit.modelCalls) {
    const resolved = call.responseModel ? ` (API response: ${call.responseModel})` : "";
    process.stderr.write(`[city-intel] model ${call.succeeded ? "ok" : "failed"}: ${call.model}${resolved} ${call.schemaName} ${call.elapsedMs}ms ${call.tokens} tokens\n`);
  }
}

function assertFreshOrchestration(audit: AnalysisRunAudit | undefined, model: CityModel, profile: AnalysisRunAudit["profile"]): void {
  if (!audit || audit.outcome !== "complete" || audit.mode !== "live") throw new Error("Fresh live analysis did not complete with the Mistral orchestration path");
  if (audit.modelCalls.some((call) => !call.succeeded)) throw new Error("At least one required Mistral pass failed");
  const count = (schemaName: string) => audit.modelCalls.filter((call) => call.schemaName === schemaName).length;
  const expectedSystems = model.systems.length;
  if (profile === "fast") {
    if (count("semantic_systems") !== 1 || count("quality_grades_fast") !== expectedSystems || audit.modelCalls.length !== expectedSystems + 1) {
      throw new Error(`Incomplete fast Mistral orchestration: discovery=${count("semantic_systems")}/1 combinedGrades=${count("quality_grades_fast")}/${expectedSystems}`);
    }
    process.stderr.write(`[city-intel] verified fast Mistral passes for ${expectedSystems} systems\n`);
    return;
  }
  const expectedPlainPasses = model.systems.filter((system) => system.issues.length > 0).length;
  if (count("semantic_systems") !== 1 || count("code_quality_grades") !== expectedSystems || count("deployment_grade") !== expectedSystems || count("plain_issues") !== expectedPlainPasses) {
    throw new Error(`Incomplete Mistral orchestration: discovery=${count("semantic_systems")}/1 codeGrades=${count("code_quality_grades")}/${expectedSystems} deploymentGrades=${count("deployment_grade")}/${expectedSystems} plainEnglish=${count("plain_issues")}/${expectedPlainPasses}`);
  }
  process.stderr.write(`[city-intel] verified all required Mistral passes for ${expectedSystems} systems\n`);
}
