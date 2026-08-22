import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisSessionStore } from "./analysis-sessions";

const analysis = { city: { health: 0, schemaVersion: "1.0.0" as const }, systems: [], warnings: [] };
const snapshot = { root: "/tmp/repository", repoName: "repository", files: [] };
const source = { webUrl: "https://github.com/example/repository", revision: "0123456789abcdef0123456789abcdef01234567" };

test("keeps a cloned repository alive while its analysis session is active", () => {
  let cleaned = 0;
  const store = new AnalysisSessionStore(30_000, () => 1_000, () => "session-1");
  const id = store.save({ snapshot, analysis, source, cleanup: async () => { cleaned += 1; } });

  assert.equal(store.get(id).snapshot.root, snapshot.root);
  assert.equal(cleaned, 0);
});

test("cleans the cloned repository after its analysis session expires", async () => {
  let now = 1_000;
  let cleaned = 0;
  const store = new AnalysisSessionStore(30_000, () => now, () => "session-1");
  const id = store.save({ snapshot, analysis, source, cleanup: async () => { cleaned += 1; } });

  now = 31_001;
  assert.throws(() => store.get(id), /session expired/);
  await Promise.resolve();
  assert.equal(cleaned, 1);
});
