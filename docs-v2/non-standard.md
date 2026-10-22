---
title: Understand non-standard codes
description: Non-standard status codes in the allowlist and how the CLI labels them.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Know which codes are non-standard

The allowlist includes a few codes that are not IANA-registered HTTP statuses. They are included only when a product documents them. Allowlist last verified against http.cat on 2026-10-21.

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

These codes are first-class allowlist entries. Lookup and save work the same as for standard codes.

## See the label in plain --list output

Command:

```text
cat-status --list [1xx|2xx|3xx|4xx|5xx]
```

Valid with `--json`. Not valid with `--save`, `--force`, `--timeout`, or a positional status code.

For non-standard rows, stdout uses:

```text
<code> <reason> (non-standard, <product>)
```

Stderr empty. Exit code `0`.

```bash
cat-status --list 4xx
```

Matching lines include:

```text
419 Page Expired (non-standard, Laravel)
444 No Response (non-standard, nginx)
495 SSL Certificate Error (non-standard, nginx)
496 SSL Certificate Required (non-standard, nginx)
497 HTTP Request Sent to HTTPS Port (non-standard, nginx)
499 Client Closed Request (non-standard, nginx)
```

```bash
cat-status --list 5xx
```

Matching lines include:

```text
521 Web Server Is Down (non-standard, Cloudflare)
522 Connection Timed Out (non-standard, Cloudflare)
523 Origin Is Unreachable (non-standard, Cloudflare)
525 SSL Handshake Failed (non-standard, Cloudflare)
```

## See nonStandard fields in --list --json

Command:

```text
cat-status --list [1xx|2xx|3xx|4xx|5xx] --json
```

Same combination rules as `--list`. On success, stdout is a JSON array. Non-standard objects include `"nonStandard": true` and `"product"`. Standard objects have only `code` and `reason`. Exit code `0`.

Example object for 419 from `cat-status --list 4xx --json`:

```text
{"code":419,"reason":"Page Expired","nonStandard":true,"product":"Laravel"}
```

Example standard object from the same list:

```text
{"code":404,"reason":"Not Found"}
```

## Look up a non-standard code like any other known code

Command:

```text
cat-status <code>
cat-status <code> --json
```

Valid with `--save <path>` (and then `--force`, `--timeout <ms>`). Not valid with `--list`.

Plain stdout is the URL only. Lookup `--json` has `code`, `reason`, and `url` only — it does not add `nonStandard` or `product`.

```bash
cat-status 419
```

```text
https://http.cat/419
```

```bash
cat-status 419 --json
```

```text
{"code":419,"reason":"Page Expired","url":"https://http.cat/419"}
```

Exit code: `0`. Stderr empty.
