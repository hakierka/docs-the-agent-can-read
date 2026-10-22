import type { Task } from "./tasks.js";
import type { DocChunk } from "./chunk.js";
import { chunkPages } from "./chunk.js";
import { retrieveTopK, type RankedChunk } from "./bm25.js";
import { buildUserMessage } from "./model.js";
import type { DocPage } from "./chunk.js";

export type ContextMode = "full" | "rag";

export type RetrievedHit = {
  chunkId: string;
  score: number;
  prefix: string;
};

/**
 * Full mode: identical to historical buildUserMessage(task, docsCorpus).
 * Rag mode: only top-k chunks, each preceded by `Source: <page> > <heading path>`.
 */
export function buildContextUserMessage(
  task: Task,
  options: {
    mode: ContextMode;
    docsCorpus: string;
    pages: DocPage[];
    topK: number;
  },
): { userMessage: string; retrieved: RetrievedHit[]; contextChars: number } {
  if (options.mode === "full") {
    const userMessage = buildUserMessage(task, options.docsCorpus);
    return {
      userMessage,
      retrieved: [],
      contextChars: options.docsCorpus.length,
    };
  }

  const chunks = chunkPages(options.pages);
  const ranked = retrieveTopK(chunks, task.prompt, options.topK);
  return assembleRagUserMessage(task, ranked);
}

export function assembleRagUserMessage(
  task: Task,
  ranked: RankedChunk[],
): { userMessage: string; retrieved: RetrievedHit[]; contextChars: number } {
  const blocks: string[] = [];
  const retrieved: RetrievedHit[] = [];
  for (const r of ranked) {
    const c: DocChunk = r.chunk;
    blocks.push(`Source: ${c.prefix}\n${c.text}`);
    retrieved.push({ chunkId: c.id, score: r.score, prefix: c.prefix });
  }
  const docsBlock = blocks.join("\n\n");
  const userMessage = `[task:${task.id}]\n\n## Documentation\n\n${docsBlock}\n\n## Task\n\n${task.prompt}\n`;
  return {
    userMessage,
    retrieved,
    contextChars: docsBlock.length,
  };
}

export function validateContextFlags(options: {
  context: string;
  topK: number;
}): { ok: true; context: ContextMode } | { ok: false; reason: string } {
  if (options.context !== "full" && options.context !== "rag") {
    return { ok: false, reason: "refuse: --context must be full or rag" };
  }
  if (!Number.isInteger(options.topK) || options.topK < 1) {
    return { ok: false, reason: "refuse: --top-k must be a positive integer" };
  }
  return { ok: true, context: options.context };
}
