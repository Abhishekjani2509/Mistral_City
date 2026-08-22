import type { CityModel, HealthStatus } from "../../contracts/city-model";
import type { IssueSourceLink } from "../../contracts/issue-sources";

const apiOrigin = import.meta.env.VITE_AGENT_API_URL
  ?? (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

export type ScoutEvent =
  | { type: "scout.progress"; data: { systemId: string; message: string } }
  | {
      type: "scout.complete";
      data: {
        systemId: string;
        model: CityModel;
        health: number;
        status: HealthStatus;
        summary: string;
        detail: string;
        files: string[];
        sources: IssueSourceLink[];
      };
    }
  | { type: "scout.failed"; data: { systemId: string; message: string } };

export async function scoutSystem(
  sessionId: string,
  systemId: string,
  onEvent: (event: ScoutEvent) => void,
): Promise<void> {
  const response = await fetch(`${apiOrigin}/api/scout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, systemId }),
  });

  if (!response.ok) throw new Error(`Scout Cat failed with HTTP ${response.status}.`);
  if (!response.body) throw new Error("Scout Cat returned no event stream.");

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
      if (data) onEvent(JSON.parse(data) as ScoutEvent);
    }

    if (done) break;
  }
}
