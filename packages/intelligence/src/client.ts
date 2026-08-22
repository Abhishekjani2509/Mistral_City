import type { ZodType } from "zod";

export interface CompletionRequest<T> {
  model: string;
  promptVersion: string;
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  parser: ZodType<T>;
  maxTokens: number;
  timeoutMs?: number | undefined;
}

export interface CompletionResult<T> {
  value: T;
  model: string;
  promptVersion: string;
  tokens: number;
}

export interface IntelligenceModelClient {
  complete<T>(request: CompletionRequest<T>): Promise<CompletionResult<T>>;
}

interface MistralResponse {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  usage?: { total_tokens?: number };
  model?: string;
}

export class MistralClient implements IntelligenceModelClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiBase = "https://api.mistral.ai/v1",
    private readonly retries = 3,
    private readonly defaultTimeoutMs = 12_000,
  ) {}

  async complete<T>(request: CompletionRequest<T>): Promise<CompletionResult<T>> {
    let lastError: unknown;
    const deadline = Date.now() + (request.timeoutMs ?? this.defaultTimeoutMs);
    for (let attempt = 0; attempt < this.retries; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);
      try {
        const response = await fetch(`${this.apiBase.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: request.model,
            temperature: 0,
            max_tokens: request.maxTokens,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
            },
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Mistral API ${response.status}: ${await response.text()}`);
        const body = await response.json() as MistralResponse;
        const content = body.choices?.[0]?.message?.content;
        const text = typeof content === "string"
          ? content
          : content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
        if (!text) throw new Error("Mistral API returned no text content");
        return {
          value: request.parser.parse(JSON.parse(text)),
          model: body.model ?? request.model,
          promptVersion: request.promptVersion,
          tokens: body.usage?.total_tokens ?? 0,
        };
      } catch (error) {
        lastError = error;
        const backoff = 250 * 2 ** attempt;
        if (attempt + 1 < this.retries && Date.now() + backoff < deadline) await delay(backoff);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Mistral request timed out");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MissingClient implements IntelligenceModelClient {
  async complete<T>(_request: CompletionRequest<T>): Promise<CompletionResult<T>> {
    throw new Error("MISTRAL_API_KEY is not configured");
  }
}
