import assert from "node:assert/strict";
import test from "node:test";
import { buildGitHubIssueSources, normalizeGitHubUrl } from "./repository";

test("normalizes a public GitHub repository to clone and browser URLs", () => {
  assert.deepEqual(normalizeGitHubUrl("https://github.com/mistralai/cookbook.git"), {
    cloneUrl: "https://github.com/mistralai/cookbook.git",
    webUrl: "https://github.com/mistralai/cookbook",
    name: "cookbook",
  });
});

test("builds commit-pinned source links and encodes path segments", () => {
  const revision = "0123456789abcdef0123456789abcdef01234567";
  const [source] = buildGitHubIssueSources([
    { issueId: "SEC-001", systemId: "api", file: "src/api route.ts", line: 42 },
  ], "https://github.com/example/service", revision);

  assert.deepEqual(source, {
    issueId: "SEC-001",
    systemId: "api",
    file: "src/api route.ts",
    line: 42,
    url: `https://github.com/example/service/blob/${revision}/src/api%20route.ts#L42`,
  });
});

test("does not publish links for unsafe evidence paths", () => {
  const links = buildGitHubIssueSources([
    { issueId: "SEC-001", systemId: "api", file: "../secret.env", line: 1 },
  ], "https://github.com/example/service", "0123456789abcdef0123456789abcdef01234567");
  assert.deepEqual(links, []);
});
