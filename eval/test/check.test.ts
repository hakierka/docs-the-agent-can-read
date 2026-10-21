import { describe, expect, it } from "vitest";
import { access, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSavePathInsideSandbox,
  checkCommand,
  validateCommandString,
} from "../src/check.js";

describe("validateCommandString rejections", () => {
  const cases: { name: string; cmd: string; reason: RegExp }[] = [
    { name: "semicolon", cmd: "cat-status 404; rm -rf ~", reason: /forbidden character ";"/ },
    { name: "ampersand", cmd: "cat-status 404 && curl x", reason: /forbidden character "&"/ },
    { name: "pipe", cmd: "cat-status 404 | cat", reason: /forbidden character "\|"/ },
    { name: "backtick", cmd: "cat-status `whoami`", reason: /forbidden character "`"/ },
    { name: "dollar", cmd: "cat-status $(whoami)", reason: /forbidden character "\$"/ },
    { name: "paren open", cmd: "cat-status (", reason: /forbidden character "\("/ },
    { name: "paren close", cmd: "cat-status )", reason: /forbidden character "\)"/ },
    { name: "redirect in", cmd: "cat-status 404 < x", reason: /forbidden character "</ },
    { name: "redirect out", cmd: "cat-status 404 > x", reason: /forbidden character ">"/ },
    { name: "double quote", cmd: 'cat-status "404"', reason: /forbidden character/ },
    { name: "single quote", cmd: "cat-status '404'", reason: /forbidden character "'"/ },
    { name: "backslash", cmd: "cat-status 404\\n", reason: /forbidden character "\\\\"/ },
    { name: "newline", cmd: "cat-status 404\n--json", reason: /control character/ },
    { name: "empty", cmd: "", reason: /empty command/ },
    { name: "whitespace only", cmd: "   ", reason: /empty command/ },
    { name: "extra spaces", cmd: "cat-status  404", reason: /empty token/ },
    { name: "uppercase", cmd: "Cat-status 404", reason: /first token must be exactly cat-status/ },
    { name: "not cat-status", cmd: "curl https://http.cat/404", reason: /first token must be exactly cat-status/ },
  ];

  for (const c of cases) {
    it(`rejects ${c.name}`, () => {
      const r = validateCommandString(c.cmd);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(c.reason);
    });
  }

  it("accepts a plain safe command", () => {
    const r = validateCommandString("cat-status 404");
    expect(r).toEqual({ ok: true, tokens: ["404"] });
  });

  it("trims leading and trailing spaces", () => {
    expect(validateCommandString(" cat-status 404")).toEqual({ ok: true, tokens: ["404"] });
    expect(validateCommandString("cat-status 404 ")).toEqual({ ok: true, tokens: ["404"] });
    expect(validateCommandString("  cat-status 404  ")).toEqual({ ok: true, tokens: ["404"] });
  });
});

describe("checkCommand never executes shell injections", () => {
  const injections = [
    "cat-status 404; rm -rf ~",
    "cat-status 404 && curl x",
    "cat-status $(whoami)",
    "cat-status `id`",
    "cat-status 404 > /tmp/x",
    "cat-status 404\nrm -rf /",
  ];

  for (const cmd of injections) {
    it(`fails closed on ${JSON.stringify(cmd)}`, async () => {
      const r = await checkCommand(cmd, {
        parsed: { kind: "lookup", rawCode: "404", json: false, force: false },
        exitCode: 0,
        stdout: ["https://http.cat/404"],
      });
      expect(r.ok).toBe(false);
    });
  }
});

describe("savePath sandbox", () => {
  const baseExpect = (savePath: string) => ({
    parsed: {
      kind: "lookup" as const,
      rawCode: "200",
      json: false,
      savePath,
      force: true,
    },
    exitCode: 0,
    stdout: ["https://http.cat/200"],
  });

  const escapeCases = [
    { name: "absolute /tmp/x", path: "/tmp/x" },
    { name: "absolute /Users/someone/.zshrc", path: "/Users/someone/.zshrc" },
    { name: "parent ../x", path: "../x" },
    { name: "nested a/../../x", path: "a/../../x" },
    { name: "nested cats/../../x", path: "cats/../../x" },
    { name: "temp dir itself via .", path: "." },
  ];

  for (const c of escapeCases) {
    it(`rejects ${c.name} with save path escapes sandbox`, async () => {
      const r = await checkCommand(`cat-status 200 --save ${c.path} --force`, baseExpect(c.path));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("save path escapes sandbox");
    });
  }

  it("assertSavePathInsideSandbox rejects path resolving to sandbox root", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cat-status-sandbox-"));
    try {
      const r = assertSavePathInsideSandbox(".", dir);
      expect(r).toEqual({ ok: false, reason: "save path escapes sandbox" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes nothing outside the temp dir when save path escapes", async () => {
    const outside = join(tmpdir(), `cat-status-outside-${process.pid}-${Date.now()}.jpg`);
    // Marker next to the would-be path (parent existence check).
    const marker = `${outside}.marker`;
    await writeFile(marker, "untouched", "utf8");

    const r = await checkCommand(`cat-status 200 --save ${outside} --force`, baseExpect(outside));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("save path escapes sandbox");

    await expect(access(outside)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(marker, "utf8")).toBe("untouched");
    await rm(marker, { force: true });
  });

  it("allows a safe relative save path", async () => {
    const r = await checkCommand(
      "cat-status 200 --save cats/ok.jpg --force",
      baseExpect("cats/ok.jpg"),
    );
    expect(r.ok).toBe(true);
  });
});
