import type { DocChunk } from "./chunk.js";

/** BM25 parameters (Amy). */
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

/** Ordinary function words only — not content tokens like "json". */
export const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "for",
  "in",
  "on",
  "is",
  "are",
  "be",
  "with",
  "as",
  "at",
  "by",
  "from",
  "that",
  "this",
  "it",
  "if",
  "not",
  "no",
  "do",
  "does",
  "can",
  "only",
]);

const QUERY_CUT = "Reply with JSON only";

/**
 * Truncate task prompt at first "Reply with JSON only" (phrase excluded).
 * tasks.json stays untouched; cleaning is query-time only.
 */
export function cleanQuery(prompt: string): string {
  const idx = prompt.indexOf(QUERY_CUT);
  if (idx === -1) return prompt.trim();
  return prompt.slice(0, idx).trim();
}

/**
 * Lowercase; keep `--timeout` and `cat-status`-style tokens;
 * otherwise split on whitespace and punctuation.
 */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const re = /--[a-z0-9]+(?:-[a-z0-9]+)*|[a-z0-9]+(?:-[a-z0-9]+)*/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    const tok = m[0]!;
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

export type RankedChunk = {
  chunk: DocChunk;
  score: number;
  /** Stable document order index among the corpus chunks. */
  order: number;
};

type IndexedDoc = {
  chunk: DocChunk;
  order: number;
  tf: Map<string, number>;
  len: number;
};

export type Bm25Index = {
  docs: IndexedDoc[];
  df: Map<string, number>;
  avgLen: number;
  N: number;
};

/**
 * Index title + heading path + section text only (via chunk.prefix + chunk.text).
 * Frontmatter descriptions and llms.txt are never present on rag chunks
 * (see loadDocsPages includeLlms: false and stripFrontmatter).
 */
export function buildBm25Index(chunks: DocChunk[]): Bm25Index {
  const docs: IndexedDoc[] = chunks.map((chunk, order) => {
    const tokens = tokenize(`${chunk.prefix}\n${chunk.text}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk, order, tf, len: tokens.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const term of d.tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const avgLen =
    docs.length === 0 ? 0 : docs.reduce((s, d) => s + d.len, 0) / docs.length;
  return { docs, df, avgLen, N: docs.length };
}

function idf(N: number, n: number): number {
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

export function scoreBm25(index: Bm25Index, queryTokens: string[]): RankedChunk[] {
  const qtf = new Map<string, number>();
  for (const t of queryTokens) qtf.set(t, (qtf.get(t) ?? 0) + 1);

  const ranked: RankedChunk[] = index.docs.map((d) => {
    let score = 0;
    for (const [term] of qtf) {
      const f = d.tf.get(term) ?? 0;
      if (f === 0) continue;
      const n = index.df.get(term) ?? 0;
      const termIdf = idf(index.N, n);
      const denom =
        f + BM25_K1 * (1 - BM25_B + BM25_B * (d.len / (index.avgLen || 1)));
      score += termIdf * ((f * (BM25_K1 + 1)) / denom);
    }
    return { chunk: d.chunk, score, order: d.order };
  });

  // Higher score first; ties broken by document order (stable, deterministic).
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.order - b.order;
  });
  return ranked;
}

export function retrieveTopK(
  chunks: DocChunk[],
  prompt: string,
  topK: number,
): RankedChunk[] {
  const index = buildBm25Index(chunks);
  const q = tokenize(cleanQuery(prompt));
  return scoreBm25(index, q).slice(0, Math.max(0, topK));
}
