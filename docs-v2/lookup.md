---
title: Look up a status code URL
description: Print the http.cat URL for one known HTTP status code.
---

Applies to: cat-status 1.0.0. Last checked: 2026-10-22.

## Print the image URL for a known code

Command:

```text
cat-status <code>
```

`<code>` must be digits only, with no leading zeros (use `404`, not `0404`), an integer from 100 through 599, and present in the built-in http.cat allowlist.

Flags you may add: `--json` (prints `{"code","reason","url"}` instead of the URL), `--save <path>` (downloads the image, then still prints the URL or JSON). With `--save` you may also pass `--force` and `--timeout <ms>` (default timeout `5000`). Flags you cannot use on a bare lookup: `--force` and `--timeout` without `--save`. You cannot combine `--list` with `<code>`.

On success without `--json`, stdout is one line: `https://http.cat/<code>`. Stderr is empty. Exit code is `0`.

```bash
cat-status 404
```

```text
https://http.cat/404
```

```bash
cat-status 100
```

```text
https://http.cat/100
```

```bash
cat-status 511
```

```text
https://http.cat/511
```

## Reject bad code formats

Command: `cat-status <code>` with a non-integer-shaped string.

Same flag rules as a normal lookup. On failure, stdout is empty. Stderr is `invalid status code: <raw>`. Exit code is `2`.

```bash
cat-status abc
```

```text
invalid status code: abc
```

```bash
cat-status 0404
```

```text
invalid status code: 0404
```

```bash
cat-status 1e2
```

```text
invalid status code: 1e2
```

```bash
cat-status 404.0
```

```text
invalid status code: 404.0
```

## Reject codes outside 100–599

Command: `cat-status <code>` when `<code>` is all digits but outside 100–599.

Stdout is empty. Stderr is `status code out of range: <raw>`. Exit code is `2`.

```bash
cat-status 99
```

```text
status code out of range: 99
```

```bash
cat-status 600
```

```text
status code out of range: 600
```

## Reject unknown or no-image codes

Command: `cat-status <code>` when the number is in range but not in the allowlist.

Stdout is empty. Exit code is `2`.

If the code has an IANA/MDN reason in the CLI’s secondary table, stderr is:

```text
no cat image for <code> (<reason>)
```

```bash
cat-status 505
```

```text
no cat image for 505 (HTTP Version Not Supported)
```

If the code is unassigned (no IANA reason in that table), stderr is:

```text
unknown status code: <code>
```

```bash
cat-status 427
```

```text
unknown status code: 427
```

## Pass a leading dash with --

Values that start with `-` are parsed as options. Command:

```text
cat-status -- <code>
```

Everything after `--` is positional. `--` is not combinable with flags after it as options; flags must appear before `--` if you need them.

```bash
cat-status -1
```

```text
usage: unknown option -1
```

Exit code: `1`. Stdout empty.

```bash
cat-status -- -1
```

```text
invalid status code: -1
```

Exit code: `2`. Stdout empty.
