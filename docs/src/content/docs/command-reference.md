---
title: Command reference
description: Flags and exit codes for cat-status.
---

## Synopsis

```text
cat-status <code>
cat-status <code> --json
cat-status <code> --save <path> [--force] [--timeout <ms>]
cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]
cat-status --help | -h
cat-status --version | -V
```

## Arguments

### `<code>`

HTTP status code to look up. Must be:

1. Digits only (no decimals, signs, scientific notation, or leading zeros — use `404`, not `0404`)
2. An integer from 100 through 599
3. Present in the built-in table of codes that have a http.cat image

On success, stdout is `https://http.cat/<code>`.

Negative numbers look like options. Use `--` before the code if you need to pass a leading `-` (see Troubleshooting).

Status classes for `--list` are lowercase: `1xx`, `2xx`, `3xx`, `4xx`, `5xx` (not `4XX`).

### Non-standard codes

A few entries are **non-standard** (not IANA-registered HTTP statuses). They are included only when a product documents them, and `--list` marks them with `(non-standard, <product>)`:

| Code | Reason | Product |
|------|--------|---------|
| 419 | Page Expired | Laravel |
| 444 | No Response | nginx |
| 495 | SSL Certificate Error | nginx |
| 496 | SSL Certificate Required | nginx |
| 497 | HTTP Request Sent to HTTPS Port | nginx |
| 499 | Client Closed Request | nginx |
| 521 | Web Server Is Down | Cloudflare |
| 522 | Connection Timed Out | Cloudflare |
| 523 | Origin Is Unreachable | Cloudflare |
| 525 | SSL Handshake Failed | Cloudflare |

Allowlist last checked against http.cat on 2026-10-21.

## Flags

### `--json`

Print JSON instead of plain text.

For a code lookup:

```json
{"code":404,"reason":"Not Found","url":"https://http.cat/404"}
```

For `--list`, print an array of `{ "code", "reason" }` objects. Non-standard rows also include `"nonStandard": true` and `"product"`.

### `--list [1xx|2xx|3xx|4xx|5xx]`

Print supported codes and reason phrases. Omit the class to print all. Pass one class to filter. Non-standard codes append `(non-standard, <product>)`.

### `--save <path>`

Download the http.cat image to `<path>`. This is the only network use. Refuses to overwrite an existing file unless `--force` is set. After a successful download, still prints the URL (or JSON) to stdout.

### `--force`

Allow `--save` to overwrite an existing file. Only valid with `--save`.

### `--timeout <ms>`

Download timeout for `--save`, in milliseconds. Default: `5000`. Only valid with `--save`.

### `--help` / `-h`

Print short usage text. Exit `0`.

### `--version` / `-V`

Print the package version. Exit `0`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Usage error (bad flags, missing args) |
| 2 | Unknown or invalid status code (including real HTTP statuses with no cat image) |
| 3 | Download failed (network, timeout, HTTP error, refuse overwrite) |

Errors go to stderr as a single clear line.
