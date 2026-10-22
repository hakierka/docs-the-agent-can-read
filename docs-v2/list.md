---
title: List supported status codes
description: Print every supported code, or filter by class, in text or JSON.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## List every supported code

Command:

```text
cat-status --list
```

Valid with `--json`. Not valid with `--save`, `--force`, `--timeout`, or a positional status code.

On success, stdout is one line per allowlist entry: `<code> <reason>`, or `<code> <reason> (non-standard, <product>)` for non-standard rows. Stderr is empty. Exit code is `0`. Version 1.0.0 prints 71 lines.

```bash
cat-status --list
```

First lines:

```text
100 Continue
101 Switching Protocols
102 Processing
103 Early Hints
200 OK
```

A non-standard line looks like:

```text
419 Page Expired (non-standard, Laravel)
```

## Filter by status class

Command:

```text
cat-status --list <class>
```

`<class>` must be exactly one of: `1xx`, `2xx`, `3xx`, `4xx`, `5xx` (lowercase). The token is optional; omit it to print all codes.

Valid with `--json`. Not valid with `--save`, `--force`, `--timeout`, or any other positional argument. A non-class token such as `404` or `4XX` is treated as a positional status code and fails usage.

On success, stdout lists only codes whose hundreds digit matches the class. Stderr is empty. Exit code is `0`.

```bash
cat-status --list 1xx
```

```text
100 Continue
101 Switching Protocols
102 Processing
103 Early Hints
```

```bash
cat-status --list 2xx
```

```text
200 OK
201 Created
202 Accepted
203 Non-Authoritative Information
204 No Content
205 Reset Content
206 Partial Content
207 Multi-Status
208 Already Reported
226 IM Used
```

```bash
cat-status --list 4xx
```

Includes both standard and non-standard 4xx rows, for example:

```text
404 Not Found
418 I'm a teapot
419 Page Expired (non-standard, Laravel)
444 No Response (non-standard, nginx)
```

## Print the list as JSON

Command:

```text
cat-status --list [--json]
cat-status --list <class> --json
```

`--json` is valid with `--list`. Same bans: no `--save`, `--force`, `--timeout`, or positional status code.

On success, stdout is one JSON array. Each element has `code` and `reason`. Non-standard rows also include `"nonStandard": true` and `"product": "<name>"`. Stderr is empty. Exit code is `0`.

```bash
cat-status --list 1xx --json
```

```text
[{"code":100,"reason":"Continue"},{"code":101,"reason":"Switching Protocols"},{"code":102,"reason":"Processing"},{"code":103,"reason":"Early Hints"}]
```

Example non-standard object inside a `--list 4xx --json` array:

```text
{"code":419,"reason":"Page Expired","nonStandard":true,"product":"Laravel"}
```

## Reject --list with a status code

Command forms that fail:

```text
cat-status --list 404
cat-status --list 4XX
```

`404` and `4XX` are not class tokens, so they become positionals. Stdout is empty. Stderr:

```text
usage: --list does not take a status code
```

Exit code: `1`.

```bash
cat-status --list 404
```

```text
usage: --list does not take a status code
```

## Reject --list with save-only flags

Commands:

```text
cat-status --list --save <path>
cat-status --list --force
cat-status --list --timeout <ms>
```

Stdout is empty. Exit code is `1`.

```bash
cat-status --list --save /tmp/x
```

```text
usage: --list cannot be combined with --save
```

```bash
cat-status --list --force
```

```text
usage: --force only applies with --save
```

```bash
cat-status --list --timeout 1
```

```text
usage: --timeout only applies with --save
```
