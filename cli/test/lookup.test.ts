import { describe, expect, it } from "vitest";
import { runCli } from "./helpers.js";
import { STATUS_CODES } from "../src/status-codes.js";

describe("cat-status <code>", () => {
  it("prints the http.cat URL for a known code", async () => {
    const r = await runCli(["404"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toEqual(["https://http.cat/404"]);
    expect(r.stderr).toEqual([]);
  });

  it("prints JSON with --json", async () => {
    const r = await runCli(["418", "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout[0]!)).toEqual({
      code: 418,
      reason: "I'm a teapot",
      url: "https://http.cat/418",
    });
  });

  it("accepts 100 and 511 when known", async () => {
    const r100 = await runCli(["100"]);
    expect(r100.code).toBe(0);
    expect(r100.stdout[0]).toBe("https://http.cat/100");

    const r511 = await runCli(["511"]);
    expect(r511.code).toBe(0);
    expect(r511.stdout[0]).toBe("https://http.cat/511");
  });

  it("rejects non-digit input abc (exit 2)", async () => {
    const r = await runCli(["abc"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toMatch(/invalid status code/i);
  });

  it("rejects 99 as out of range (exit 2)", async () => {
    const r = await runCli(["99"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toMatch(/out of range/i);
  });

  it("rejects 600 as out of range (exit 2)", async () => {
    const r = await runCli(["600"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toMatch(/out of range/i);
  });

  it("accepts 418 (known teapot code)", async () => {
    const r = await runCli(["418"]);
    expect(r.code).toBe(0);
    expect(r.stdout[0]).toBe("https://http.cat/418");
  });

  it("rejects scientific notation 1e2 (exit 2)", async () => {
    const r = await runCli(["1e2"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toMatch(/invalid status code/i);
  });

  it("rejects empty code via missing arg (exit 1)", async () => {
    const r = await runCli([]);
    expect(r.code).toBe(1);
    expect(r.stderr[0]).toMatch(/usage/i);
  });

  it("rejects empty string code (exit 2)", async () => {
    const r = await runCli([""]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toMatch(/invalid status code/i);
  });

  it("rejects negative -1 as an unknown option (exit 1)", async () => {
    const r = await runCli(["-1"]);
    // Leading dash is parsed as an unknown option → usage error
    expect(r.code).toBe(1);
    expect(r.stderr[0]).toMatch(/unknown option/i);
  });

  it("after --, -1 is a positional code (exit 2 invalid), not an option", async () => {
    const r = await runCli(["--", "-1"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toMatch(/invalid status code/i);
  });

  it("rejects decimal 404.0 (exit 2)", async () => {
    const r = await runCli(["404.0"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toMatch(/invalid status code/i);
  });

  it("rejects 505 with no-cat-image message (exit 2)", async () => {
    // 505 is a real HTTP status; http.cat has no image (checked 2026-10-21).
    expect(STATUS_CODES.some((e) => e.code === 505)).toBe(false);
    const r = await runCli(["505"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toBe("no cat image for 505 (HTTP Version Not Supported)");
  });

  it("rejects an unassigned in-range code as unknown (exit 2)", async () => {
    const r = await runCli(["427"]);
    expect(r.code).toBe(2);
    expect(r.stderr[0]).toBe("unknown status code: 427");
  });
});
