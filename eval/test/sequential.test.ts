import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RUN_TS = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "run.ts");

describe("runner is sequential", () => {
  it("run.ts does not call Promise.all for tasks or runs", async () => {
    const src = await readFile(RUN_TS, "utf8");
    expect(src).toMatch(/Tasks and runs must be sequential/);
    // Real call site only (comment text alone must not trip this).
    expect(src).not.toMatch(/Promise\.all\s*\(/);
  });
});
