---
title: Troubleshooting
description: Common failures and what they mean.
---

## Invalid code

You typed something that is not a plain integer in range, or a code the tool does not know.

Examples that fail: `abc`, `99`, `600`, `1e2`, `404.0`, and unassigned codes like `427`.

Fix: pick a code from `cat-status --list`.

## Negative numbers look like options

A value like `-1` starts with `-`, so the CLI treats it as a flag and exits `1` (`unknown option`).

Fix: put `--` before the code so the parser stops reading options:

```bash
cat-status -- -1
```

That still fails (exit `2`, invalid status code) because `-1` is not a valid status, but it is no longer a usage/option error.

## Real HTTP status with no cat image

Some registered HTTP statuses are not in this tool’s table because http.cat has no image for them. Example: `505` (HTTP Version Not Supported).

```text
no cat image for 505 (HTTP Version Not Supported)
```

Exit code `2`. checked against http.cat on 2026-10-21.

Fix: pick a code from `cat-status --list`.

## File already exists

`--save` will not overwrite by default. You get exit code `3` and a stderr line about the file.

Fix: choose a new path, or pass `--force`.

## Download timed out

The image fetch hit `--timeout` (default 5000 ms). Exit code `3`.

Fix: raise `--timeout`, or check your network.

## Download returned an HTTP error

http.cat answered with a non-OK status. Exit code `3`.

Fix: retry later. Confirm the code still has an image at https://http.cat.

## Wrong Node version

The package expects Node 22+. Older runtimes may fail at install or run time.

Fix: switch to Node 22 and rebuild.
