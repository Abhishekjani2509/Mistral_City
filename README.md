# Mistral City

Mistral City turns a repository into a living city. The React frontend runs
on port `5173`; the Node server runs the agent bridge and serves the built app
in production.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

The browser sends `POST /api/dispatch-cat` to the Node bridge. The response is
an SSE stream of typed `CatEvent` objects. The current runtime still replays
`contracts/repair-run.example.ndjson` until SWE 3’s real Repair Cat runtime is
wired into `server/runtime.ts`.

## Intelligence layer

The `packages/intelligence` workspace owns repository snapshots, semantic
system discovery, evidence-backed health grading, security probes, Scout and
Guard analysis, rescans, caching, and the canonical `mistral.city-model/v1`
output. It never edits the analyzed repository.

```bash
npm run demo:mock
npm test
npm run typecheck
npm run city-intel -- scan /path/to/repo --stream
npm run city-intel -- scan /path/to/repo --fast --stream
npm run benchmark:health
```

The web app uses the fast profile: one combined evidence-backed grading call
per system and deterministic plain-English summaries. The default CLI profile
keeps the separate grading and translation passes for comprehensive audits.

Use `CITY_INTEL_DEMO_MODE=1` to allow live analysis failures to fall back to
the committed demo snapshot. Model IDs are pinned through the
`MISTRAL_*_MODEL` environment variables.

The stable CityModel contains semantic systems, health, issues, and evidence-
backed connections. Renderer-specific positions and art types belong in the
Neo adapter, not in the intelligence output.

## Integration boundary

```text
Repository
    │
    ▼
packages/intelligence
    │ canonical CityModel
    ▼
Neo renderer adapter → mistral-city.setModel()
    ▲
    │ CatEvent adapter
SWE 3 Repair Cat → POST /api/dispatch-cat → SSE
```

GitHub Pages can host only a static showcase. The full demo needs a Node web
service that can run the intelligence layer, access the controlled demo
repository, execute the agent runtime, and serve `dist/` plus `/api` routes.

```text
Build: npm run build
Start: npm start
Port: PORT provided by the host
Environment: NODE_ENV=production
```
