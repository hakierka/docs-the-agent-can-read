# cat-status

Small CLI that maps an HTTP status code to a [http.cat](https://http.cat) image URL. Optional: save the image to a file.

This repo is a docs demo. Phase 1 ships the CLI, offline tests, and plain human docs. No agent-only docs or eval harness yet.

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
| `npm test` | Offline Vitest suite |
| `npm run build` | Compile the CLI to `dist/` |
| `npm run docs:build` | Build the docs site |
| `npm run docs:check-links` | Link-check the built docs |

## Credits

Status cat images are served by [http.cat](https://http.cat). This project does not bundle those images. Reason phrases come from IANA/MDN for standard codes; a few non-standard codes are included only when Laravel, nginx, or Cloudflare document them.

## License

MIT. Copyright (c) 2026 Amy Waliszewska.
