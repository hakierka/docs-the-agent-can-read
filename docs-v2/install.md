---
title: Install cat-status
description: How to install and run cat-status from a local checkout.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Require Node.js 22 or newer

`cat-status` declares `"engines": { "node": ">=22" }` in package.json. Older Node versions are unsupported.

There is no install flag for this check. If you run an older Node, install or runtime may fail outside the CLI’s own exit codes. Fix: switch to Node.js 22 or newer before building.

## Build the CLI from the repo root

From the repository root:

```bash
npm install
npm run build
```

That compiles TypeScript into `dist/`. The binary entry is `./dist/cli.js` (`"bin": { "cat-status": "./dist/cli.js" }`).

These commands are npm scripts, not `cat-status` flags. They write build output to disk. They do not print a status URL. Success is a normal npm exit `0`.

## Run the built binary with node

After a successful build:

```bash
node dist/cli.js --help
```

Command form: `node dist/cli.js` plus the same arguments as `cat-status …`.

`--help` cannot be combined with unknown options (an unknown option fails first). On success, stdout is the help text. Stderr is empty. Exit code is `0`.

```text
cat-status — print or save http.cat images for known HTTP status codes

Usage:
  cat-status <code>
  cat-status <code> --json
  cat-status <code> --save <path> [--force] [--timeout <ms>]
  cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]
  cat-status --help
  cat-status --version

Exit codes:
  0  ok
  1  usage error
  2  unknown or invalid status code
  3  download failed
```

## Link the binary as cat-status

From the repo root after build:

```bash
npm link
cat-status --help
```

`npm link` installs a local `cat-status` command that points at `./dist/cli.js`. Then use `cat-status` the same way as `node dist/cli.js`.

`cat-status --help` prints the help text on stdout, nothing on stderr, exit `0`.

There is no npm publish step for this project yet. Install from the local checkout.
