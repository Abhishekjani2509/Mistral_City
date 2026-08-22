# Cat Agent Runtime (SWE 3)

The Repair Cat drives a real Mistral Vibe agent against a real repository and
reports what actually happened. Nothing in the event stream is fabricated:
`changedFiles` comes from `git diff`, test counts come from the test runner,
and `SUCCESS` is emitted only after the verification command exits 0.

## Setup

```bash
npm install                 # runtime deps (ts-node, ajv)
cd demo-repo && npm install # the repository under repair
```

Vibe must be on `PATH` and already authenticated (`vibe --version`). Auth comes
from `~/.vibe`, not from `MISTRAL_API_KEY`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run repair:live` | One real repair run. Prints NDJSON, records `.last-run.ndjson`. |
| `npm run validate` | Validates the golden fixture against the JSON Schema. No API call. |
| `npm run validate -- .last-run.ndjson` | Validates a recorded run. |
| `npm run repair:golden -- 10` | Reliability loop: reset, run, validate, N times. |
| `npm run repair:reset` | Restore the demo repo to its buggy state. |
| `npm run build` | Type-check and emit to `dist/`. |

## The bug under repair

`demo-repo/src/app/auth/session.ts` holds the session in React state, so it is
lost on refresh. `src/app/auth/session.test.ts` fails 2/2 until the session is
persisted. The demo repo is tracked in this repository, so
`git checkout -- demo-repo` restores the buggy state between runs.

## Integration (SWE 1)

```ts
import { runRepair } from "./src/agents";

export const dispatchCat: CatRuntime = (request) => runRepair(request);
```

`runRepair(request, options?)` matches the frozen `CatRuntime` signature. The
dispatch schema is closed (`additionalProperties: false`), so the repository
path is an optional second argument rather than a request field; it defaults to
the bundled `demo-repo`.

## Event flow

```
DISPATCHED → TRAVELING → INSPECTING → ISSUE_FOUND → EDITING → TESTING → TESTING → SUCCESS
```

The cat reproduces the failure before repairing. If the suite is already green
it emits `FAILED / ISSUE_NOT_REPRODUCED` rather than taking credit for a repair
it did not perform. Verification is retried (`maxAttempts`, default 2) and
`attempt` is carried at the top level of the event, where the schema requires
it — not inside `payload`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Vibe produces no output and the run times out | stdin was left open. `spawn` must use `stdio: ["ignore", "pipe", "pipe"]`; Vibe's programmatic mode blocks on an open stdin. |
| `Unknown option --non-interactive` | The flags in the original plan do not exist in vibe 2.24.3. Use `-p`, `--output`, `--workdir`, `--auto-approve`, `--max-turns`, `--max-price`. |
| `ISSUE_NOT_REPRODUCED` | The demo repo is already fixed. Run `npm run repair:reset`. |
| Jest cannot parse `jest.setup.js` | That file must be plain JavaScript; the transform only covers `.ts`/`.tsx`. |
| `EDIT_FAILED` | Vibe ran but changed nothing. Usually an API error; check the `details` field on the event. |

If live Mistral is unavailable during the demo, `session.ts` can be patched by
hand — a `localStorage`-backed `useSession` with lazy initialisation passes both
tests. Verified independently of the agent.
