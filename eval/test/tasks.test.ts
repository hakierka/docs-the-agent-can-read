import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTasks } from "../src/tasks.js";
import { scoreModelOutput } from "../src/score.js";

const EVAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const correct: Record<string, string> = {
  T1: JSON.stringify({ command: "cat-status 404" }),
  T2: JSON.stringify({ command: "cat-status 418 --json" }),
  T3: JSON.stringify({ command: "cat-status --list 4xx --json" }),
  T4: JSON.stringify({ command: "cat-status 200 --save cats/ok.jpg --force" }),
  T5: JSON.stringify({ command: "cat-status 503 --save a.jpg --timeout 2000" }),
  T6: JSON.stringify({ command: "cat-status -- -1" }),
  T7: JSON.stringify({ answer: 2 }),
  T8: JSON.stringify({ answer: 1 }),
  T9: JSON.stringify({ answer: "nginx" }),
  T10: JSON.stringify({ command: "cat-status 418 --save teapot.jpg" }),
};

const wrong: Record<string, string> = {
  T1: JSON.stringify({ command: "cat-status 400" }),
  T2: JSON.stringify({ command: "cat-status 418" }),
  T3: JSON.stringify({ command: "cat-status --list 4xx" }),
  T4: JSON.stringify({ command: "cat-status 200 --save cats/ok.jpg" }),
  T5: JSON.stringify({ command: "cat-status 503 --save a.jpg --timeout 5000" }),
  T6: JSON.stringify({ command: "cat-status -1" }),
  T7: JSON.stringify({ answer: 1 }),
  T8: JSON.stringify({ answer: 2 }),
  T9: JSON.stringify({ answer: "Nginx" }),
  T10: JSON.stringify({ command: "cat-status 418 --save teapot.jpg --force" }),
};

describe("each task: correct passes, wrong fails", () => {
  it("loads ten tasks", async () => {
    const tasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
    expect(tasks.map((t) => t.id)).toEqual([
      "T1",
      "T2",
      "T3",
      "T4",
      "T5",
      "T6",
      "T7",
      "T8",
      "T9",
      "T10",
    ]);
  });

  it("correct command/answer passes for every task", async () => {
    const tasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
    for (const task of tasks) {
      const r = await scoreModelOutput(task, correct[task.id]!);
      expect(r.ok, `${task.id} should pass: ${!r.ok ? r.reason : ""}`).toBe(true);
    }
  });

  it("plausible wrong output fails for every task", async () => {
    const tasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
    for (const task of tasks) {
      const r = await scoreModelOutput(task, wrong[task.id]!);
      expect(r.ok, `${task.id} should fail`).toBe(false);
    }
  });
});
