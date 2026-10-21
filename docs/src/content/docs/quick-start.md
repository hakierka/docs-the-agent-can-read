---
title: Quick start
description: First commands for cat-status.
---

Print the image URL for a known code:

```bash
cat-status 404
```

Stdout:

```text
https://http.cat/404
```

List every supported 4xx code:

```bash
cat-status --list 4xx
```

Non-standard codes (for example Laravel `419` or nginx `444`) are labeled `(non-standard, <product>)` in the list.

Save an image (needs network):

```bash
cat-status 200 --save out.jpg
```

If the file already exists, add `--force` to overwrite.

Machine-readable lookup:

```bash
cat-status 418 --json
```

Unknown or invalid codes exit with code `2` and a one-line error on stderr. A registered HTTP status with no http.cat image (for example `505`) prints `no cat image for 505 (HTTP Version Not Supported)`.
