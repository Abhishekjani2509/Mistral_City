import type { CityModel, HealthStatus, SystemKind } from "../../contracts/city-model";

const apiOrigin = import.meta.env.VITE_AGENT_API_URL
  ?? (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

export type RepositoryEvent =
  | { type: "repository.started"; data: { url: string } }
  | { type: "repository.cloned"; data: { name: string } }
  | { type: "analysis.started"; data: { repoName: string; estimatedSystems: number } }
  | { type: "analysis.session"; data: { id: string } }
  | { type: "system.discovered"; data: { id: string; name: string; kind: SystemKind; description: string; confidence: number } }
  | { type: "system.connected"; data: { from: string; to: string } }
  | { type: "system.graded"; data: { id: string; health: number; status: HealthStatus } }
  | { type: "city.health"; data: { value: number } }
  | { type: "analysis.complete"; data: { cityHealth: number; systemCount: number; warnings: string[] } }
  | { type: "city.model"; data: CityModel }
  | { type: "repository.failed"; data: { message: string } };

export async function analyzeRepository(
  url: string,
  onEvent: (event: RepositoryEvent) => void,
): Promise<void> {
  const response = await fetch(`${apiOrigin}/api/analyze-repository`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) throw new Error(`Repository analysis failed with HTTP ${response.status}.`);
  if (!response.body) throw new Error("Repository analysis returned no event stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as RepositoryEvent);
    }

    if (done) break;
  }
}
