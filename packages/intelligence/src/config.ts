export interface IntelligenceConfig {
  apiKey: string | undefined;
  apiBase: string;
  discoveryModel: string;
  codeModel: string;
  smallModel: string;
  requestTimeoutMs: number;
  retries: number;
  maxConcurrentModelCalls: number;
  cacheDir: string;
  demoMode: boolean;
}

export function loadConfig(overrides: Partial<IntelligenceConfig> = {}): IntelligenceConfig {
  const config: IntelligenceConfig = {
    apiKey: process.env.MISTRAL_API_KEY,
    apiBase: process.env.MISTRAL_API_BASE ?? "https://api.mistral.ai/v1",
    discoveryModel: process.env.MISTRAL_DISCOVERY_MODEL ?? "mistral-large-2512",
    codeModel: process.env.MISTRAL_CODE_MODEL ?? "mistral-medium-3-5",
    smallModel: process.env.MISTRAL_SMALL_MODEL ?? "mistral-small-2603",
    // Code-quality prompts carry more repository context than the deployment pass.
    // Twelve seconds was shorter than healthy code-model responses in calibration.
    requestTimeoutMs: Number(process.env.CITY_INTEL_TIMEOUT_MS ?? 30_000),
    retries: 3,
    maxConcurrentModelCalls: Number(process.env.CITY_INTEL_MODEL_CONCURRENCY ?? 2),
    cacheDir: process.env.CITY_INTEL_CACHE_DIR ?? ".city-intel-cache",
    demoMode: process.env.CITY_INTEL_DEMO_MODE === "1",
    ...overrides,
  };
  for (const model of [config.discoveryModel, config.codeModel, config.smallModel]) assertPinnedModel(model);
  if (!Number.isFinite(config.requestTimeoutMs) || config.requestTimeoutMs < 1_000) {
    throw new Error("CITY_INTEL_TIMEOUT_MS must be a finite number of at least 1000ms");
  }
  if (!Number.isInteger(config.maxConcurrentModelCalls) || config.maxConcurrentModelCalls < 1 || config.maxConcurrentModelCalls > 8) {
    throw new Error("CITY_INTEL_MODEL_CONCURRENCY must be an integer from 1 to 8");
  }
  return config;
}

function assertPinnedModel(model: string): void {
  if (!model || /-latest$/i.test(model)) {
    throw new Error(`Model IDs must be explicitly pinned; received ${JSON.stringify(model)}`);
  }
}
