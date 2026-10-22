import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chunkPage, chunkPages, uniquifyChunkIds, type DocPage } from "../src/chunk.js";
import {
  buildBm25Index,
  cleanQuery,
  retrieveTopK,
  scoreBm25,
  tokenize,
} from "../src/bm25.js";
import {
  assembleRagUserMessage,
  buildContextUserMessage,
  validateContextFlags,
} from "../src/context.js";
import { buildUserMessage, loadSystemPrompt } from "../src/model.js";
import { hashDocsSources, loadDocsCorpus, loadDocsPages } from "../src/docs.js";
import { selectTasks, type Task } from "../src/tasks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYNTH = join(__dirname, "fixtures", "synth-content");
const REPO_ROOT = join(__dirname, "..", "..");
const EVAL_ROOT = join(__dirname, "..");

const alpha: DocPage = {
  file: "command-reference.md",
  title: "Alpha Page",
  body: `Intro text before any heading. Mentions cat-status briefly.

## Flags

Flags overview for synth.

### --timeout

The \`--timeout\` flag sets milliseconds. Example uses cat-status.

## Other

Unrelated section about widgets.`,
};

const beta: DocPage = {
  file: "quick-start.md",
  title: "Beta Page",
  body: "Whole page with no section headings. Talks about save and force overwrite.",
};

describe("chunker (synthetic)", () => {
  it("splits ## / ### with nested heading path; no --intro chunk", () => {
    const chunks = chunkPage(alpha);
    expect(chunks.some((c) => c.id.endsWith("--intro"))).toBe(false);
    const timeout = chunks.find((c) => c.prefix.includes("--timeout"));
    expect(timeout).toBeTruthy();
    expect(timeout!.prefix).toBe("Alpha Page > Flags > --timeout");
    expect(timeout!.text).toMatch(/milliseconds/);
    expect(timeout!.id).toContain("timeout");
  });

  it("merges page preamble into the first section chunk (id stays first section)", () => {
    const page: DocPage = {
      file: "preamble-merge.md",
      title: "Preamble Page",
      body: `Preamble line about cat-status before any heading.

## First Section

Body of the first section.

## Second Section

Body of the second section.`,
    };
    const chunks = chunkPage(page);
    expect(chunks.some((c) => c.id.endsWith("--intro"))).toBe(false);
    expect(chunks[0]!.id).toBe("preamble-merge--first-section");
    expect(chunks[0]!.text).toMatch(/^Preamble line about cat-status/);
    expect(chunks[0]!.text).toContain("Body of the first section.");
    expect(chunks[1]!.id).toBe("preamble-merge--second-section");
    expect(chunks[1]!.text).not.toContain("Preamble line");
    expect(chunks[1]!.text).toBe("Body of the second section.");
  });

  it("no-heading page → one chunk under page title", () => {
    const chunks = chunkPage(beta);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.prefix).toBe("Beta Page");
    expect(chunks[0]!.id).toBe("quick-start");
  });

  it("prefixes and ids are stable", () => {
    const a = chunkPages([alpha, beta]).map((c) => c.id);
    const b = chunkPages([alpha, beta]).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it("ignores ## / ### inside fenced code blocks", () => {
    const page: DocPage = {
      file: "fenced.md",
      title: "Fenced",
      body: `Before.

\`\`\`bash
## not a heading
echo hi
\`\`\`

## Real

Outside the fence.

~~~
### also not a heading
~~~
`,
    };
    const chunks = chunkPage(page);
    const ids = chunks.map((c) => c.id);
    expect(ids).not.toContain("fenced--not-a-heading");
    expect(ids.some((id) => id.includes("also-not"))).toBe(false);
    expect(chunks.some((c) => c.headingPath === "Real")).toBe(true);
    expect(chunks.find((c) => c.headingPath === "Real")!.text).toMatch(/Outside the fence/);
    // Fenced fake heading text stays inside the prior (preamble-merged) chunk body.
    expect(chunks.some((c) => c.text.includes("## not a heading"))).toBe(true);
  });

  it("v1 docs chunk id inventory matches needed-chunks.md exactly", async () => {
    const docsDir = join(REPO_ROOT, "docs", "src", "content", "docs");
    const pages = await loadDocsPages(docsDir, join(REPO_ROOT, "docs"), {
      includeLlms: false,
    });
    const ids = chunkPages(pages).map((c) => c.id);
    const md = await readFile(join(EVAL_ROOT, "needed-chunks.md"), "utf8");
    const listed = [...md.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]!);
    expect(listed.length).toBeGreaterThan(0);
    expect(ids).toEqual(listed);
  });

  it("drops empty ## / ### sections (no orphan preamble chunk when a section exists)", () => {
    const page: DocPage = {
      file: "empty-secs.md",
      title: "EmptySecs",
      body: `## ParentOnly

### ChildWithText

child body here

## WithText

parent body

### EmptyChild

## TrailingEmpty
`,
    };
    const chunks = chunkPage(page);
    const paths = chunks.map((c) => c.headingPath);
    // ## ParentOnly has no body of its own → no chunk for ParentOnly alone
    expect(paths).not.toContain("ParentOnly");
    expect(paths).toContain("ParentOnly > ChildWithText");
    expect(paths).toContain("WithText");
    expect(paths).not.toContain("WithText > EmptyChild");
    expect(paths).not.toContain("TrailingEmpty");
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
  });

  it("uniquifies duplicate chunk ids with -2, -3", () => {
    const a: DocPage = {
      file: "dup.md",
      title: "Dup",
      body: `## Same\n\none\n\n## Same\n\ntwo\n\n## Same\n\nthree\n`,
    };
    const chunks = chunkPages([a]);
    const same = chunks.filter((c) => c.headingPath === "Same");
    expect(same.map((c) => c.id)).toEqual([
      "dup--same",
      "dup--same-2",
      "dup--same-3",
    ]);
    // Direct uniquify helper
    const u = uniquifyChunkIds([
      { id: "x", pageTitle: "t", headingPath: "", prefix: "t", text: "a" },
      { id: "x", pageTitle: "t", headingPath: "", prefix: "t", text: "b" },
    ]);
    expect(u.map((c) => c.id)).toEqual(["x", "x-2"]);
  });
});

describe("tokenizer + BM25 (synthetic)", () => {
  it("keeps --timeout and cat-status as tokens", () => {
    const toks = tokenize("Use cat-status with --timeout 2000 please");
    expect(toks).toContain("--timeout");
    expect(toks).toContain("cat-status");
    expect(toks).toContain("2000");
  });

  it('keeps json from task-like query "print the result as JSON"', () => {
    const toks = tokenize("print the result as JSON");
    expect(toks).toContain("json");
    expect(toks).toContain("print");
    expect(toks).toContain("result");
  });

  it("cleanQuery truncates at Reply with JSON only", () => {
    const q = cleanQuery(
      'Save with --timeout. Reply with JSON only, for example {"command":"x"}.',
    );
    expect(q).toBe("Save with --timeout.");
    expect(q).not.toContain("Reply with JSON only");
  });

  it("ranks timeout chunk above unrelated for timeout query", () => {
    const chunks = chunkPages([alpha, beta]);
    const ranked = retrieveTopK(
      chunks,
      'How do I set --timeout for cat-status? Reply with JSON only.',
      3,
    );
    expect(ranked.length).toBeLessThanOrEqual(3);
    expect(ranked[0]!.chunk.prefix).toMatch(/timeout/i);
  });

  it("tie-break is deterministic by document order", () => {
    const chunks = chunkPages([alpha, beta]);
    const index = buildBm25Index(chunks);
    const r1 = scoreBm25(index, tokenize("widgets"));
    const r2 = scoreBm25(index, tokenize("widgets"));
    expect(r1.map((r) => r.chunk.id)).toEqual(r2.map((r) => r.chunk.id));
  });
});

describe("context assembly + full-mode unchanged", () => {
  const task: Task = {
    id: "T99",
    type: "answer",
    prompt: 'What about --timeout? Reply with JSON only, for example {"answer":1}.',
    expect: { answer: 1 },
    fairness: "synth",
  };

  it("full mode user message matches buildUserMessage byte-for-byte", async () => {
    const corpus = await loadDocsCorpus(SYNTH, join(SYNTH, ".."));
    const pages = await loadDocsPages(SYNTH, join(SYNTH, ".."));
    const full = buildContextUserMessage(task, {
      mode: "full",
      docsCorpus: corpus,
      pages,
      topK: 3,
    });
    expect(full.userMessage).toBe(buildUserMessage(task, corpus));
    expect(full.retrieved).toEqual([]);
  });

  it("system prompt hash is stable for the committed prompt file", async () => {
    const a = await loadSystemPrompt(join(EVAL_ROOT, "system-prompt.txt"));
    const b = await loadSystemPrompt(join(EVAL_ROOT, "system-prompt.txt"));
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rag assembly uses Source: prefixes and top-k", () => {
    const chunks = chunkPages([alpha, beta]);
    const ranked = retrieveTopK(chunks, task.prompt, 2);
    const { userMessage, retrieved } = assembleRagUserMessage(task, ranked);
    expect(retrieved).toHaveLength(2);
    expect(userMessage).toContain("Source: ");
    expect(userMessage).toContain("## Task");
    expect(userMessage).toContain(`[task:${task.id}]`);
  });

  it("docs corpus hash is stable on synth fixtures", async () => {
    const h1 = await hashDocsSources(SYNTH, join(SYNTH, ".."));
    const h2 = await hashDocsSources(SYNTH, join(SYNTH, ".."));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rag page load excludes llms.txt; full corpus may include it", async () => {
    const ragPages = await loadDocsPages(SYNTH, join(SYNTH, ".."), {
      includeLlms: false,
    });
    expect(ragPages.every((p) => p.file !== "llms.txt")).toBe(true);
    // Full-mode helper still requests includeLlms true by default.
    const fullPages = await loadDocsPages(SYNTH, join(SYNTH, ".."));
    // Synth fixture has no llms.txt — just ensure the option path works.
    expect(fullPages.length).toBeGreaterThanOrEqual(ragPages.length);
    void loadDocsCorpus;
  });
});

describe("flag validation + full-suite labels", () => {
  it("rejects bad --context / --top-k", () => {
    expect(validateContextFlags({ context: "nope", topK: 3 }).ok).toBe(false);
    expect(validateContextFlags({ context: "rag", topK: 0 }).ok).toBe(false);
    expect(validateContextFlags({ context: "rag", topK: 3 }).ok).toBe(true);
  });

  it("live v1-rag refuses --tasks", () => {
    const tasks: Task[] = [
      {
        id: "T1",
        type: "answer",
        prompt: "p",
        expect: { answer: 1 },
        fairness: "f",
      },
      {
        id: "T2",
        type: "answer",
        prompt: "p",
        expect: { answer: 2 },
        fairness: "f",
      },
    ];
    const bad = selectTasks(tasks, {
      label: "v1-rag",
      dryRun: false,
      taskIds: ["T1"],
    });
    expect(bad.ok).toBe(false);
  });

  it("hard-cap still enforced by runner (planned calls)", async () => {
    // Invoke dry-run with synth docs, 10 tasks × 3 runs default would be 30; force runs=3 and hard-cap 5.
    const code = await new Promise<number>((resolve, reject) => {
      const child = spawn(
        "npx",
        [
          "tsx",
          "src/run.ts",
          "--dry-run",
          "--context",
          "rag",
          "--docs",
          SYNTH,
          "--runs",
          "3",
          "--hard-cap",
          "5",
          "--label",
          "baseline",
        ],
        { cwd: EVAL_ROOT, stdio: ["ignore", "pipe", "pipe"] },
      );
      let err = "";
      child.stderr.on("data", (d) => {
        err += d.toString();
      });
      child.on("error", reject);
      child.on("close", (c) => {
        expect(err).toMatch(/hard cap/);
        resolve(c ?? 1);
      });
    });
    expect(code).toBe(2);
  });
});

describe("dry-run rag mode (synthetic docs only)", () => {
  it("writes stub results under results/dry-run without API", async () => {
    const code = await new Promise<number>((resolve, reject) => {
      const child = spawn(
        "npx",
        [
          "tsx",
          "src/run.ts",
          "--dry-run",
          "--context",
          "rag",
          "--top-k",
          "2",
          "--docs",
          SYNTH,
          "--runs",
          "1",
          "--tasks",
          "T1",
          "--label",
          "baseline",
          "--hard-cap",
          "20",
        ],
        { cwd: EVAL_ROOT, stdio: ["ignore", "pipe", "pipe"] },
      );
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => {
        out += d.toString();
      });
      child.stderr.on("data", (d) => {
        err += d.toString();
      });
      child.on("error", reject);
      child.on("close", (c) => {
        if (c !== 0) reject(new Error(`exit ${c}: ${err}\n${out}`));
        else resolve(0);
      });
    });
    expect(code).toBe(0);
    const jsonPath = join(REPO_ROOT, "results", "dry-run", "baseline.json");
    const body = await readFile(jsonPath, "utf8");
    expect(body.startsWith("STUB - NOT REAL RESULTS")).toBe(true);
    expect(body).toContain('"contextMode": "rag"');
    expect(body).toContain('"topK": 2');
    // Must not have looked like it used a live key
    expect(body).not.toMatch(/AIza/);
  });
});
