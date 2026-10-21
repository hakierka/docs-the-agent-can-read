import {
  checkAnswer,
  checkCommand,
  parseModelOutput,
  type CheckResult,
} from "./check.js";
import type { Task } from "./tasks.js";

export async function scoreModelOutput(task: Task, raw: string): Promise<CheckResult> {
  const parsed = parseModelOutput(raw);
  if (!parsed.ok) return parsed;

  if (task.type === "command") {
    if (parsed.value.kind !== "command") {
      return { ok: false, reason: "expected a command object for this task" };
    }
    return checkCommand(parsed.value.command, task.expect);
  }

  if (parsed.value.kind !== "answer") {
    return { ok: false, reason: "expected an answer object for this task" };
  }
  return checkAnswer(parsed.value.answer, task.expect);
}
