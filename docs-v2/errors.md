---
title: Exit codes and errors
description: Every exit code and stderr message cat-status can produce.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Read the exit code meanings

Command forms that succeed with exit `0`:

```text
cat-status <code> [--json] [--save <path> [--force] [--timeout <ms>]]
cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]
cat-status --help
cat-status --version
```

| Exit code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | Usage error (bad flags, missing args, invalid combinations) |
| 2 | Unknown or invalid status code (including real HTTP statuses with no cat image) |
| 3 | Download or file-write failed for `--save` |

Errors print one line on stderr. Successful commands leave stderr empty (aside from nothing). Usage and code errors do not print the URL or JSON on stdout.

## Look up every stderr message

Exact message or pattern, exit code, cause, and fix:

| Stderr message or pattern | Exit | Cause | Fix |
|---------------------------|------|-------|-----|
| `usage: cat-status <code> \| cat-status --list [class] \| cat-status --help` | 1 | No positional code and no `--list` / `--help` / `--version` | Pass a code, `--list`, `--help`, or `--version` |
| `usage: expected a single status code` | 1 | More than one positional argument | Pass exactly one code |
| `usage: unknown option <flag>` | 1 | Unrecognized flag (or a leading `-` value parsed as a flag) | Remove the flag, or put `--` before a positional that starts with `-` |
| `usage: --save requires a path` | 1 | `--save` with no following path, or next token starts with `-` | Pass `cat-status <code> --save <path>` |
| `usage: --timeout requires a millisecond value` | 1 | `--timeout` with no value, or next token starts with `-` | Pass `--timeout <ms>` with a positive integer |
| `usage: --timeout must be a positive integer (ms)` | 1 | Timeout value is not `/^\d+$/` or is `0` | Use an integer ≥ 1 |
| `usage: --list cannot be combined with --save` | 1 | Both `--list` and `--save` | Use one mode, not both |
| `usage: --timeout only applies with --save` | 1 | `--timeout` without `--save` (including with `--list`) | Add `--save <path>`, or drop `--timeout` |
| `usage: --force only applies with --save` | 1 | `--force` without `--save` (including with `--list`) | Add `--save <path>`, or drop `--force` |
| `usage: --list does not take a status code` | 1 | `--list` plus a non-class positional (for example `404` or `4XX`) | Use `cat-status --list` or `cat-status --list 4xx` |
| `invalid status code: <raw>` | 2 | Not plain digits, leading zeros, empty string, decimals, signs, or scientific notation | Use a plain integer string such as `404` |
| `status code out of range: <raw>` | 2 | Digits parse to a number outside 100–599 | Pick a code from 100 through 599 that `--list` shows |
| `no cat image for <code> (<reason>)` | 2 | In-range IANA/registered status with no allowlist / http.cat image | Pick a code from `cat-status --list` |
| `unknown status code: <code>` | 2 | In-range code with no allowlist entry and no IANA reason in the CLI table | Pick a code from `cat-status --list` |
| `file exists: <path> (use --force to overwrite)` | 3 | `--save` target already exists and `--force` was not set (also on `EEXIST` from atomic create) | Choose a new path, or add `--force` |
| `cannot write <path>: directory does not exist` | 3 | Parent directory missing (`ENOENT`) | Create the directory first |
| `cannot write <path>: path is a directory` | 3 | Save path is a directory (`EISDIR`) | Pass a file path |
| `cannot write <path>: permission denied` | 3 | Write not permitted (`EACCES`) | Fix permissions or choose another path |
| `cannot write <path>: <message>` | 3 | Other write failure | Fix the filesystem error described in `<message>` |
| `download timed out after <ms>ms` | 3 | Fetch or body read aborted by `--timeout` | Raise `--timeout`, or check the network |
| `download failed: HTTP <status>` | 3 | http.cat (or fetch) returned a non-OK status | Retry later; confirm https://http.cat/`<code>` still serves an image |
| `download failed: unexpected content type <type>` | 3 | Response `Content-Type` does not start with `image/` | Retry later; confirm the URL returns an image |
| `download failed: <message>` | 3 | Other fetch/network failure | Fix connectivity; inspect `<message>` |

## Reproduce common usage failures

Commands below use `cat-status` with the flags shown. None of them pair `--list` with `--save` successfully. Stdout is empty for each.

```bash
cat-status
```

```text
usage: cat-status <code> | cat-status --list [class] | cat-status --help
```

Exit `1`.

```bash
cat-status 404 500
```

```text
usage: expected a single status code
```

Exit `1`.

```bash
cat-status --nope
```

```text
usage: unknown option --nope
```

Exit `1`.

```bash
cat-status -1
```

```text
usage: unknown option -1
```

Exit `1`.

## Reproduce common code failures

```bash
cat-status abc
```

```text
invalid status code: abc
```

Exit `2`.

```bash
cat-status 99
```

```text
status code out of range: 99
```

Exit `2`.

```bash
cat-status 505
```

```text
no cat image for 505 (HTTP Version Not Supported)
```

Exit `2`.

```bash
cat-status 427
```

```text
unknown status code: 427
```

Exit `2`.

```bash
cat-status 306
```

```text
no cat image for 306 ((Unused))
```

Exit `2`.

## Print help or version without an error

Commands:

```text
cat-status --help
cat-status -h
cat-status --version
cat-status -V
```

These exit `0`. Help prints usage on stdout. Version prints `1.0.0` on stdout (from package.json). Stderr empty.

If an unknown option appears anywhere in the argv scan before a successful parse completes, the CLI returns the unknown-option usage error instead of help.

```bash
cat-status --version
```

```text
1.0.0
```
