# Frozen eval inputs (before Phase 3 live runs)

Recorded so planned `v1-rag` / `v2-rag` / `v2-full` runs can be checked against fixed inputs.

## (a) Last commit that changed each path

| Path | Last commit (`git log -1 --format=%H -- <path>`) |
|------|--------------------------------------------------|
| `eval/tasks.json` | `e6fe6cac9bdd453d500bf5e2e06bacfbaf9eb0e5` |
| `eval/system-prompt.txt` | `868c72780cc64731a7b16f11b1642d34bfb8e2cf` |
| `eval/src/chunk.ts` | `a33fab37186cd4151c89bf7627ce0af50a2bece6` |
| `eval/src/bm25.ts` | `ee0473cb47da7194a05b60876fbb821b410e1447` |
| `eval/src/context.ts` | `ee0473cb47da7194a05b60876fbb821b410e1447` |
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

## (e) Status at this commit

No real run of v1-rag, v2-rag or v2-full has happened at the time of this commit.
