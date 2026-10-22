import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertUsableCompletion,
  CompletionQualityError,
  interpretGoogleResponse,
} from "../src/provider.js";
import {
  buildAggregate,
  CIRCUIT_BREAKER_LIMIT,
  INCOMPLETE_BANNER,
  nextConsecutiveErrors,
  redactSecrets,
  resolveOutputDirs,
  sanitizeAbsolutePaths,
  toRepoRelativeDocsPath,
  writeAggregates,
  writeRawAttempt,
  type AttemptRecord,
  type AggregateResult,
} from "../src/results.js";
import { parseTaskIds, selectTasks, type Task } from "../src/tasks.js";

const sampleTasks: Task[] = [
  {
    id: "T1",
    type: "answer",
    prompt: "p1",
    expect: { answer: 1 },
    fairness: "f",
  },
  {
    id: "T2",
    type: "answer",
    prompt: "p2",
    expect: { answer: 2 },
    fairness: "f",
  },
];

function attempt(
  overrides: Partial<AttemptRecord> & Pick<AttemptRecord, "outcome" | "taskId" | "run">,
): AttemptRecord {
  return {
    provider: "stub",
    model: "fake",
    temperature: 0,
    thinkingSetting: null,
    date: new Date().toISOString(),
    rawModelOutput: "",
    pass: overrides.outcome === "pass",
    failureReason: null,
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
    retries: [],
    ...overrides,
  };
}

describe("Google completion quality (finishReason / empty)", () => {
  it("accepts STOP with non-empty text", () => {
    const r = interpretGoogleResponse({
      text: '{"answer":1}',
      candidates: [{ finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1 },
    });
    expect(r.text).toContain("answer");
    expect(r.finishReason).toBe("STOP");
  });

  it("blocked SAFETY → CompletionQualityError (error, not fail)", () => {
    expect(() =>
      interpretGoogleResponse({
        text: "blocked body",
        candidates: [{ finishReason: "SAFETY" }],
      }),
    ).toThrow(CompletionQualityError);
    try {
      interpretGoogleResponse({
        text: "blocked body",
        candidates: [{ finishReason: "SAFETY" }],
      });
    } catch (err) {
      expect(err).toBeInstanceOf(CompletionQualityError);
      if (err instanceof CompletionQualityError) {
        expect(err.finishReason).toBe("SAFETY");
        expect(err.message).toMatch(/SAFETY/);
      }
    }
  });

  it("truncated MAX_TOKENS → CompletionQualityError", () => {
    expect(() =>
      interpretGoogleResponse({
        text: '{"command":"partial',
        candidates: [{ finishReason: "MAX_TOKENS" }],
      }),
    ).toThrow(/MAX_TOKENS/);
  });

  it("empty text → CompletionQualityError even with STOP", () => {
    expect(() =>
      interpretGoogleResponse({
        text: "   ",
        candidates: [{ finishReason: "STOP" }],
      }),
    ).toThrow(/empty model text/);
  });

  it("assertUsableCompletion allows missing finishReason when text present", () => {
    expect(() => assertUsableCompletion("ok", null)).not.toThrow();
  });
});

describe("circuit breaker", () => {
  it("trips after 3 consecutive errors and resets on non-error", () => {
    let n = 0;
    n = nextConsecutiveErrors(n, "error");
    n = nextConsecutiveErrors(n, "error");
    expect(n).toBe(2);
    n = nextConsecutiveErrors(n, "fail");
    expect(n).toBe(0);
    n = nextConsecutiveErrors(n, "error");
    n = nextConsecutiveErrors(n, "error");
    n = nextConsecutiveErrors(n, "error");
    expect(n).toBe(CIRCUIT_BREAKER_LIMIT);
  });

  it("incomplete write uses INCOMPLETE RUN banner", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-incomplete-"));
    try {
      const attempts = [
        attempt({ taskId: "T1", run: 1, outcome: "error", failureReason: "e1" }),
        attempt({ taskId: "T1", run: 2, outcome: "error", failureReason: "e2" }),
        attempt({ taskId: "T1", run: 3, outcome: "error", failureReason: "e3" }),
      ];
      const agg = buildAggregate(
        "smoke-cb",
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
      const { jsonPath, mdPath } = await writeAggregates(dir, "smoke-cb", agg, {
        incomplete: true,
      });
      const json = await readFile(jsonPath, "utf8");
      const md = await readFile(mdPath, "utf8");
      expect(json.startsWith(`${INCOMPLETE_BANNER}\n`)).toBe(true);
      expect(md.startsWith(`${INCOMPLETE_BANNER}\n`)).toBe(true);
      expect(json).toContain('"incomplete": true');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("relative docs paths + absolute path sanitization", () => {
  it("toRepoRelativeDocsPath strips the repo root", () => {
    const root = "/repo/root";
    expect(toRepoRelativeDocsPath(root, "/repo/root/docs/src/content/docs")).toBe(
      "docs/src/content/docs",
    );
    expect(toRepoRelativeDocsPath(root, "docs-v2")).toBe("docs-v2");
  });

  it("sanitizeAbsolutePaths replaces a fake absolute path", () => {
    const fake = "/Users/someone/Projects/secret-box/docs/src/content/docs";
    const cleaned = sanitizeAbsolutePaths(`Docs: ${fake} and again ${fake}`);
    expect(cleaned).not.toContain("/Users/");
    expect(cleaned).not.toContain("someone");
    expect(cleaned).toContain("[PATH]");
  });

  it("written results never contain an absolute docs path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-relpath-"));
    const absDocs = "/Users/fakeuser/Projects/docs-the-agent-can-read/docs/src/content/docs";
    try {
      const record = attempt({
        taskId: "T1",
        run: 1,
        outcome: "error",
        failureReason: `failed reading ${absDocs}`,
        docsPath: absDocs,
      });
      await writeRawAttempt(dir, record, {
        repoRoot: "/Users/fakeuser/Projects/docs-the-agent-can-read",
      });
      const files = await readdir(dir);
      const body = await readFile(join(dir, files[0]!), "utf8");
      expect(body).not.toContain("/Users/");
      expect(body).not.toContain("fakeuser");
      expect(body).toMatch(/\[PATH\]|docs\/src\/content\/docs/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("API key redaction", () => {
  it("redacts secret value from strings", () => {
    const key = "super-secret-test-key-xyz";
    expect(redactSecrets(`boom ${key} boom`, [key])).toBe("boom [REDACTED] boom");
  });

  it("key embedded in failureReason never reaches results files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-redact-"));
    const key = "live-api-key-value-SHOULD-NOT-LEAK";
    try {
      const record = attempt({
        taskId: "T1",
        run: 1,
        outcome: "error",
        failureReason: `provider said invalid key ${key} please retry`,
        rawModelOutput: `echo ${key}`,
      });
      await writeRawAttempt(dir, record, { secrets: [key] });
      const files = await readdir(dir);
      const body = await readFile(join(dir, files[0]!), "utf8");
      expect(body).not.toContain(key);
      expect(body).toContain("[REDACTED]");

      const agg: AggregateResult = {
        label: "smoke-redact",
        provider: "google",
        model: "m",
        temperature: 0,
        thinkingSetting: "minimal",
        date: new Date().toISOString(),
        systemPromptHash: "h",
        pricingSourceUrl: "https://example.com",
        pricingLookupDate: "2026-10-22",
        runsPerTask: 1,
        contextMode: "full",
        topK: null,
        docsPath: "synth",
        docsCorpusHash: "h",
        tasks: [],
        overallPasses: 0,
        overallScoredRuns: 0,
        overallErrors: 1,
        overallPassRate: "0/0",
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalCostUsd: 0,
        attempts: [record],
      };
      const { jsonPath, mdPath } = await writeAggregates(dir, "smoke-redact", agg, {
        secrets: [key],
      });
      const json = await readFile(jsonPath, "utf8");
      const md = await readFile(mdPath, "utf8");
      expect(json).not.toContain(key);
      expect(md).not.toContain(key);
      expect(json).toContain("[REDACTED]");
      expect(json).not.toMatch(/\/Users\//);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("--tasks and smoke paths", () => {
  it("parseTaskIds splits commas", () => {
    expect(parseTaskIds("T1, T2")).toEqual(["T1", "T2"]);
  });

  it("baseline/improved live refuse --tasks", () => {
    const bad = selectTasks(sampleTasks, {
      label: "baseline",
      dryRun: false,
      taskIds: ["T1"],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toMatch(/all tasks/);

    const improved = selectTasks(sampleTasks, {
      label: "improved",
      dryRun: false,
      taskIds: ["T1"],
    });
    expect(improved.ok).toBe(false);
  });

  it("smoke label may filter tasks", () => {
    const ok = selectTasks(sampleTasks, {
      label: "smoke-t1",
      dryRun: false,
      taskIds: ["T1"],
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.tasks.map((t) => t.id)).toEqual(["T1"]);
  });

  it("smoke labels resolve under results/<label>/", () => {
    const r = resolveOutputDirs("/repo", { dryRun: false, label: "smoke-t1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultsDir).toBe(join("/repo", "results", "smoke-t1"));
    expect(r.rawDir).toBe(join("/repo", "results", "smoke-t1", "raw"));
  });
});
