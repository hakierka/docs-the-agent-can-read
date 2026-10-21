import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Import or require of Node's child_process, or its spawn/exec APIs as bindings. */
const FORBIDDEN =
  /from\s+["']node:child_process["']|from\s+["']child_process["']|require\s*\(\s*["'](?:node:)?child_process["']\s*\)|\bexecFile\s*\(|\bexecSync\s*\(|\bspawnSync\s*\(|\bspawn\s*\(|\bexec\s*\(/;

describe("harness imports no child_process", () => {
  it("no eval/src file imports child_process or calls spawn/execFile APIs", async () => {
    const names = await readdir(SRC);
    const files = names.filter((n) => n.endsWith(".ts")).map((n) => join(SRC, n));
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      // Strip RegExp.prototype.exec / String usages that are not shell.
      const withoutRegexExec = text.replace(/\.exec\s*\(/g, ".MATCH(");
      if (FORBIDDEN.test(withoutRegexExec)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });
});
