---
title: Changelog
description: Notable changes to cat-status.
---

## 1.0.0

First release.

- Look up known HTTP status codes and print the http.cat URL.
- Optional `--save` download with `--force` and `--timeout`.
- `--list` by status class; non-standard codes marked with product name.
- Distinct stderr for registered HTTP statuses with no cat image (e.g. 505).
- `--json`, `--help`, `--version`.
- Offline unit tests with an injectable `fetch`.
