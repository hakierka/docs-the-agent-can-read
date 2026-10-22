---
title: Save an image to a file
description: Download a http.cat image with --save, --force, and --timeout.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Download the image for a known code

Command:

```text
cat-status <code> --save <path> [--force] [--timeout <ms>] [--json]
```

`<code>` must be a known allowlist code. `--save` requires a path that does not start with `-`. This is the only network use.

Valid with `--json`, `--force`, and `--timeout <ms>`. Not valid with `--list`. `--force` and `--timeout` are only valid when `--save` is present.

Default timeout is `5000` milliseconds. Without `--force`, an existing file is refused.

On success, the image bytes are written to `<path>`, stdout is still the URL (or lookup JSON if `--json`), stderr is empty, exit code is `0`.

```bash
cat-status 404 --save /tmp/cat-404.jpg
```

```text
https://http.cat/404
```

(Exit `0` when the download and write succeed. Needs network. The file is a JPEG from http.cat.)

## Overwrite an existing file with --force

Command:

```text
cat-status <code> --save <path> --force [--timeout <ms>] [--json]
```

`--force` is only valid with `--save`. Without `--force`, the CLI checks the path first and stops before any download starts.

Refuse without `--force`:

```bash
cat-status 200 --save /tmp/already-there.jpg
```

When the file exists:

```text
file exists: /tmp/already-there.jpg (use --force to overwrite)
```

Stdout empty. Exit code: `3`.

Overwrite:

```bash
cat-status 200 --save /tmp/already-there.jpg --force
```

```text
https://http.cat/200
```

Exit code: `0` when the write succeeds. Needs network.

## Set a download timeout

Command:

```text
cat-status <code> --save <path> --timeout <ms> [--force] [--json]
```

`<ms>` must be a positive integer string (`/^\d+$/` and value ≥ 1). Default when omitted: `5000`.

`--timeout` is only valid with `--save`. Not valid with `--list` or with a bare lookup.

On timeout, stdout is empty. Stderr:

```text
download timed out after <ms>ms
```

Exit code: `3`.

```bash
cat-status 200 --timeout 1000
```

```text
usage: --timeout only applies with --save
```

Exit code: `1` (no `--save`).

```bash
cat-status 200 --save /tmp/out.jpg --timeout 0
```

```text
usage: --timeout must be a positive integer (ms)
```

Exit code: `1`.

## Handle download and write failures

Command: `cat-status <code> --save <path> [--force] [--timeout <ms>] [--json]`

On these failures, stdout is empty and exit code is `3` (unless the problem is usage, which is exit `1`).

Missing parent directory:

```bash
cat-status 200 --save /tmp/no-such-dir-xyz/out.jpg
```

```text
cannot write /tmp/no-such-dir-xyz/out.jpg: directory does not exist
```

Exit code: `3`.

Path is a directory (use `--force` so the early exists check does not stop first):

```bash
cat-status 200 --save /tmp/some-dir --force
```

```text
cannot write /tmp/some-dir: path is a directory
```

Exit code: `3`.

Permission denied:

```text
cannot write <path>: permission denied
```

Exit code: `3`.

HTTP error from the image host:

```text
download failed: HTTP <status>
```

Exit code: `3`.

Unexpected content type (must start with `image/`, compared case-insensitively):

```text
download failed: unexpected content type <type>
```

Exit code: `3`.

Other fetch failures:

```text
download failed: <message>
```

Exit code: `3`.

## Require a path after --save

Command mistakes:

```text
cat-status <code> --save
cat-status --save
cat-status --save --force
```

Stdout empty. Stderr:

```text
usage: --save requires a path
```

Exit code: `1`.

```bash
cat-status 200 --save
```

```text
usage: --save requires a path
```

## Reject --force without --save

Command:

```text
cat-status <code> --force
```

```bash
cat-status 200 --force
```

```text
usage: --force only applies with --save
```

Stdout empty. Exit code: `1`.
