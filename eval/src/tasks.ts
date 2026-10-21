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
