---
title: Print JSON for a status code
description: Print machine-readable JSON for one known HTTP status code.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Print a JSON object for one known code

Command:

```text
cat-status <code> --json
```

`<code>` must be a known allowlist code (same rules as a plain lookup: digits only, no leading zeros, 100–599, present in the table).

`--json` is valid with a lookup `<code>`, and with `--save <path>` (then also `--force` and `--timeout <ms>`). `--json` is also valid with `--list`. `--json` does not change exit codes. You cannot use `--force` or `--timeout` without `--save`. You cannot combine `--list` with a positional `<code>`.

On success, stdout is one JSON object on a single line:

```json
{"code":<number>,"reason":"<phrase>","url":"https://http.cat/<code>"}
```

Stderr is empty. Exit code is `0`.

Lookup JSON always has exactly `code`, `reason`, and `url`. It does not include `nonStandard` or `product`, even for non-standard codes such as 419.

```bash
cat-status 418 --json
```

```text
{"code":418,"reason":"I'm a teapot","url":"https://http.cat/418"}
```

```bash
cat-status 404 --json
```

```text
{"code":404,"reason":"Not Found","url":"https://http.cat/404"}
```

```bash
cat-status 419 --json
```

```text
{"code":419,"reason":"Page Expired","url":"https://http.cat/419"}
```

## Keep the same errors as a plain lookup

Command: `cat-status <code> --json` with an invalid, out-of-range, unknown, or no-image code.

`--json` does not change validation. On failure, stdout is empty. Stderr is the same one-line message as without `--json`. Exit code is `2` for code problems, or `1` for usage problems.

```bash
cat-status abc --json
```

```text
invalid status code: abc
```

Exit code: `2`.

```bash
cat-status 505 --json
```

```text
no cat image for 505 (HTTP Version Not Supported)
```

Exit code: `2`.

## Combine JSON with a successful save

Command:

```text
cat-status <code> --json --save <path> [--force] [--timeout <ms>]
```

Requires a known `<code>` and a path after `--save`. `--force` and `--timeout <ms>` are optional and only valid with `--save`. Default timeout is `5000` ms. Not valid with `--list`.

If the download succeeds, stdout is the same lookup JSON object as without `--save`. Stderr is empty. Exit code is `0`. If the download fails, stdout is empty, stderr is the save error line, exit code is `3`.

```bash
cat-status 404 --save /tmp/cat-404.jpg --json --force
```

```text
{"code":404,"reason":"Not Found","url":"https://http.cat/404"}
```

(Exit `0` when the file write succeeds. Needs network.)
