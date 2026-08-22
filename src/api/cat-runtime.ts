import type { CatDispatchRequest, CatEvent } from "../../contracts/cat-events";

const apiOrigin = import.meta.env.VITE_AGENT_API_URL ?? "http://localhost:3001";

export async function dispatchCat(
  request: CatDispatchRequest,
  onEvent: (event: CatEvent) => void,
): Promise<void> {
  const response = await fetch(`${apiOrigin}/api/dispatch-cat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Cat dispatch failed with HTTP ${response.status}.`);
  }

  if (!response.body) {
    throw new Error("Cat dispatch returned no event stream.");
  }

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

      if (data) {
        onEvent(JSON.parse(data) as CatEvent);
      }
    }

    if (done) break;
  }
}
