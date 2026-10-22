import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveOutputDirs,
  STUB_BANNER,
  writeAggregates,
  writeRawAttempt,
  type AttemptRecord,
  type AggregateResult,
} from "../src/results.js";

const sampleAttempt = (): AttemptRecord => ({
  taskId: "T1",
  run: 1,
  provider: "stub",
  model: "stub-dry-run",
  temperature: 0,
  thinkingSetting: null,
  date: new Date().toISOString(),
  rawModelOutput: "{}",
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
});

describe("dry-run vs real result paths", () => {
  it("dry-run resolves under results/dry-run/", () => {
    const r = resolveOutputDirs("/repo", { dryRun: true, label: "baseline" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stub).toBe(true);
    expect(r.resultsDir).toBe(join("/repo", "results", "dry-run"));
    expect(r.rawDir).toBe(join("/repo", "results", "dry-run", "raw"));
  });

  it("real run resolves under results/ and refuses label dry-run", () => {
    const ok = resolveOutputDirs("/repo", { dryRun: false, label: "baseline" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.stub).toBe(false);
      expect(ok.resultsDir).toBe(join("/repo", "results"));
    }
    const bad = resolveOutputDirs("/repo", { dryRun: false, label: "dry-run" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toMatch(/dry-run/);
  });

  it("stub writes start with STUB - NOT REAL RESULTS", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-stub-out-"));
    try {
      const agg: AggregateResult = {
        label: "baseline",
        provider: "stub",
        model: "stub-dry-run",
        temperature: 0,
        thinkingSetting: null,
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
        overallErrors: 0,
        overallPassRate: "0/0",
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalCostUsd: 0,
        attempts: [],
      };
      const { jsonPath, mdPath } = await writeAggregates(dir, "baseline", agg, { stub: true });
      const json = await readFile(jsonPath, "utf8");
      const md = await readFile(mdPath, "utf8");
      expect(json.startsWith(`${STUB_BANNER}\n`)).toBe(true);
      expect(md.startsWith(`${STUB_BANNER}\n`)).toBe(true);

      await writeRawAttempt(dir, sampleAttempt(), { stub: true });
      const { readdir } = await import("node:fs/promises");
      const files = (await readdir(dir)).filter((f) => f.startsWith("T1-"));
      const raw = await readFile(join(dir, files[0]!), "utf8");
      expect(raw.startsWith(`${STUB_BANNER}\n`)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
