---
title: What cat-status does
description: Overview of the cat-status CLI.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Map a status code to a http.cat URL

`cat-status` prints the https://http.cat image URL for an HTTP status code that is in its built-in table.

Command forms:

```text
cat-status <code>
cat-status <code> --json
cat-status <code> --save <path> [--force] [--timeout <ms>]
cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]
cat-status --help
cat-status --version
```

Flags you can combine with a lookup `<code>`: `--json`, `--save`, and with `--save` only also `--force` and `--timeout`. Flags you cannot use for a plain lookup without `--save`: `--force`, `--timeout`. `--list` cannot be combined with a status code or with `--save`, `--force`, or `--timeout`.

On a successful lookup, stdout is one line: `https://http.cat/<code>`, or one JSON object if `--json` is set. Stderr is empty. Exit code is `0`.

The CLI does not ship image files. Images come from http.cat. The only network call is `--save`.

```bash
cat-status 404
```

```text
https://http.cat/404
```

## Accept only codes that have a cat image

The allowlist is a static table inside the CLI. If a code is missing from that table, the command fails even when the number is a real HTTP status.

Command: `cat-status <code>`

No flags are required. You may add `--json` and/or `--save <path>` (and with `--save`, `--force` and `--timeout <ms>`). You cannot pass `--list` together with `<code>`.

Stdout is empty on failure. Stderr is one line. Exit code is `2` for invalid, unknown, or no-image codes.

Example of a registered HTTP status with no http.cat image in the table (checked against http.cat on 2026-10-21):

```bash
cat-status 505
```

```text
no cat image for 505 (HTTP Version Not Supported)
```

Exit code: `2`.

## Mark a few non-standard product codes

Some table entries are not IANA-registered HTTP statuses. They exist because a product documents them (Laravel, nginx, Cloudflare).

Command: `cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]`

Valid with `--json`. Not valid with `--save`, `--force`, `--timeout`, or a positional status code.

Plain `--list` stdout marks those rows as `(non-standard, <product>)`. JSON list rows add `"nonStandard": true` and `"product"`. A plain lookup of the same code still prints only the URL (or lookup JSON without those fields). Exit code is `0` on success.

```bash
cat-status --list 4xx
```

One of the lines is:

```text
419 Page Expired (non-standard, Laravel)
```
