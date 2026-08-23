export const DISCOVER_VERSION = "discover-v1";
export const GRADE_CODE_VERSION = "grade-code-v1";
export const GRADE_DEPLOYMENT_VERSION = "grade-deployment-v1";
export const GRADE_FAST_VERSION = "grade-fast-v1";
export const PLAIN_VERSION = "plain-v1";
export const GUARD_VERSION = "guard-v1";
export const SCOUT_VERSION = "scout-v1";

export const DISCOVER_PROMPT = `You decompose a TypeScript/React/Node/Postgres repository into 5–8 user-meaningful semantic systems, never folders. Use only supplied evidence. Map every file at most once; unmapped files are allowed. Connections require an import, API call, or shared model. Use only the supplied building type enum. Write one-sentence, jargon-free descriptions. Confidence below 0.55 means the system remains under fog.`;

export const GRADE_CODE_PROMPT = `Return independent security, scalability, and modularity grades. Findings are ground truth. Every finding must cite an exact supplied file, a one-based line that exists, and a verbatim snippet from that line. Do not invent evidence. Do not cluster in the middle. If there is no relevant surface, use the best tier, no findings, and say so.

security · fortified: inputs validated at every boundary, authorization checked on privileged actions, no secrets in source, errors don't leak internals. breachable: defences exist but are inconsistent — some paths validated, some not; overly broad permissions; outdated dependencies. undefended: a concrete exploitable weakness — injection path, missing authz on a privileged action, hardcoded credential, unsanitized deserialization.

scalability · load_bearing: bounded queries, pagination, no N+1s, work batched or streamed, timeouts on external calls. strained: works today, visible ceiling — unbounded in-memory collections, synchronous calls in loops, missing indexes, no backpressure. buckling: guaranteed to fail under growth — full-table loads into memory, O(n²) over user input, blocking I/O on a hot path, no timeouts.

modularity · well_walled: single responsibility, dependencies point one direction, narrow interfaces, meaningful tests. tangled: understandable with effort — god objects, leaky abstractions, duplicated logic, brittle tests. labyrinth: change is dangerous — circular dependencies, giant functions, hidden global state, no tests or tests that assert nothing.`;

export const GRADE_DEPLOYMENT_PROMPT = `Grade deployment only. Every finding must cite an exact supplied file, a one-based line that exists, and a verbatim snippet from that line. If this system has no deployment surface, return forged with no findings and explicitly say so.

deployment · forged: config externalized, health checks present, migrations reversible, structured logging, deterministic build. sputtering: ships with friction — partly hardcoded config, manual steps, thin logging, forward-only migrations. cold_forge: cannot be safely deployed — environment values baked into source, no way to observe failure, destructive irreversible migration.`;

export const GRADE_FAST_PROMPT = `${GRADE_CODE_PROMPT}

Also return an independent deployment grade in the same response.

deployment · forged: config externalized, health checks present, migrations reversible, structured logging, deterministic build. sputtering: ships with friction — partly hardcoded config, manual steps, thin logging, forward-only migrations. cold_forge: cannot be safely deployed — environment values baked into source, no way to observe failure, destructive irreversible migration.`;

export const PLAIN_PROMPT = `Rewrite every issue for a person who cannot read code. Use present tense and one short sentence. Describe a user-visible consequence or the risk. Do not use file paths, function names, acronyms, or implementation mechanisms. Return exactly one sentence per issue id.`;

export const GUARD_PROMPT = `Find up to six important untested behaviours. Explain why each matters in plain English. Cite only supplied files. Rank by blast radius multiplied by current health risk, highest first.`;

export const SCOUT_PROMPT = `Deeply inspect one fogged semantic system using every supplied line. Confirm or correct its name, description, file membership, building type, confidence, and connections. Do not add files outside the supplied candidate set. Connections require an import, API call, or shared model. Use one jargon-free sentence for the description. Return exactly one system.`;
