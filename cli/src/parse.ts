import type { StatusClass } from "./status-codes.js";

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_INVALID_CODE = 2;
export const EXIT_DOWNLOAD = 3;

export const DEFAULT_TIMEOUT_MS = 5000;

export type ParsedArgs =
  | { kind: "help" }
  | { kind: "version" }
  | {
      kind: "list";
      statusClass?: StatusClass;
      json: boolean;
    }
  | {
      kind: "lookup";
      rawCode: string;
      json: boolean;
      savePath?: string;
      force: boolean;
      timeoutMs: number;
    }
  | { kind: "error"; message: string };

const STATUS_CLASSES = new Set(["1xx", "2xx", "3xx", "4xx", "5xx"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let help = false;
  let version = false;
  let list = false;
  let listClass: string | undefined;
  let json = false;
  let savePath: string | undefined;
  let force = false;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let timeoutSeen = false;
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    // End of options: everything after `--` is positional (so `-1` is a code, not a flag).
    if (a === "--") {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (a === "--help" || a === "-h") {
      help = true;
      continue;
    }
    if (a === "--version" || a === "-V") {
      version = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--force") {
      force = true;
      continue;
    }
    if (a === "--list") {
      list = true;
      const next = args[i + 1];
      if (next && !next.startsWith("-") && STATUS_CLASSES.has(next)) {
        listClass = next;
        i++;
      }
      continue;
    }
    if (a === "--save") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        return { kind: "error", message: "usage: --save requires a path" };
      }
      savePath = next;
      i++;
      continue;
    }
    if (a === "--timeout") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        return { kind: "error", message: "usage: --timeout requires a millisecond value" };
      }
      if (!/^\d+$/.test(next)) {
        return { kind: "error", message: "usage: --timeout must be a positive integer (ms)" };
      }
      const n = Number(next);
      if (n < 1) {
        return { kind: "error", message: "usage: --timeout must be a positive integer (ms)" };
      }
      timeoutMs = n;
      timeoutSeen = true;
      i++;
      continue;
    }
    if (a.startsWith("-")) {
      return { kind: "error", message: `usage: unknown option ${a}` };
    }
    positionals.push(a);
  }

  if (help) return { kind: "help" };
  if (version) return { kind: "version" };

  if (list) {
    if (savePath !== undefined) {
      return { kind: "error", message: "usage: --list cannot be combined with --save" };
    }
    if (timeoutSeen) {
      return { kind: "error", message: "usage: --timeout only applies with --save" };
    }
    if (force) {
      return { kind: "error", message: "usage: --force only applies with --save" };
    }
    if (positionals.length > 0) {
      return { kind: "error", message: "usage: --list does not take a status code" };
    }
    return {
      kind: "list",
      statusClass: listClass as StatusClass | undefined,
      json,
    };
  }

  if (positionals.length === 0) {
    return { kind: "error", message: "usage: cat-status <code> | cat-status --list [class] | cat-status --help" };
  }
  if (positionals.length > 1) {
    return { kind: "error", message: "usage: expected a single status code" };
  }

  if (timeoutSeen && savePath === undefined) {
    return { kind: "error", message: "usage: --timeout only applies with --save" };
  }
  if (force && savePath === undefined) {
    return { kind: "error", message: "usage: --force only applies with --save" };
  }

  return {
    kind: "lookup",
    rawCode: positionals[0]!,
    json,
    savePath,
    force,
    timeoutMs,
  };
}

/**
 * Accept only plain decimal integer strings in range 100–599 that appear
 * in the known table. Reject scientific notation, decimals, signs, empties.
 */
export function parseStatusCode(raw: string): { ok: true; code: number } | { ok: false; reason: "format" | "range" | "unknown" } {
  if (raw === "" || !/^[0-9]+$/.test(raw)) {
    return { ok: false, reason: "format" };
  }
  // Leading zeros like "0404" → numeric 404; still require the string to be digits only.
  const code = Number(raw);
  if (!Number.isInteger(code) || code < 100 || code > 599) {
    return { ok: false, reason: "range" };
  }
  return { ok: true, code };
}
