---
title: Flag reference
description: Every cat-status flag, default, valid combination, and effect.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Read the complete flag table

Command forms:

```text
cat-status <code> [--json] [--save <path> [--force] [--timeout <ms>]]
cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]
cat-status --help
cat-status --version
```

| Name | Value | Default | Valid with | Effect |
|------|-------|---------|------------|--------|
| `<code>` (positional) | Digits-only integer string, 100–599, in allowlist | (required for lookup) | `--json`, `--save`, `--force` (with save), `--timeout` (with save); not with `--list` | Look up the code; print URL or JSON; optionally save |
| `--` | none | n/a | Before remaining positionals | End of options; later tokens are positional even if they start with `-` |
| `--list` | optional class `1xx`\|`2xx`\|`3xx`\|`4xx`\|`5xx` | all codes when class omitted | `--json` only | Print supported codes (text or JSON) |
| `--json` | none | off | lookup `<code>`, or `--list`; also with `--save` on lookup | Print JSON instead of plain text |
| `--save` | `<path>` (required, must not start with `-`) | unset | lookup `<code>`; optional `--force`, `--timeout`, `--json`; not with `--list` | Download image to `<path>` (only network call), then still print URL/JSON |
| `--force` | none | off | only with `--save` | Allow overwriting an existing file |
| `--timeout` | positive integer milliseconds | `5000` when `--save` is used | only with `--save` | Abort download after `<ms>` ms |
| `--help` | none | n/a | alias `-h`; wins over `--version` if both parse; unknown options still fail | Print help on stdout, exit `0` |
| `--version` | none | n/a | alias `-V` | Print package version on stdout, exit `0` |

## Combine flags for a lookup

Command:

```text
cat-status <code> [--json] [--save <path> [--force] [--timeout <ms>]]
```

Allowed: `--json` alone; `--save` alone; `--save` with `--force` and/or `--timeout` and/or `--json`.

Not allowed: `--force` without `--save`; `--timeout` without `--save`; any of those with `--list`; more than one positional code.

Success stdout: URL, or JSON object if `--json`. Success stderr: empty. Success exit: `0`. Save failures: stderr message, exit `3`, no URL/JSON.

```bash
cat-status 404 --json
```

```text
{"code":404,"reason":"Not Found","url":"https://http.cat/404"}
```

## Combine flags for --list

Command:

```text
cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]
```

Allowed: optional class token immediately after `--list` when it is one of `1xx`…`5xx`; optional `--json`.

Not allowed: `--save`, `--force`, `--timeout`, positional status codes.

Success exit: `0`. Stderr empty.

```bash
cat-status --list 1xx --json
```

```text
[{"code":100,"reason":"Continue"},{"code":101,"reason":"Switching Protocols"},{"code":102,"reason":"Processing"},{"code":103,"reason":"Early Hints"}]
```

## Use help and version flags

Commands:

```text
cat-status --help
cat-status -h
cat-status --version
cat-status -V
```

No other flags are required. If both help and version are set and parsing finishes, help is printed. An unknown option aborts with exit `1` even if `--help` is also present.

```bash
cat-status -V
```

```text
1.0.0
```

Exit `0`. Stderr empty.
