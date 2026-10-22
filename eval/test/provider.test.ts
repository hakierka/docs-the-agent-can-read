import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  completeWithRetry,
  HttpStatusError,
  isRateLimitError,
  parseRetryHintMs,
  requireProviderApiKey,
  resolveRetryWaitMs,
  RetriesExhaustedError,
  type EvalProvider,
} from "../src/provider.js";
import { buildAggregate, writeRawAttempt, type AttemptRecord } from "../src/results.js";

function fakeProvider(
  sequence: Array<"ok" | 429 | Error>,
  rateLimitMessage = "rate limited",
): EvalProvider {
  let i = 0;
  return {
    name: "stub",
    modelId: "fake",
    thinkingSetting: null,
    async complete() {
      const step = sequence[Math.min(i, sequence.length - 1)]!;
      i++;
      if (step === "ok") {
        return { text: '{"answer":1}', inputTokens: 3, outputTokens: 2, thinkingTokens: 0 };
      }
      if (step === 429) {
        throw new HttpStatusError(429, rateLimitMessage);
      }
      throw step;
    },
  };
}

describe("provider interface + retry", () => {
  it("fake provider returns text and tokens", async () => {
    const p = fakeProvider(["ok"]);
    const r = await p.complete("sys", "user");
    expect(r.text).toContain("answer");
    expect(r.inputTokens).toBe(3);
  });

  it("retries on 429 at most twice then succeeds", async () => {
    const p = fakeProvider([429, 429, "ok"]);
    const { result, retries } = await completeWithRetry(p, "s", "u", {
      maxRetries: 2,
      backoffMs: 1,
    });
    expect(result.text).toContain("answer");
    expect(retries).toHaveLength(2);
    expect(retries.every((r) => r.status === 429)).toBe(true);
  });

  it("after 429 retries exhausted, error carries all retry records", async () => {
    const p = fakeProvider([429, 429, 429], "Please retry in 1s — quota");
    const waits: number[] = [];
    let caught: unknown;
    try {
      await completeWithRetry(p, "s", "u", {
        maxRetries: 2,
        backoffMs: 1,
        sleepFn: async (ms) => {
          waits.push(ms);
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RetriesExhaustedError);
    const exhausted = caught as RetriesExhaustedError;
    expect(exhausted.status).toBe(429);
    expect(exhausted.retries).toHaveLength(3);
    expect(exhausted.retries.every((r) => r.status === 429)).toBe(true);
    expect(exhausted.retries.map((r) => r.attempt)).toEqual([1, 2, 3]);
    expect(exhausted.retries.every((r) => r.message.includes("Please retry in"))).toBe(
      true,
    );
    // Two sleeps between three attempts.
    expect(waits).toHaveLength(2);
  });

  it("honors Please retry in hint over shorter scheduled backoff (capped at 65s)", async () => {
    const p = fakeProvider(
      [429, "ok"],
      'quota hit. Please retry in 2.5s. {"retryDelay":"2s"}',
    );
    const waits: number[] = [];
    const { result, retries } = await completeWithRetry(p, "s", "u", {
      maxRetries: 2,
      backoffMs: 100,
      sleepFn: async (ms) => {
        waits.push(ms);
      },
    });
    expect(result.text).toContain("answer");
    expect(retries).toHaveLength(1);
    // max(2500ms hint, 100*1 scheduled) = 2500
    expect(waits).toEqual([2500]);
    expect(parseRetryHintMs(new Error("Please retry in 9.194102525s."))).toBe(9195);
    expect(parseRetryHintMs(new Error('"retryDelay":"58s"'))).toBe(58000);
    expect(resolveRetryWaitMs(0, 1000, new Error("Please retry in 90s"))).toBe(65000);
  });

  it("isRateLimitError detects 429", () => {
    expect(isRateLimitError(new HttpStatusError(429, "x"))).toBe(true);
    expect(isRateLimitError(new Error("boom"))).toBe(false);
  });

  it("error outcomes are excluded from pass rate but counted", () => {
    const attempts: AttemptRecord[] = [
      {
        taskId: "T1",
        run: 1,
        provider: "stub",
        model: "fake",
        temperature: 0,
        thinkingSetting: null,
        date: new Date().toISOString(),
        rawModelOutput: "",
        outcome: "pass",
        pass: true,
        failureReason: null,
        finishReason: null,
        inputTokens: 1,
        outputTokens: 1,
        thinkingTokens: null,
        costUsd: 0,
        systemPromptHash: "h",
        contextMode: "full" as const,
        topK: null,
        docsPath: "synth",
        docsCorpusHash: "h",
        retrieved: [],
        contextChars: 0,
        retries: [],
      },
      {
        taskId: "T1",
        run: 2,
        provider: "stub",
        model: "fake",
        temperature: 0,
        thinkingSetting: null,
        date: new Date().toISOString(),
        rawModelOutput: "",
        outcome: "error",
        pass: false,
        failureReason: "rate limited",
        finishReason: null,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: null,
        costUsd: 0,
        systemPromptHash: "h",
        contextMode: "full" as const,
        topK: null,
        docsPath: "synth",
        docsCorpusHash: "h",
        retrieved: [],
        contextChars: 0,
        retries: [{ attempt: 1, status: 429, at: new Date().toISOString(), message: "429" }],
      },
      {
        taskId: "T1",
        run: 3,
        provider: "stub",
        model: "fake",
        temperature: 0,
        thinkingSetting: null,
        date: new Date().toISOString(),
        rawModelOutput: "",
        outcome: "fail",
        pass: false,
        failureReason: "wrong",
        finishReason: null,
        inputTokens: 1,
        outputTokens: 1,
        thinkingTokens: null,
        costUsd: 0,
        systemPromptHash: "h",
        contextMode: "full" as const,
        topK: null,
        docsPath: "synth",
        docsCorpusHash: "h",
        retrieved: [],
        contextChars: 0,
        retries: [],
      },
    ];
    const agg = buildAggregate(
      "t",
      "stub",
      "fake",
      0,
      null,
      "h",
      "https://example.com",
      "2026-10-22",
      3,
      attempts,
    );
    expect(agg.overallErrors).toBe(1);
    expect(agg.overallPassRate).toBe("1/2");
    expect(agg.tasks[0]!.consistency).toBe("1/2");
    expect(agg.tasks[0]!.errors).toBe(1);
  });
});

describe("API key refusal", () => {
  it("refuses missing GEMINI_API_KEY for google", () => {
    const r = requireProviderApiKey("google", { CI: undefined, GEMINI_API_KEY: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/GEMINI_API_KEY/);
  });

  it("refuses when CI is set", () => {
    const r = requireProviderApiKey("google", { CI: "true", GEMINI_API_KEY: "not-a-real-key" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/CI/);
  });

  it("accepts present GEMINI_API_KEY when not in CI", () => {
    const r = requireProviderApiKey("google", { GEMINI_API_KEY: "test-placeholder" });
    expect(r.ok).toBe(true);
  });
});

describe("results never contain key-like strings", () => {
  it("writeRawAttempt refuses key-shaped content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-raw-"));
    try {
      const record: AttemptRecord = {
        taskId: "T1",
        run: 1,
        provider: "google",
        model: "gemini-3.5-flash-lite",
        temperature: 0,
        thinkingSetting: "minimal",
        date: new Date().toISOString(),
        rawModelOutput: "leak AIzaSyDummyKeyValue1234567890abcdef",
        outcome: "fail",
        pass: false,
        failureReason: "x",
        finishReason: null,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: null,
        costUsd: null,
        systemPromptHash: "h",
        contextMode: "full" as const,
        topK: null,
        docsPath: "synth",
        docsCorpusHash: "h",
        retrieved: [],
        contextChars: 0,
        retries: [],
      };
      await expect(writeRawAttempt(dir, record)).rejects.toThrow(/API key/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("normal raw write has no GEMINI_API_KEY value field", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-raw-"));
    try {
      const record: AttemptRecord = {
        taskId: "T1",
        run: 1,
        provider: "stub",
        model: "stub-dry-run",
        temperature: 0,
        thinkingSetting: null,
        date: new Date().toISOString(),
        rawModelOutput: '{"command":"cat-status 404"}',
        outcome: "pass",
        pass: true,
        failureReason: null,
        finishReason: null,
        inputTokens: 1,
        outputTokens: 1,
        thinkingTokens: null,
        costUsd: 0,
        systemPromptHash: "h",
        retries: [],
      };
      await writeRawAttempt(dir, record);
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(dir);
      const body = await readFile(join(dir, files[0]!), "utf8");
      expect(body).not.toMatch(/GEMINI_API_KEY\s*=/);
      expect(body).not.toMatch(/AIza/);
      expect(body).not.toMatch(/sk-/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
