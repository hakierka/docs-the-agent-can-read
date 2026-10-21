import type { ModelCompleteResult, ModelClient } from "./model.js";

export type ProviderName = "anthropic" | "google" | "stub";

export type ProviderCompleteResult = ModelCompleteResult & {
  thinkingTokens?: number | null;
  /** Google finishReason when available; null for stub/Anthropic. */
  finishReason?: string | null;
};

export type EvalProvider = {
  name: ProviderName;
  modelId: string;
  /** Recorded thinking control, e.g. "minimal", "off", or null for stub. */
  thinkingSetting: string | null;
  complete(system: string, user: string): Promise<ProviderCompleteResult>;
};

export type RetryRecord = {
  attempt: number;
  status: number;
  at: string;
  message: string;
};

export class HttpStatusError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

/** Non-STOP finishReason or empty text — always scored as outcome "error", never "fail". */
export class CompletionQualityError extends Error {
  readonly finishReason: string | null;
  constructor(message: string, finishReason: string | null) {
    super(message);
    this.name = "CompletionQualityError";
    this.finishReason = finishReason;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(err: unknown): boolean {
  if (err instanceof HttpStatusError && err.status === 429) return true;
  if (err && typeof err === "object") {
    const e = err as { status?: number; statusCode?: number; code?: number | string };
    if (e.status === 429 || e.statusCode === 429 || e.code === 429) return true;
    if (e.code === "RESOURCE_EXHAUSTED") return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg);
}

/**
 * Empty text → error. When finishReason is present, anything other than STOP → error.
 * Missing finishReason (stub/Anthropic) is allowed if text is non-empty.
 */
export function assertUsableCompletion(
  text: string,
  finishReason: string | null | undefined,
): void {
  const fr = finishReason ?? null;
  if (!text.trim()) {
    throw new CompletionQualityError(
      `empty model text (finishReason=${fr ?? "unknown"})`,
      fr,
    );
  }
  if (fr != null && fr !== "STOP") {
    throw new CompletionQualityError(`finishReason=${fr} (expected STOP)`, fr);
  }
}

/** Pure helper for tests: fake Google-shaped response → usable completion or throw. */
export function interpretGoogleResponse(response: {
  text?: string | null;
  candidates?: Array<{ finishReason?: string | null } | undefined> | null;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  } | null;
}): ProviderCompleteResult {
  const finishReason = response.candidates?.[0]?.finishReason ?? null;
  const text = response.text ?? "";
  assertUsableCompletion(text, finishReason);
  const usage = response.usageMetadata;
  return {
    text,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    thinkingTokens: usage?.thoughtsTokenCount ?? null,
    finishReason,
  };
}

/**
 * Call provider.complete with up to 2 retries on HTTP 429 (3 attempts total).
 * Every retry is recorded; after exhaustion the error is rethrown.
 */
export async function completeWithRetry(
  provider: EvalProvider,
  system: string,
  user: string,
  options: { maxRetries?: number; backoffMs?: number } = {},
): Promise<{ result: ProviderCompleteResult; retries: RetryRecord[] }> {
  const maxRetries = options.maxRetries ?? 2;
  const backoffMs = options.backoffMs ?? 1000;
  const retries: RetryRecord[] = [];
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await provider.complete(system, user);
      return { result, retries };
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || attempt === maxRetries) {
        throw err;
      }
      retries.push({
        attempt: attempt + 1,
        status: 429,
        at: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
      });
      await sleep(backoffMs * (attempt + 1));
    }
  }
  throw lastErr;
}

export function requireProviderApiKey(
  provider: ProviderName,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; key: string } | { ok: false; reason: string } {
  if (provider === "stub") {
    return { ok: true, key: "" };
  }
  if (env.CI) {
    return { ok: false, reason: "refuse: CI is set; eval runner must not run in CI" };
  }
  if (provider === "google") {
    const key = env.GEMINI_API_KEY;
    if (!key) return { ok: false, reason: "refuse: GEMINI_API_KEY is missing" };
    return { ok: true, key };
  }
  if (provider === "anthropic") {
    const key = env.ANTHROPIC_API_KEY;
    if (!key) return { ok: false, reason: "refuse: ANTHROPIC_API_KEY is missing" };
    return { ok: true, key };
  }
  return { ok: false, reason: `refuse: unknown provider ${provider}` };
}

/** Wrap an existing ModelClient as an EvalProvider (Anthropic / stub). */
export function wrapModelClient(
  name: ProviderName,
  client: ModelClient,
  thinkingSetting: string | null,
): EvalProvider {
  return {
    name,
    modelId: client.id,
    thinkingSetting,
    async complete(system, user) {
      const r = await client.complete(system, user);
      return { ...r, finishReason: null };
    },
  };
}

export async function createGoogleProvider(
  modelId: string,
  temperature: number,
  apiKey: string,
  thinkingLevel: string = "minimal",
): Promise<EvalProvider> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "google",
    modelId,
    thinkingSetting: thinkingLevel,
    async complete(system, user) {
      try {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: user,
          config: {
            temperature,
            maxOutputTokens: 512,
            systemInstruction: system,
            thinkingConfig: {
              // Cap thinking for lite eval runs (MINIMAL ≈ "no thinking" for most queries).
              // Docs: https://ai.google.dev/gemini-api/docs/thinking
              thinkingLevel: thinkingLevel as "minimal" | "low" | "medium" | "high",
            },
          },
        });
        return interpretGoogleResponse({
          text: response.text,
          candidates: response.candidates?.map((c) => ({
            finishReason: c.finishReason != null ? String(c.finishReason) : null,
          })),
          usageMetadata: response.usageMetadata,
        });
      } catch (err) {
        if (err instanceof CompletionQualityError) throw err;
        if (isRateLimitError(err)) {
          throw new HttpStatusError(429, err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
  };
}
