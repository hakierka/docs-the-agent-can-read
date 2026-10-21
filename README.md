# cat-status

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

Known limits:

- Scoring is lenient on **extra** flags the task does not mention (only expected parsed fields are checked).
- `"--flag=value"` forms are **not** supported by the CLI; a model that emits them fails.
- Default scored shape: **one model**, **10 tasks**, **3 runs** each.
- Temperature **0** is not fully deterministic; that is why there are multiple runs.
- The docs are given to the model as markdown source, not as rendered HTML pages; real agents often see HTML or search snippets.
- The docs are short (a few pages) and fit in context; this does not test navigation or search in a large docs site.
- The tasks were written by the docs author; a different author would pick different tasks.
- One model per scored run, one date; results can change with model updates.
- The test measures whether the docs let a model produce a correct command or answer; it does not measure whether the docs are pleasant for humans.

## Credits

Status cat images are served by [http.cat](https://http.cat). This project does not bundle those images. Reason phrases come from IANA/MDN for standard codes; a few non-standard codes are included only when Laravel, nginx, or Cloudflare document them.

## License

MIT. Copyright (c) 2026 Amy Waliszewska.
