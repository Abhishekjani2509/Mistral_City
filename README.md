# Mistral City intelligence layer

This repository contains the intelligence layer that turns a TypeScript/React/Node/Postgres repository into the semantic city model consumed by Mistral City.

The package lives in `packages/intelligence` and owns semantic system discovery, evidence-backed quality grading, health/status synthesis, fog-of-war confidence, Scout and Guard analyses, event streaming, deterministic caching, and snapshot fallback. It never edits the analyzed repository.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Run a scan with a Mistral API key:

```bash
MISTRAL_API_KEY=... npm run city-intel -- scan /path/to/repo --stream
```

To prove that every required Mistral pass ran instead of reading an old cache entry, use a fresh scan:

```bash
MISTRAL_API_KEY=... npm run city-intel -- scan /path/to/repo --fresh
```

`--fresh` bypasses the disk cache, records every model call, and fails the command unless it sees one semantic-discovery pass, one Devstral code-quality pass per system, one Mistral Small deployment pass per system, and one Mistral Small plain-English pass per system that has verified issues. The audit is written to stderr; stdout remains a pure `mistral.city-model/v1` JSON object. A normal unchanged scan can legitimately finish quickly with zero model calls because the cache is part of the determinism requirement.

Each live attempt has a 30-second deadline and a timed-out attempt is retried up to three times with backoff. All requested model IDs must be explicitly pinned; `*-latest` overrides are rejected before the scan begins. The API may report an alias for a pinned request, and the audit displays both values when they differ.

Run the deliberately vulnerable local fixture without an API key:

```bash
npm run city-intel -- security packages/intelligence/fixtures/mock-vulnerable-repo
npm run demo:mock
```

The first command reports all 50 OWASP WSTG-derived source indicators with exact evidence and makes zero model calls. The second runs the entire semantic discovery → grading → normalization pipeline with a deterministic fake client and prints only the resulting `mistral.city-model/v1` JSON. It exercises orchestration but does not contact Mistral; stderr labels it `MOCK ANALYSIS` and reports the simulated call count. Verified probe findings feed the security grade and the health calculation; the CityModel retains the six highest-risk issues per system while the security report retains all 50 results. These are local static evidence probes, not a live penetration test or proof that an exploit succeeded.

Health keeps the PRD's 60% hard-signal / 40% quality blend, with one additional evidence penalty for verified security findings: critical findings subtract 20, major findings 7, and minor findings 2 from the hard-signal side, capped at 60 points. This prevents a system with concrete exploitable weaknesses from appearing healthy merely because its tests pass and its other quality dimensions are strong. Status still becomes `broken` for any critical finding.

`CITY_INTEL_DEMO_MODE=1` makes API failures fall back quietly to the committed demo snapshot. Outside demo mode the fallback is logged to stderr. Model IDs may be overridden with `MISTRAL_DISCOVERY_MODEL`, `MISTRAL_CODE_MODEL`, and `MISTRAL_SMALL_MODEL`, but defaults are dated and never use a `-latest` alias.

## Quality tier contract

These definitions are part of the frontend contract and must not be redefined downstream.

**security** · `fortified`: inputs validated at every boundary, authorization checked on privileged actions, no secrets in source, errors don't leak internals. `breachable`: defences exist but are inconsistent — some paths validated, some not; overly broad permissions; outdated dependencies. `undefended`: a concrete exploitable weakness — injection path, missing authz on a privileged action, hardcoded credential, unsanitized deserialization.

**scalability** · `load_bearing`: bounded queries, pagination, no N+1s, work batched or streamed, timeouts on external calls. `strained`: works today, visible ceiling — unbounded in-memory collections, synchronous calls in loops, missing indexes, no backpressure. `buckling`: guaranteed to fail under growth — full-table loads into memory, O(n²) over user input, blocking I/O on a hot path, no timeouts.

**deployment** · `forged`: config externalized, health checks present, migrations reversible, structured logging, deterministic build. `sputtering`: ships with friction — partly hardcoded config, manual steps, thin logging, forward-only migrations. `cold_forge`: cannot be safely deployed — environment values baked into source, no way to observe failure, destructive irreversible migration.

**modularity** · `well_walled`: single responsibility, dependencies point one direction, narrow interfaces, meaningful tests. `tangled`: understandable with effort — god objects, leaky abstractions, duplicated logic, brittle tests. `labyrinth`: change is dangerous — circular dependencies, giant functions, hidden global state, no tests or tests that assert nothing.

## Public contract

- `scanRepository(...)` produces the frozen `mistral.city-model/v1` `CityModel`; scanner details, source samples, Mistral grades, and building-type hints stay internal.
- The renderer receives systems with `kind`, `description`, `healthSignals`, `issues`, and `confidence`, plus evidence-backed `connections`. It never needs to read source code or interpret quality tiers.
- `validateCityModel(...)` rejects duplicate system IDs, invalid connection endpoints, invalid metadata, and non-repository-relative paths.
- `scoutSystem(...)` reveals a fogged system.
- `guardSystem(...)` returns ranked missing-test behaviours.
- `rescanSystem(...)` grades only the changed system and emits a before/after health event.
- `city-intel scan`, `explain`, and `stats` provide CLI access.

Cache keys are BLAKE3 hashes over sorted system file contents, prompt version, and model ID. Model output is not trusted: every finding's file, line, and evidence snippet is verified against the supplied repository snapshot, and unverifiable findings are dropped.
