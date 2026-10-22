# Frozen eval inputs (before Phase 3 live runs)

Recorded so planned `v1-rag` / `v2-rag` / `v2-full` runs can be checked against fixed inputs.

## History note

The first freeze commit (`2f2c3fe`, extended in `cbd4ede`) had a loader gap: `--docs ../docs-v2` loaded only `install.md` and `changelog.md`. Found before any v2 run. Fixed in `7de9a6e4a2c42bb25da2ac493f0a1a9bad14f9cb`. No real run of v1-rag, v2-rag or v2-full had happened.

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
| `eval/src/docs.ts` | `7de9a6e4a2c42bb25da2ac493f0a1a9bad14f9cb` |
| `eval/src/run.ts` | `0dac473fb0223b985d1f2f2e1ecb783ad1af9f93` |
| `eval/src/model.ts` | `868c72780cc64731a7b16f11b1642d34bfb8e2cf` |
| `eval/src/provider.ts` | `7f411fede3dd8fe9175070ad7151844bbcd12f9f` |
| `eval/src/score.ts` | `e6fe6cac9bdd453d500bf5e2e06bacfbaf9eb0e5` |
| `eval/src/results.ts` | `0dac473fb0223b985d1f2f2e1ecb783ad1af9f93` |
| `eval/package.json` | `4a66d01f808ec090962bbc190d62c3b5df7b8be0` |
| `eval/needed-chunks.md` | `7514a9c9c17d4f83f16ef6d55a375e08d20a4a1f` |
| `eval/needed-chunks-v2.md` | `a33fab37186cd4151c89bf7627ce0af50a2bece6` |
| `docs/src/content/docs` (v1 docs directory) | `c1c536602ca893e9fca7fcc2bd1f982a1cb209fa` |
| `docs-v2/` | `40645b0fa6210132af676364c4c637bfe84ffe7a` |
| `cli/` | `c1c536602ca893e9fca7fcc2bd1f982a1cb209fa` |

## (b) Corpus SHA-256 (`hashDocsSources` only; no retriever)

File-provenance hashes via the runner’s `hashDocsSources` (sorted relative path + UTF-8 bytes). When `docsContentDir` contains `llms.txt`, every linked page plus `llms.txt` is hashed (v1 `DOCS_PAGE_ORDER` names do not apply).

| Corpus | Docs path passed to hasher | SHA-256 |
|--------|----------------------------|---------|
| docs v1 | `docs/src/content/docs` | `50cb7410a9b56472f205e3da0fe06417b451e314e66b99f30d1cba59f995b28f` |
| docs v2 | `docs-v2` | `78e4e89bb00bac36415a308fb459aea5db7883b6bb36e2b23e7e287a7e4cdf88` |

### Golden v1 full-mode corpus *string* hash

SHA-256 of the exact concatenated corpus string `loadDocsCorpus` produces for v1 (the text that goes into the model message), captured before the docs-v2 loader fix:

- SHA-256: `59c0e39eb467cdb6a53ff8e4a85f8b960b6b728038a243529dc3a378d7c1ae21`
- Character count: `6476`
- Constants: `V1_FULL_CORPUS_SHA256` / `V1_FULL_CORPUS_CHARS` in `eval/src/docs.ts`

### Files covered by each corpus file-hash

- **docs v1** (`50cb7410…b28f`): `index.mdx`, `install.md`, `quick-start.md`, `command-reference.md`, `troubleshooting.md`, `changelog.md`. No `llms.txt` (v1 has none).
- **docs v2** (`78e4e89b…df88`): `changelog.md`, `errors.md`, `flags.md`, `index.md`, `install.md`, `json.md`, `list.md`, `llms.txt`, `lookup.md`, `non-standard.md`, `save.md` (all `docs-v2` pages listed in `llms.txt`, plus `llms.txt` itself).

## Corpus composition

- **v1-full (baseline)** = v1 pages, no `llms.txt` (v1 has none).
- **v1-rag index** = v1 pages split into sections.
- **v2-full** = `llms.txt` first, then all `docs-v2` pages in `llms.txt` link order.
- **v2-rag index** = `docs-v2/*.md` sections WITHOUT `llms.txt` and without frontmatter descriptions.

## (c) Planned runs

Shared settings for every live condition below:

- model: `gemini-3.5-flash-lite`
- temperature: `0`
- thinking: `minimal` (`--thinking-level minimal`)
- tasks × runs: 10 × 3
- delay: `6000` ms (`--delay-ms 6000`)
- provider: Google (default)
- working directory: `eval/`

`delay-ms` and retry backoff are operational parameters, not inputs to the result; the planned delay is raised from 2000 to 6000 ms because of the 429.

| Label | Docs path | Context mode | top-k | Exact command |
|-------|-----------|--------------|-------|---------------|
| `v1-rag` | `docs/src/content/docs` (default) | `rag` | `3` | `npx tsx src/run.ts --label v1-rag --context rag --top-k 3 --model gemini-3.5-flash-lite --temperature 0 --thinking-level minimal --runs 3 --delay-ms 6000 --hard-cap 50` |
| `v2-rag` | `docs-v2` | `rag` | `3` | `npx tsx src/run.ts --label v2-rag --context rag --top-k 3 --docs ../docs-v2 --model gemini-3.5-flash-lite --temperature 0 --thinking-level minimal --runs 3 --delay-ms 6000 --hard-cap 50` |
| `v2-full` | `docs-v2` | `full` | (n/a) | `npx tsx src/run.ts --label v2-full --context full --docs ../docs-v2 --model gemini-3.5-flash-lite --temperature 0 --thinking-level minimal --runs 3 --delay-ms 6000 --hard-cap 50` |

## (d) Hypothesis and decision rules (before the runs)

I expect v2-rag to pass at least as many tasks as v1-rag. If it does not, I report that. With 30 attempts per condition I describe differences, I do not claim statistical significance. The main metric is the overall pass rate per condition; retrieved-sufficient is diagnostic only and is not comparable between v1 and v2 because v2 repeats facts on purpose.

If a run is incomplete (circuit breaker, rate limit), I may re-run that same condition unchanged and I will say so in the README. I never re-run a complete condition because I dislike its result.

## (e) Status at this commit

One real **v1-rag** attempt ran on **2026-10-22** starting at **`2026-10-22T09:14:02.018Z`**, using the same v1 docs corpus as the golden file-hash `50cb7410a9b56472f205e3da0fe06417b451e314e66b99f30d1cba59f995b28f` (and the same BM25 / heading chunker retriever). It was **aborted at T8** by the circuit breaker after **3 consecutive HTTP 429** errors. Artifact files are kept locally under `results/incomplete/` (gitignored; not published). Per rule (d), the same condition will be re-run unchanged.

Facts from `results/incomplete/v1-rag-attempt1.json` (read-only):

- **Attempts scored before stop:** 21 (pass/fail only; errors excluded from the scored count). **24** attempt records were written in total (21 scored + 3 T8 errors).
- **Tasks reached:** T1–T8 (T9–T10 never started).
- **Tasks with scored runs:** T1–T7 (T8 had errors only, scoredRuns 0).
- **Provider retries on 429:** 0 (`retries` arrays empty on the T8 records). The three T8 attempts each failed immediately with 429 (no in-attempt retry succeeded).
- **Quota named:** `GenerateRequestsPerMinutePerProjectPerModel-FreeTier` (free-tier **per-minute** request quota), metric `generativelanguage.googleapis.com/generate_content_free_tier_requests`, limit **15**, model `gemini-3.5-flash-lite`.
- **Exact rate-limit error text** (no API key present; not redacted):

```text
You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. 
* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15, model: gemini-3.5-flash-lite
Please retry in 9.194102525s.
```

(T8 runs 2 and 3 used the same message with retry delays `3.590861627s` and `58.011291001s`.)

- **Outcome per attempt:**

| Task | Run | Outcome |
|------|-----|---------|
| T1 | 1 | pass |
| T1 | 2 | pass |
| T1 | 3 | pass |
| T2 | 1 | pass |
| T2 | 2 | pass |
| T2 | 3 | pass |
| T3 | 1 | pass |
| T3 | 2 | pass |
| T3 | 3 | pass |
| T4 | 1 | pass |
| T4 | 2 | pass |
| T4 | 3 | pass |
| T5 | 1 | fail |
| T5 | 2 | fail |
| T5 | 3 | fail |
| T6 | 1 | pass |
| T6 | 2 | pass |
| T6 | 3 | pass |
| T7 | 1 | pass |
| T7 | 2 | pass |
| T7 | 3 | pass |
| T8 | 1 | error (429) |
| T8 | 2 | error (429) |
| T8 | 3 | error (429) |

No complete `v1-rag`, `v2-rag`, or `v2-full` run has finished. No `v2-rag` or `v2-full` attempt has started.
