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

class MistralHttpError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfterMs?: number) {
    super(message);
    this.name = "MistralHttpError";
  }
}

export class MistralClient implements IntelligenceModelClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiBase = "https://api.mistral.ai/v1",
    private readonly retries = 3,
    private readonly defaultTimeoutMs = 12_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete<T>(request: CompletionRequest<T>): Promise<CompletionResult<T>> {
    let lastError: unknown;
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    for (let attempt = 0; attempt < this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.apiBase.replace(/\/$/, "")}/chat/completions`, {
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
        if (!response.ok) {
          throw new MistralHttpError(
            response.status,
            `Mistral API ${response.status}: ${await response.text()}`,
            parseRetryAfter(response.headers.get("retry-after")),
          );
        }
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
        lastError = isAbortError(error)
          ? new Error(`Mistral request timed out after ${timeoutMs}ms on attempt ${attempt + 1}/${this.retries}`)
          : error;
        if (attempt + 1 < this.retries && isRetryable(error)) await delay(retryDelay(error, attempt));
        else break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Mistral request timed out");
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryable(error: unknown): boolean {
  if (isAbortError(error)) return true;
  if (error instanceof MistralHttpError) return error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500;
  return error instanceof TypeError && /fetch/i.test(error.message);
}

function retryDelay(error: unknown, attempt: number): number {
  if (error instanceof MistralHttpError && error.status === 429) return error.retryAfterMs ?? Math.min(8_000, 2_000 * 2 ** attempt);
  return Math.min(2_000, 250 * 2 ** attempt);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MissingClient implements IntelligenceModelClient {
  async complete<T>(_request: CompletionRequest<T>): Promise<CompletionResult<T>> {
    throw new Error("MISTRAL_API_KEY is not configured");
  }
}
