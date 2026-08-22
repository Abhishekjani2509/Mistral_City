export interface IntelligenceConfig {
  apiKey: string | undefined;
  apiBase: string;
  discoveryModel: string;
  codeModel: string;
  smallModel: string;
  requestTimeoutMs: number;
  retries: number;
  cacheDir: string;
  demoMode: boolean;
}

export function loadConfig(overrides: Partial<IntelligenceConfig> = {}): IntelligenceConfig {
  return {
    apiKey: process.env.MISTRAL_API_KEY,
    apiBase: process.env.MISTRAL_API_BASE ?? "https://api.mistral.ai/v1",
    discoveryModel: process.env.MISTRAL_DISCOVERY_MODEL ?? "mistral-large-2512",
    codeModel: process.env.MISTRAL_CODE_MODEL ?? "devstral-2512",
    smallModel: process.env.MISTRAL_SMALL_MODEL ?? "mistral-small-2506",
    requestTimeoutMs: Number(process.env.CITY_INTEL_TIMEOUT_MS ?? 12_000),
    retries: 3,
    cacheDir: process.env.CITY_INTEL_CACHE_DIR ?? ".city-intel-cache",
    demoMode: process.env.CITY_INTEL_DEMO_MODE === "1",
    ...overrides,
  };
}
