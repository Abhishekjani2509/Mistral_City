# Mistral City

Mistral City is a web application that turns a repository into a living city.
The React frontend runs on port `5173`. The Node agent bridge runs on port
`3001` and streams typed `CatEvent` objects to the browser over SSE.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

The current backend replays `contracts/repair-run.example.ndjson`. This makes
the complete city interaction testable while SWE 3 replaces the replay runtime
with the real Repair Cat implementation.

## Web integration boundary

```text
React UI :5173
    │ POST /api/dispatch-cat
    ▼
Node bridge :3001
    │ AsyncIterable<CatEvent>
    ▼
SSE response
    │
    ▼
React city state
```

The browser uses `fetch()` rather than `EventSource` because the dispatch
request is a `POST` with a JSON body. CORS allows the frontend origin
`http://localhost:5173`.

The SWE 3 swap point is `server/runtime.ts`: replace `replayRepair` with an
adapter around `runRepair(request)` while preserving the `CatRuntime` type.

## Deployment direction

GitHub Pages is suitable only for a static showcase of the frontend. It cannot
run the Node agent bridge or access a repository for repair work.

For the full demo, deploy one Node web service that serves both `dist/` and the
`/api` routes:

```text
Build: npm install && npm run build
Start: npm start
Port: PORT provided by the host
Environment: NODE_ENV=production
```

The server is prepared for this shape. In production it serves the Vite build
and the browser automatically calls the same origin. The real SWE 3 runtime
will still need the Mistral/Vibe executable and a deliberately restricted demo
repository available to the service.
