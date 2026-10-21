#!/usr/bin/env node
/**
 * Offline internal link check over the Starlight build output.
 * Skips external http(s) URLs so CI stays network-free for this step.
 */
import { readdir, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") {
      console.error(`link check: missing build output at ${root}`);
      console.error("run: npm run build");
      process.exit(1);
    }
    throw err;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && (e.name.endsWith(".html") || e.name.endsWith(".htm"))) {
      out.push(p);
    }
  }
  return out;
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

function isExternal(href) {
  return /^(https?:|mailto:|tel:|data:|javascript:)/i.test(href);
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function candidatesFor(target) {
  const list = [target];
  if (!extname(target)) {
    list.push(join(target, "index.html"));
    list.push(`${target}.html`);
  }
  return list;
}

async function resolveLocal(fromFile, href) {
  const bare = href.split("#")[0].split("?")[0];
  if (!bare) return null; // pure fragment

  let target;
  if (bare.startsWith("/")) {
    target = resolve(root, "." + bare);
  } else {
    target = resolve(dirname(fromFile), bare);
  }

  for (const c of await candidatesFor(target)) {
    if (await exists(c)) return c;
  }
  return target;
}

const files = await walk(root);
let broken = 0;

for (const file of files) {
  const html = await readFile(file, "utf8");
  for (const href of extractHrefs(html)) {
    if (isExternal(href)) continue;
    if (href.startsWith("#")) continue;
    const target = await resolveLocal(file, href);
    if (target === null) continue;
    if (!(await exists(target))) {
      console.error(`broken: ${file} -> ${href}`);
      broken++;
    }
  }
}

if (broken > 0) {
  console.error(`link check failed: ${broken} broken internal link(s)`);
  process.exit(1);
}

console.log(`link check ok: ${files.length} html file(s), no broken internal links`);
