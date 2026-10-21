import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTasks } from "../src/tasks.js";
import { scoreModelOutput } from "../src/score.js";
import { buildAggregate } from "../src/results.js";
import { createStubModel, buildUserMessage, loadSystemPrompt } from "../src/model.js";
import { loadDocsCorpus, defaultDocsContentDir } from "../src/docs.js";

const EVAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(EVAL_ROOT, "..");

describe("scoring + stub rendering", () => {
  it("rejects malformed JSON", async () => {
    const tasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
    const r = await scoreModelOutput(tasks[0]!, "not json at all");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not valid JSON/);
  });

  it("rejects JSON with extra keys", async () => {
    const tasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
    const r = await scoreModelOutput(
      tasks[0]!,
      JSON.stringify({ command: "cat-status 404", note: "x" }),
    );
    expect(r.ok).toBe(false);
  });

  it("stub dry-run mix: some pass some fail; builds aggregate markdown fields", async () => {
    const tasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
    const stub = createStubModel();
    const { text: system, hash } = await loadSystemPrompt(join(EVAL_ROOT, "system-prompt.txt"));
    const docs = await loadDocsCorpus(defaultDocsContentDir(REPO_ROOT), join(REPO_ROOT, "docs"));

    const attempts = [];
    for (const task of tasks) {
      const user = buildUserMessage(task, docs);
      const completion = await stub.complete(system, user);
      const scored = await scoreModelOutput(task, completion.text);
      attempts.push({
        taskId: task.id,
        run: 1,
        model: stub.id,
        temperature: 0,
        date: new Date().toISOString(),
        rawModelOutput: completion.text,
        pass: scored.ok,
        failureReason: scored.ok ? null : scored.reason,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        costUsd: 0,
        systemPromptHash: hash,
      });
    }

    const agg = buildAggregate(
      "baseline",
      stub.id,
      0,
      hash,
      "https://platform.claude.com/docs/en/about-claude/pricing",
      "2026-10-21",
      1,
      attempts,
    );

    expect(agg.tasks.find((t) => t.id === "T1")?.passes).toBe(1);
    expect(agg.tasks.find((t) => t.id === "T1")?.consistency).toBe("1/1");
    expect(agg.tasks.find((t) => t.id === "T3")?.passes).toBe(0);
    expect(agg.tasks.find((t) => t.id === "T5")?.passes).toBe(0);
    expect(agg.tasks.find((t) => t.id === "T6")?.passes).toBe(0);
    expect(agg.tasks.find((t) => t.id === "T9")?.passes).toBe(0);
    expect(agg.tasks.find((t) => t.id === "T10")?.passes).toBe(0);
    expect(agg.overallPasses).toBeGreaterThan(0);
    expect(agg.overallPasses).toBeLessThan(agg.overallRuns);
    expect(agg.attempts.every((a) => typeof a.inputTokens === "number")).toBe(true);
    expect(agg.attempts.every((a) => typeof a.outputTokens === "number")).toBe(true);
    expect(agg.systemPromptHash).toBe(hash);
  });
});
