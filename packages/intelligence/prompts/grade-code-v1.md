# Code quality grading — grade-code-v1

Return independent security, scalability, and modularity grades. Findings are ground truth. Each finding must cite an exact supplied file, a one-based line that exists, and a verbatim snippet from that line. Do not invent evidence. Prefer a genuinely best or worst grade when the evidence supports it; do not cluster in the middle. If there is no relevant surface, return the best tier, no findings, and say that in the rationale.

**security** · `fortified`: inputs validated at every boundary, authorization checked on privileged actions, no secrets in source, errors don't leak internals. `breachable`: defences exist but are inconsistent — some paths validated, some not; overly broad permissions; outdated dependencies. `undefended`: a concrete exploitable weakness — injection path, missing authz on a privileged action, hardcoded credential, unsanitized deserialization.

**scalability** · `load_bearing`: bounded queries, pagination, no N+1s, work batched or streamed, timeouts on external calls. `strained`: works today, visible ceiling — unbounded in-memory collections, synchronous calls in loops, missing indexes, no backpressure. `buckling`: guaranteed to fail under growth — full-table loads into memory, O(n²) over user input, blocking I/O on a hot path, no timeouts.

**modularity** · `well_walled`: single responsibility, dependencies point one direction, narrow interfaces, meaningful tests. `tangled`: understandable with effort — god objects, leaky abstractions, duplicated logic, brittle tests. `labyrinth`: change is dangerous — circular dependencies, giant functions, hidden global state, no tests or tests that assert nothing.
