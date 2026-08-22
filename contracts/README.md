# Cat runtime contract

This is the handoff between SWE 3 (cat-agent runtime) and SWE 1 (city shell).

## SWE 3 input

SWE 3 receives one `CatDispatchRequest` for each user action. The request
uses the `mistral.city.cat-dispatch/v1` schema from
`cat-dispatch.schema.json` (and the matching type in `cat-events.ts`) and must
contain:

- a unique `runId`
- the agent kind (`repair`, `scout`, or `guard`)
- the target `systemId`
- a concrete issue and repository-relative file hints

For the first vertical slice, implement `agent: "repair"` only.

## SWE 3 output

Emit newline-delimited JSON (`.ndjson`) or the equivalent objects through a
stream/callback. Every object must conform to `cat-events.schema.json`.

Rules:

1. The first event is `DISPATCHED` and the `runId` is stable for the run.
2. `sequence` starts at `0` and increases by exactly `1`.
3. `TESTING` may repeat when the agent retries. Set `attempt` on retry events.
4. The run ends with exactly one `SUCCESS` or `FAILED` event.
5. Emit `SUCCESS` only after the verification command passes.
6. Paths in `files` and `changedFiles` are relative to the repository root.
7. Preserve unknown fields when forwarding events so the contract can grow.
8. Never put raw model reasoning in `message`; use concise user-facing status.

The city shell does not need to know how Mistral inspected or edited the
repository. It only consumes `phase`, `systemId`, `message`, and the typed
payload details.

## SWE 1 rendering map

| Event | City response |
| --- | --- |
| `DISPATCHED` | Open the hut and create an active cat |
| `TRAVELING` | Animate the cat from `payload.from` to `payload.to` |
| `INSPECTING` | Show a scanning state and activity message |
| `ISSUE_FOUND` | Show the issue in the inspector |
| `EDITING` | Add scaffolding and show changed files |
| `TESTING` | Show a test spinner/pass/fail state |
| `SUCCESS` | Clear damage, update health, show verification |
| `FAILED` | Keep damage, show retryable error and details |

The complete deterministic repair sequence is in
`repair-run.example.ndjson`.
