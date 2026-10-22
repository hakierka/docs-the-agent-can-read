---
title: Changelog
description: Notable changes to cat-status.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Read what shipped in 1.0.0

Version `1.0.0` is the first release of the `cat-status` CLI (package.json version string printed by `cat-status --version`).

Command to print the version:

```text
cat-status --version
```

Also accepted: `cat-status -V`. Not combined with a status lookup. Stdout is the version string. Stderr empty. Exit code `0`.

```bash
cat-status --version
```

```text
1.0.0
```

Included in 1.0.0:

- Look up known HTTP status codes and print the http.cat URL (`cat-status <code>`).
- Optional `--save` download with `--force` and `--timeout` (default 5000 ms).
- `--list` by status class (`1xx`…`5xx`); non-standard codes marked with product name.
- Distinct stderr for registered HTTP statuses with no cat image (for example 505).
- `--json`, `--help` / `-h`, `--version` / `-V`.
- Offline unit tests with an injectable `fetch`.
