---
title: Install
description: How to install cat-status.
---

Needs Node.js 22 or newer.

From the repo root:

```bash
npm install
npm run build
```

That compiles the CLI into `dist/`. Run it with:

```bash
node dist/cli.js --help
```

Or link the binary locally:

```bash
npm link
cat-status --help
```

There is no npm publish step for this demo yet. Install from the local checkout.
