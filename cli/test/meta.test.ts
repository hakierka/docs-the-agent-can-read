import { describe, expect, it } from "vitest";
import { runCli } from "./helpers.js";

describe("help and version", () => {
  it("--help prints usage and exits 0", async () => {
    const r = await runCli(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout.join("\n")).toMatch(/Usage:/);
    expect(r.stdout.join("\n")).toMatch(/--list/);
    expect(r.stdout.join("\n")).toMatch(/--save/);
  });

  it("--version prints the version string", async () => {
    const r = await runCli(["--version"], { version: "1.0.0" });
    expect(r.code).toBe(0);
    expect(r.stdout).toEqual(["1.0.0"]);
  });

  it("unknown option exits 1", async () => {
    const r = await runCli(["--nope"]);
    expect(r.code).toBe(1);
    expect(r.stderr[0]).toMatch(/unknown option/);
  });

  it("two positionals exits 1", async () => {
    const r = await runCli(["404", "500"]);
    expect(r.code).toBe(1);
    expect(r.stderr[0]).toMatch(/single status code/);
  });
});
