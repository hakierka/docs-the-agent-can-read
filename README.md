# Docs the agent can read

A small experiment on writing documentation that AI assistants can use.

## Why this exists

More and more, AI assistants read documentation as well as people. They often do not read the whole site. They search it, get a few small pieces, and answer from those pieces.

So I asked a simple question: **does the way docs are written change whether an AI gets the answer right?**

To test it, I built a tiny command-line tool, `cat-status`, and wrote its docs twice:

- **v1:** normal docs, written for people.
- **v2:** the same facts, rewritten so each section makes sense on its own. The command, the unit and the exit code sit in the same place.

Then I gave a model 10 small tasks, for example "save the image for status 503, but give up after 2 seconds". A script checks every answer by running it against the tool, so no one has to judge by eye.

**What happened:** when the model saw all the docs, both versions worked. When it saw only the 3 best-matching sections, v1 failed 2 tasks out of 10 and v2 passed all 10. Giving v1 more sections did not fix it. The problem was where the facts were placed, not how smart the model was.

**How much to trust it:** this is a small case study, not proof. It is one tool, one model and 10 tasks. I wrote down the inputs and the rules before each run, and I list below what went wrong along the way.

## The tool in the test

Small CLI that maps an HTTP status code to a [http.cat](https://http.cat) image URL. Optional: save the image to a file.

This repo is a docs demo. The CLI, offline tests, human docs, and an optional local eval harness live here. CI never calls the LLM.

## Requirements

- Node.js 22+

## Quick use

```bash
npm install
npm run build
node dist/cli.js 404
```

```text
https://http.cat/404
```

Docs live in `docs/` (Astro Starlight). Build them with `npm run docs:build`.

## Scripts

| Script | What it does |
|--------|----------------|
| `npm test` | Offline Vitest suite (CLI + eval unit tests) |
| `npm run build` | Compile the CLI to `dist/` |
| `npm run docs:build` | Build the docs site |
| `npm run docs:check-links` | Link-check the built docs |
| `npm run eval:dry-run` | Eval harness with a stub model (no API key, no network) |

## Eval (local only)

The harness in `eval/` scores whether a model can answer fixed tasks from the docs. It never opens a shell: the model returns JSON, and commands are checked then run in-process with a mocked fetch.

**Default provider is Google** (`--provider google`) with model `gemini-3.5-flash-lite`. Optional compare model: `gemini-3.8-flash` via `--model`. Live Google runs need `GEMINI_API_KEY` (see `.env.example`) and an interactive `y` confirm. Anthropic remains available with `--provider anthropic` and `ANTHROPIC_API_KEY`. Refuse when `CI` is set. Do not put keys in CI.

Free-tier requests may be used by Google to improve its products; eval content is public docs and synthetic tasks; results depend on the model and free-tier limits. Prices for Gemini free-tier entries in `eval/pricing.json` are `0` (lookup date recorded there).

Results record pass/fail/error, provider, model, temperature, thinking setting, input/output/thinking tokens per run, retries, and **consistency** per task (how many of its scored runs passed, e.g. `2/3`; errors are counted separately and excluded from the pass rate). Any baseline score is acceptable, including a near-perfect one. After the first real run, do not change existing task ids or expectations in `tasks.json`; if a task must change, add a **new** id and keep the old results in the table.

## Results

All runs use `gemini-3.5-flash-lite` (Google free tier), temperature 0, thinking `minimal`, 10 tasks and 3 runs per task. The inputs were frozen and pushed before the runs. See [`eval/frozen.md`](eval/frozen.md) for hashes, commands and the rules I set in advance. Raw results are in [`results/`](results/).

| Condition | What the model sees | Tasks passed (of 10) | Attempts passed | Input tokens per call |
|-----------|---------------------|---------------------:|----------------:|----------------------:|
| `baseline` | all of docs v1 | 10 | 30/30 | 2,084 |
| `v1-rag` | top 3 sections of docs v1 | 8 | 24/30 | 572 |
| `v1-rag-k6` (exploratory) | top 6 sections of docs v1 | 8 | 24/30 | 911 |
| `v2-rag` | top 3 sections of docs v2 | 10 | 30/30 | 1,064 |
| `v2-full` | all of docs v2 and `llms.txt` | 10 | 30/30 | 9,678 |

Sections are cut at `##` and `###` headings and ranked with BM25 against the task text. The task wording is the query, minus the "Reply with JSON only" sentence.

### What I see

- With all the docs in context, both versions pass every task. The v1 docs are about 2,000 tokens, so the model sees everything.
- When retrieval decides what the model sees, v1 fails two tasks, T5 and T8. In both, the retrieved sections did not contain the facts needed to answer. I checked this against [`eval/needed-chunks.md`](eval/needed-chunks.md). No attempt passed without enough context, and none failed with enough context. The failures come from retrieval, not from the model's reasoning.
- T5 ("give up after 2 seconds"): the task does not contain the word "timeout", so the `--timeout <ms>` section was not retrieved, even with 6 sections. The model had no unit and wrote `--timeout 2` instead of `2000`.
- T8 (exit code for `--timeout` without `--save`): the answer needs two facts that sit in two v1 sections. With 6 sections the first was retrieved and the second was not.
- v2 passes both tasks. In v2 each of these facts is stated again inside one section, together with the command form and the exit codes.
- Control: giving v1 twice as many sections (1.6 times the tokens) did not fix either task. v2 with 3 sections uses about 1.9 times the tokens of v1 with 3 sections, so the control is close to token-matched but not equal (it used 86% of the v2 tokens).
- The three runs of each task had the same outcome in every condition. Counted honestly, the evidence is 10 tasks, not 30 attempts.

### One task, side by side

Task T5: "Save the image for status 503 to a.jpg, but give up after 2 seconds if the download is too slow."

| Docs | Sections the model saw | Command it wrote | Result |
|------|------------------------|------------------|--------|
| v1 | `quick-start`, `command-reference--flags--save-path`, `changelog--1-0-0` | `cat-status 503 --save a.jpg --timeout 2` | fail: `--timeout` takes milliseconds, so this is 2 ms |
| v2 | `lookup--reject-unknown-or-no-image-codes`, `lookup--reject-codes-outside-100-599`, `save--set-a-download-timeout` | `cat-status 503 --save a.jpg --timeout 2000` | pass |

This is run 1 of 3; the pass or fail was the same in all three runs. v2 also retrieved two sections it did not need. It passed because the one it needed, the timeout section, was among the top 3. In v1 the section with the unit was not retrieved at all.

### What this does not show

- It does not show that v2 is better docs for people. v2 is longer and repeats itself on purpose.
- The tasks and both doc versions were written with AI help, and I knew the tasks. v2 may fit these tasks better than other ones.
- It is one small tool, one model, one retriever, one temperature, and 10 tasks. I do not claim statistical significance.
- With the docs fully in context there is no difference at this size. The result only appears when the model sees a few retrieved sections.
- v2 costs more tokens per call than v1 with the same number of sections.

### Process notes

Things went wrong on the way. They are all in the git history and in `eval/frozen.md`:

- The first freeze had a loader gap: `--docs ../docs-v2` loaded only two pages. I found it before any v2 run, fixed it, and checked that the v1 corpus did not change.
- The first `v1-rag` attempt stopped on the free-tier limit of 15 requests per minute (HTTP 429). I raised the delay from 2 to 6 seconds and ran the same condition again, as the rule I set in advance allowed. The aborted files are kept locally and described in `frozen.md`.
- The harness did not log retries for failed calls. I fixed that before the final runs.
- `v1-rag-k6` was added after I had seen the first three runs. I wrote it down in `frozen.md` before running it.

### Known limits

- Scoring is lenient on **extra** flags the task does not mention (only expected parsed fields are checked).
- `"--flag=value"` forms are **not** supported by the CLI; a model that emits them fails.
- Default scored shape: **one model**, **10 tasks**, **3 runs** each.
- Temperature **0** is not fully deterministic; that is why there are multiple runs.
- The docs are given to the model as markdown source, not as rendered HTML pages; real agents often see HTML or search snippets.
- The docs are short (a few pages) and fit in context; this does not test navigation or search in a large docs site.
- The tasks were written by the docs author; a different author would pick different tasks.
- One model per scored run, one date; results can change with model updates.
- The test measures whether the docs let a model produce a correct command or answer; it does not measure whether the docs are pleasant for humans.
- The preamble of a page (text before the first heading) is merged into the first section; this was decided before any rag run.
- In rag mode llms.txt and frontmatter descriptions are not indexed; llms.txt is only part of the v2-full context. The test does not simulate an agent that reads llms.txt to navigate.
- The v1 docs, the tasks and the v2 docs were written with an AI coding agent under my direction. I asked a separate session to write v2 without opening eval/ or results/; I could not verify that it complied.

## Credits

Status cat images are served by [http.cat](https://http.cat). This project does not bundle those images. Reason phrases come from IANA/MDN for standard codes; a few non-standard codes are included only when Laravel, nginx, or Cloudflare document them.

## License

MIT. Copyright (c) 2026 Amy Waliszewska.
