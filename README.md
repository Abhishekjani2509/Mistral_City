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
