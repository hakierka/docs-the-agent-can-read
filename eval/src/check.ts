import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { parseArgs, type ParsedArgs } from "../../cli/src/parse.js";
import { run } from "../../cli/src/run.js";

/** Characters that must never appear in a model command string. */
const FORBIDDEN_CHARS = new Set([
  ";",
  "&",
  "|",
  "`",
  "$",
  "(",
  ")",
  "<",
  ">",
  '"',
  "'",
  "\\",
]);

export type CheckFail = {
  ok: false;
  reason: string;
};

export type CheckPass = {
  ok: true;
  argv: string[];
  parsed: ParsedArgs;
  exitCode: number;
  stdout: string[];
  stderr: string[];
};

export type CheckResult = CheckPass | CheckFail;

export type CommandExpect = {
  parsed: Record<string, unknown>;
  exitCode: number;
  stdout?: string[];
  stdoutIncludes?: Record<string, unknown>;
};

export type AnswerExpect = {
  answer: unknown;
};

/**
 * Reject shell-like command strings. Never executes anything.
 * Leading/trailing whitespace is trimmed; double spaces inside still fail.
 * Returns tokens after the leading `cat-status`, or a failure reason.
 */
export function validateCommandString(command: string): { ok: true; tokens: string[] } | CheckFail {
  const trimmed = command.trim();
  if (trimmed === "") {
    return { ok: false, reason: "empty command" };
  }

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 32 || code === 127) {
      return {
        ok: false,
        reason: `forbidden control character U+${code.toString(16).padStart(4, "0")}`,
      };
    }
    const ch = trimmed[i]!;
    if (FORBIDDEN_CHARS.has(ch)) {
      return { ok: false, reason: `forbidden character ${JSON.stringify(ch)}` };
    }
  }

  // Split on single spaces only so double spaces become empty tokens → reject.
  const parts = trimmed.split(" ");
  if (parts.some((p) => p === "")) {
    return { ok: false, reason: "empty token (extra or leading/trailing spaces)" };
  }

  if (parts[0] !== "cat-status") {
    return {
      ok: false,
      reason: `first token must be exactly cat-status, got ${JSON.stringify(parts[0])}`,
    };
  }

  return { ok: true, tokens: parts.slice(1) };
}

/**
 * Ensure --save path stays strictly inside sandboxDir.
 * Rejects before any mkdir/write under that path.
 */
export function assertSavePathInsideSandbox(savePath: string, sandboxDir: string): CheckFail | null {
  if (isAbsolute(savePath)) {
    return { ok: false, reason: "save path escapes sandbox" };
  }
  const segments = savePath.split(/[/\\]/).filter((s) => s.length > 0);
  if (segments.some((s) => s === "..")) {
    return { ok: false, reason: "save path escapes sandbox" };
  }

  const root = resolve(sandboxDir);
  const resolved = resolve(root, savePath);
  if (resolved === root || !resolved.startsWith(root + sep)) {
    return { ok: false, reason: "save path escapes sandbox" };
  }
  return null;
}

function parsedMatches(actual: ParsedArgs, expected: Record<string, unknown>): string | null {
  for (const [key, want] of Object.entries(expected)) {
    const got = (actual as Record<string, unknown>)[key];
    if (got !== want) {
      if (want === undefined && got === undefined) continue;
      return `parsed.${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`;
    }
  }
  return null;
}

/**
 * Validate command text, then run cat-status in-process (no shell) with mocked fetch.
 */
export async function checkCommand(
  command: string,
  expect: CommandExpect,
  options: { timeoutMs?: number } = {},
): Promise<CheckResult> {
  const validated = validateCommandString(command);
  if (!validated.ok) return validated;

  const argv = ["node", "cat-status", ...validated.tokens];
  const parsed = parseArgs(argv);

  const mismatch = parsedMatches(parsed, expect.parsed);
  if (mismatch) {
    return { ok: false, reason: mismatch };
  }

  const wallMs = options.timeoutMs ?? 10_000;
  const dir = await mkdtemp(join(tmpdir(), "cat-status-eval-"));
  const stdout: string[] = [];
  const stderr: string[] = [];
  const prevCwd = process.cwd();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    if (parsed.kind === "lookup" && parsed.savePath) {
      const escape = assertSavePathInsideSandbox(parsed.savePath, dir);
      if (escape) {
        return escape;
      }
      // Only after sandbox check: create parent dirs for the save path.
      const abs = join(dir, parsed.savePath);
      await mkdir(dirname(abs), { recursive: true });
    }

    // Relative --save paths must resolve inside the temp dir (no shell; chdir only).
    // Callers must run tasks sequentially — process.chdir is process-global.
    process.chdir(dir);

    const mockFetch: typeof fetch = async () =>
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });

    const runPromise = run(argv, {
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
      fetchImpl: mockFetch,
      version: "1.0.0",
    });

    const exitCode = await Promise.race([
      runPromise,
      new Promise<number>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`in-process run timed out after ${wallMs}ms`)),
          wallMs,
        );
      }),
    ]);

    if (exitCode !== expect.exitCode) {
      return {
        ok: false,
        reason: `exit code: expected ${expect.exitCode}, got ${exitCode}`,
      };
    }

    if (expect.stdout) {
      if (stdout.length !== expect.stdout.length || stdout.some((l, i) => l !== expect.stdout![i])) {
        return {
          ok: false,
          reason: `stdout: expected ${JSON.stringify(expect.stdout)}, got ${JSON.stringify(stdout)}`,
        };
      }
    }

    if (expect.stdoutIncludes) {
      let obj: unknown;
      try {
        obj = JSON.parse(stdout[0] ?? "");
      } catch {
        return { ok: false, reason: `stdout was not JSON: ${JSON.stringify(stdout)}` };
      }
      if (typeof obj !== "object" || obj === null) {
        return { ok: false, reason: `stdout JSON was not an object: ${JSON.stringify(obj)}` };
      }
      for (const [k, v] of Object.entries(expect.stdoutIncludes)) {
        if ((obj as Record<string, unknown>)[k] !== v) {
          return {
            ok: false,
            reason: `stdout JSON.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify((obj as Record<string, unknown>)[k])}`,
          };
        }
      }
    }

    return { ok: true, argv: validated.tokens, parsed, exitCode, stdout, stderr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    process.chdir(prevCwd);
    await rm(dir, { recursive: true, force: true });
  }
}

export function checkAnswer(answer: unknown, expect: AnswerExpect): CheckResult {
  if (answer !== expect.answer) {
    return {
      ok: false,
      reason: `answer: expected ${JSON.stringify(expect.answer)}, got ${JSON.stringify(answer)}`,
    };
  }
  return {
    ok: true,
    argv: [],
    parsed: { kind: "help" },
    exitCode: 0,
    stdout: [],
    stderr: [],
  };
}

export type ModelJson =
  | { kind: "command"; command: string }
  | { kind: "answer"; answer: unknown };

/**
 * Parse model output. Must be a single JSON object with exactly one of command|answer.
 */
export function parseModelOutput(raw: string): { ok: true; value: ModelJson } | CheckFail {
  const trimmed = raw.trim();
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "model output is not valid JSON" };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, reason: "model output JSON must be an object" };
  }
  const keys = Object.keys(data);
  if (keys.length !== 1) {
    return { ok: false, reason: `model output must have exactly one key, got ${JSON.stringify(keys)}` };
  }
  if ("command" in data) {
    if (typeof (data as { command: unknown }).command !== "string") {
      return { ok: false, reason: "command must be a string" };
    }
    return { ok: true, value: { kind: "command", command: (data as { command: string }).command } };
  }
  if ("answer" in data) {
    return { ok: true, value: { kind: "answer", answer: (data as { answer: unknown }).answer } };
  }
  return { ok: false, reason: "model output must have key command or answer" };
}
