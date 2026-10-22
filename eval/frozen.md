# Frozen eval inputs (before Phase 3 live runs)

Recorded so planned `v1-rag` / `v2-rag` / `v2-full` runs can be checked against fixed inputs.

## (a) Last commit that changed each path

docs v1 was last changed in `c1c5366`, which is before the baseline run, so v1-rag uses the same v1 docs as the baseline.

| Path | Last commit (`git log -1 --format=%H -- <path>`) |
|------|--------------------------------------------------|
| `eval/tasks.json` | `e6fe6cac9bdd453d500bf5e2e06bacfbaf9eb0e5` |
| `eval/system-prompt.txt` | `868c72780cc64731a7b16f11b1642d34bfb8e2cf` |
| `eval/src/chunk.ts` | `a33fab37186cd4151c89bf7627ce0af50a2bece6` |
| `eval/src/bm25.ts` | `ee0473cb47da7194a05b60876fbb821b410e1447` |
| `eval/src/context.ts` | `ee0473cb47da7194a05b60876fbb821b410e1447` |
| `eval/src/check.ts` | `e6fe6cac9bdd453d500bf5e2e06bacfbaf9eb0e5` |
| `eval/src/docs.ts` | `ee0473cb47da7194a05b60876fbb821b410e1447` |
| `eval/src/run.ts` | `ee0473cb47da7194a05b60876fbb821b410e1447` |
| `eval/src/model.ts` | `868c72780cc64731a7b16f11b1642d34bfb8e2cf` |
| `eval/src/provider.ts` | `7f411fede3dd8fe9175070ad7151844bbcd12f9f` |
| `eval/src/score.ts` | `e6fe6cac9bdd453d500bf5e2e06bacfbaf9eb0e5` |
| `eval/src/results.ts` | `b99222239a102cc338363baa2a3a374fe6c77c89` |
| `eval/package.json` | `4a66d01f808ec090962bbc190d62c3b5df7b8be0` |
| `eval/needed-chunks.md` | `7514a9c9c17d4f83f16ef6d55a375e08d20a4a1f` |
| `eval/needed-chunks-v2.md` | `a33fab37186cd4151c89bf7627ce0af50a2bece6` |
| `docs/src/content/docs` (v1 docs directory) | `c1c536602ca893e9fca7fcc2bd1f982a1cb209fa` |
| `docs-v2/` | `40645b0fa6210132af676364c4c637bfe84ffe7a` |
| `cli/` | `c1c536602ca893e9fca7fcc2bd1f982a1cb209fa` |

## (b) Corpus SHA-256 (`hashDocsSources` only; no retriever)

Computed with the runner’s `hashDocsSources` the same way `eval/src/run.ts` calls it (`docsRoot` = repo `docs/`).

| Corpus | Docs path passed to hasher | SHA-256 |
|--------|----------------------------|---------|
| docs v1 | `docs/src/content/docs` | `50cb7410a9b56472f205e3da0fe06417b451e314e66b99f30d1cba59f995b28f` |
| docs v2 | `docs-v2` | `9c4bf1754c8322a9b0034ac63d431b520efc4646706c0807b9c1000ef0a53533` |

### Files covered by each corpus hash

`hashDocsSources` hashes raw UTF-8 bytes of every file it finds under the fixed `DOCS_PAGE_ORDER` list in `docsContentDir`, plus `llms.txt` if present under `docsRoot` (sorted by relative path).

- **docs v1 hash** covers: `index.mdx`, `install.md`, `quick-start.md`, `command-reference.md`, `troubleshooting.md`, `changelog.md`. No `llms.txt` (v1 has none).
- **docs v2 hash** (with `--docs ../docs-v2` and runner `docsRoot=docs/`) covers only the `DOCS_PAGE_ORDER` filenames that exist in `docs-v2/`: `install.md`, `changelog.md`. It does **not** include other `docs-v2/*.md` pages, and it does **not** include `docs-v2/llms.txt` (runner looks for `llms.txt` under repo `docs/`, which has none).

## Corpus composition

- **v1-full (baseline)** = v1 pages, no `llms.txt` (v1 has none).
- **v1-rag index** = v1 pages split into sections.
- **v2-full** = all `docs-v2` pages PLUS `llms.txt`.
- **v2-rag index** = `docs-v2/*.md` sections WITHOUT `llms.txt` and without frontmatter descriptions.

## (c) Planned runs

Shared settings for every live condition below:

- model: `gemini-3.5-flash-lite`
- temperature: `0`
- thinking: `minimal` (`--thinking-level minimal`)
- tasks × runs: 10 × 3
- delay: `2000` ms (`--delay-ms 2000`)
- provider: Google (default)
- working directory: `eval/`

| Label | Docs path | Context mode | top-k | Exact command |
|-------|-----------|--------------|-------|---------------|
| `v1-rag` | `docs/src/content/docs` (default) | `rag` | `3` | `npx tsx src/run.ts --label v1-rag --context rag --top-k 3 --model gemini-3.5-flash-lite --temperature 0 --thinking-level minimal --runs 3 --delay-ms 2000 --hard-cap 50` |
| `v2-rag` | `docs-v2` | `rag` | `3` | `npx tsx src/run.ts --label v2-rag --context rag --top-k 3 --docs ../docs-v2 --model gemini-3.5-flash-lite --temperature 0 --thinking-level minimal --runs 3 --delay-ms 2000 --hard-cap 50` |
| `v2-full` | `docs-v2` | `full` | (n/a) | `npx tsx src/run.ts --label v2-full --context full --docs ../docs-v2 --model gemini-3.5-flash-lite --temperature 0 --thinking-level minimal --runs 3 --delay-ms 2000 --hard-cap 50` |

## (d) Hypothesis and decision rules (before the runs)

I expect v2-rag to pass at least as many tasks as v1-rag. If it does not, I report that. With 30 attempts per condition I describe differences, I do not claim statistical significance. The main metric is the overall pass rate per condition; retrieved-sufficient is diagnostic only and is not comparable between v1 and v2 because v2 repeats facts on purpose.

If a run is incomplete (circuit breaker, rate limit), I may re-run that same condition unchanged and I will say so in the README. I never re-run a complete condition because I dislike its result.

## (e) Status at this commit

No real run of v1-rag, v2-rag or v2-full has happened at the time of this commit.
