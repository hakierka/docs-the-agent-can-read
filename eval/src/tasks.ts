import { readFile } from "node:fs/promises";
import type { AnswerExpect, CommandExpect } from "./check.js";

export type CommandTask = {
  id: string;
  type: "command";
  prompt: string;
  expect: CommandExpect;
  fairness: string;
};

export type AnswerTask = {
  id: string;
  type: "answer";
  prompt: string;
  expect: AnswerExpect;
  fairness: string;
};

export type Task = CommandTask | AnswerTask;

export type TaskFile = {
  version: number;
  tasks: Task[];
};

export async function loadTasks(path: string): Promise<Task[]> {
  const data = JSON.parse(await readFile(path, "utf8")) as TaskFile;
  return data.tasks;
}

/** Parse `--tasks T1,T2` into ids (trimmed, non-empty). */
export function parseTaskIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Live baseline/improved must run all tasks (refuse --tasks).
 * Otherwise filter to the requested ids (order preserved from file).
 */
export function selectTasks(
  all: Task[],
  options: { label: string; dryRun: boolean; taskIds: string[] | null },
): { ok: true; tasks: Task[] } | { ok: false; reason: string } {
  const ids = options.taskIds;
  if (
    !options.dryRun &&
    (options.label === "baseline" || options.label === "improved") &&
    ids != null &&
    ids.length > 0
  ) {
    return {
      ok: false,
      reason: `refuse: label "${options.label}" must use all tasks; omit --tasks`,
    };
  }
  if (ids == null || ids.length === 0) {
    return { ok: true, tasks: all };
  }
  const selected: Task[] = [];
  for (const id of ids) {
    const task = all.find((t) => t.id === id);
    if (!task) {
      return { ok: false, reason: `refuse: unknown task id "${id}"` };
    }
    selected.push(task);
  }
  return { ok: true, tasks: selected };
}
