import { describe, expect, it } from "vitest";
import { runCli } from "./helpers.js";
import { listByClass, STATUS_CODES } from "../src/status-codes.js";

describe("cat-status --list", () => {
  it("lists all codes and reason phrases", async () => {
    const r = await runCli(["--list"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toHaveLength(STATUS_CODES.length);
    expect(r.stdout[0]).toBe("100 Continue");
    expect(r.stdout.some((l) => l.startsWith("404 "))).toBe(true);
  });

  it("filters by 4xx", async () => {
    const r = await runCli(["--list", "4xx"]);
    expect(r.code).toBe(0);
    const expected = listByClass("4xx");
    expect(r.stdout).toHaveLength(expected.length);
    for (const line of r.stdout) {
      const code = Number(line.split(" ")[0]);
      expect(code).toBeGreaterThanOrEqual(400);
      expect(code).toBeLessThan(500);
    }
  });

  it("filters each class", async () => {
    for (const cls of ["1xx", "2xx", "3xx", "4xx", "5xx"] as const) {
      const r = await runCli(["--list", cls]);
      expect(r.code).toBe(0);
      expect(r.stdout.length).toBe(listByClass(cls).length);
    }
  });

  it("prints JSON list with --json", async () => {
    const r = await runCli(["--list", "1xx", "--json"]);
    expect(r.code).toBe(0);
    const data = JSON.parse(r.stdout[0]!) as { code: number; reason: string }[];
    expect(data).toEqual(
      listByClass("1xx").map((e) => {
        const row: { code: number; reason: string; nonStandard?: boolean; product?: string } = {
          code: e.code,
          reason: e.reason,
        };
        if (e.nonStandard) {
          row.nonStandard = true;
          if (e.product) row.product = e.product;
        }
        return row;
      }),
    );
  });

  it("marks non-standard codes in plain --list output", async () => {
    const r = await runCli(["--list", "4xx"]);
    expect(r.code).toBe(0);
    expect(r.stdout.some((l) => l === "419 Page Expired (non-standard, Laravel)")).toBe(true);
    expect(r.stdout.some((l) => l === "444 No Response (non-standard, nginx)")).toBe(true);
  });

  it("rejects --list with a positional code (exit 1)", async () => {
    const r = await runCli(["--list", "404"]);
    // 404 is not a class token, so it becomes a positional → usage error
    expect(r.code).toBe(1);
  });
});
