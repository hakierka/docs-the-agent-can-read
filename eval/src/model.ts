import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Task } from "./tasks.js";

export type ModelCompleteResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export type ModelClient = {
  id: string;
  complete(system: string, user: string): Promise<ModelCompleteResult>;
};

export async function loadSystemPrompt(path: string): Promise<{ text: string; hash: string }> {
  const text = await readFile(path, "utf8");
  const hash = createHash("sha256").update(text).digest("hex");
  return { text, hash };
}

/** Deterministic stub: correct for some tasks, wrong/malformed for others. Zero API calls. */
export function createStubModel(): ModelClient {
  return {
    id: "stub-dry-run",
    async complete(_system, user) {
      const taskId = /\[task:([A-Z0-9]+)\]/.exec(user)?.[1] ?? "";
      const text = stubReply(taskId);
      return {
        text,
        inputTokens: Math.max(1, Math.ceil((_system.length + user.length) / 4)),
        outputTokens: Math.max(1, Math.ceil(text.length / 4)),
      };
    },
  };
}

function stubReply(taskId: string): string {
  switch (taskId) {
    case "T1":
      return JSON.stringify({ command: "cat-status 404" });
    case "T2":
      return JSON.stringify({ command: "cat-status 418 --json" });
    case "T3":
      // Wrong: missing --json
      return JSON.stringify({ command: "cat-status --list 4xx" });
    case "T4":
      return JSON.stringify({ command: "cat-status 200 --save cats/ok.jpg --force" });
    case "T5":
      // Wrong timeout
      return JSON.stringify({ command: "cat-status 503 --save a.jpg --timeout 5000" });
    case "T6":
      // Wrong: treated as option without --
      return JSON.stringify({ command: "cat-status -1" });
    case "T7":
      return JSON.stringify({ answer: 2 });
    case "T8":
      return JSON.stringify({ answer: 1 });
    case "T9":
      // Wrong casing / product
      return JSON.stringify({ answer: "Nginx" });
    case "T10":
      // Wrong: adds --force when told never overwrite
      return JSON.stringify({ command: "cat-status 418 --save teapot.jpg --force" });
    default:
      return "not-json";
  }
}

export async function createAnthropicModel(
  modelId: string,
  temperature: number,
  apiKey: string,
): Promise<ModelClient> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  return {
    id: modelId,
    async complete(system, user) {
      const res = await client.messages.create({
        model: modelId,
        max_tokens: 256,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = res.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");
      return {
        text,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      };
    },
  };
}

export function buildUserMessage(task: Task, docsCorpus: string): string {
  return `[task:${task.id}]\n\n## Documentation\n\n${docsCorpus}\n\n## Task\n\n${task.prompt}\n`;
}
