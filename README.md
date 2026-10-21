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

Results record pass/fail, input and output tokens per run, and **consistency** per task (how many of its runs passed, e.g. `2/3`). Any baseline score is acceptable, including a near-perfect one. After the first real run, do not change existing task ids or expectations in `tasks.json`; if a task must change, add a **new** id and keep the old results in the table.

Known limits:

- Scoring is lenient on **extra** flags the task does not mention (only expected parsed fields are checked).
- `"--flag=value"` forms are **not** supported by the CLI; a model that emits them fails.
- Default scored shape: **one model**, **10 tasks**, **3 runs** each.
- Temperature **0** is not fully deterministic; that is why there are multiple runs.

Live runs need `ANTHROPIC_API_KEY` and an interactive `y` confirm. Refuse when `CI` is set. Do not put the key in CI.

## Credits

Status cat images are served by [http.cat](https://http.cat). This project does not bundle those images. Reason phrases come from IANA/MDN for standard codes; a few non-standard codes are included only when Laravel, nginx, or Cloudflare document them.

## License

MIT. Copyright (c) 2026 Amy Waliszewska.
