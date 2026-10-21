import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mockFetch, runCli } from "./helpers.js";

describe("cat-status --save", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cat-status-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("downloads with injected fetch (success)", async () => {
    const path = join(dir, "out.jpg");
    const body = new Uint8Array([1, 2, 3, 4]);
    const r = await runCli(["200", "--save", path], {
      fetchImpl: mockFetch({ body }),
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toEqual(["https://http.cat/200"]);
    expect(Buffer.from(await readFile(path))).toEqual(Buffer.from(body));
  });

  it("fails on timeout (exit 3)", async () => {
    const path = join(dir, "slow.jpg");
    const r = await runCli(["200", "--save", path, "--timeout", "50"], {
      fetchImpl: mockFetch({ delayMs: 500 }),
    });
    expect(r.code).toBe(3);
    expect(r.stderr[0]).toMatch(/timed out/i);
  });

  it("fails when fetch returns HTTP 404 (exit 3)", async () => {
    const path = join(dir, "missing.jpg");
    const r = await runCli(["200", "--save", path], {
      fetchImpl: mockFetch({ status: 404 }),
    });
    expect(r.code).toBe(3);
    expect(r.stderr[0]).toMatch(/HTTP 404/);
  });

  it("refuses overwrite without --force (exit 3)", async () => {
    const path = join(dir, "exists.jpg");
    await writeFile(path, "keep-me");
    const r = await runCli(["200", "--save", path], {
      fetchImpl: mockFetch({ body: "new" }),
    });
    expect(r.code).toBe(3);
    expect(r.stderr[0]).toMatch(/file exists/i);
    expect(await readFile(path, "utf8")).toBe("keep-me");
  });

  it("overwrites with --force", async () => {
    const path = join(dir, "exists.jpg");
    await writeFile(path, "old");
    const r = await runCli(["200", "--save", path, "--force"], {
      fetchImpl: mockFetch({ body: "new-bytes" }),
    });
    expect(r.code).toBe(0);
    expect(await readFile(path, "utf8")).toBe("new-bytes");
  });

  it("requires a path after --save (exit 1)", async () => {
    const r = await runCli(["200", "--save"]);
    expect(r.code).toBe(1);
    expect(r.stderr[0]).toMatch(/--save requires a path/);
  });

  it("rejects --timeout without --save (exit 1)", async () => {
    const r = await runCli(["200", "--timeout", "1000"]);
    expect(r.code).toBe(1);
    expect(r.stderr[0]).toMatch(/--timeout only applies with --save/);
  });

  it("rejects --force without --save (exit 1)", async () => {
    const r = await runCli(["200", "--force"]);
    expect(r.code).toBe(1);
    expect(r.stderr[0]).toMatch(/--force only applies with --save/);
  });
});
