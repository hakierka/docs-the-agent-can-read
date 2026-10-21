import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  DEFAULT_TIMEOUT_MS,
  EXIT_DOWNLOAD,
  EXIT_INVALID_CODE,
  EXIT_OK,
  EXIT_USAGE,
  parseArgs,
  parseStatusCode,
  type ParsedArgs,
} from "./parse.js";
import {
  formatListLine,
  getIanaReason,
  getStatus,
  imageUrl,
  isKnownCode,
  listByClass,
  type StatusClass,
} from "./status-codes.js";
import { saveImage, type FetchLike, SaveError } from "./save.js";

export interface RunIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  fetchImpl?: FetchLike;
  version?: string;
}

function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/ → package root; also works when tests import from cli/src
    const candidates = [
      join(here, "..", "..", "package.json"),
      join(here, "..", "package.json"),
    ];
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, "utf8")) as { version?: string };
        if (pkg.version) return pkg.version;
      } catch {
        /* try next */
      }
    }
  } catch {
    /* fall through */
  }
  return "0.0.0";
}

function helpText(): string {
  return `cat-status — print or save http.cat images for known HTTP status codes

Usage:
  cat-status <code>
  cat-status <code> --json
  cat-status <code> --save <path> [--force] [--timeout <ms>]
  cat-status --list [1xx|2xx|3xx|4xx|5xx] [--json]
  cat-status --help
  cat-status --version

Exit codes:
  0  ok
  1  usage error
  2  unknown or invalid status code
  3  download failed
`;
}

export async function run(argv: string[], io: RunIo = { stdout: console.log, stderr: console.error }): Promise<number> {
  const parsed = parseArgs(argv);
  return dispatch(parsed, io);
}

async function dispatch(parsed: ParsedArgs, io: RunIo): Promise<number> {
  switch (parsed.kind) {
    case "error":
      io.stderr(parsed.message);
      return EXIT_USAGE;
    case "help":
      io.stdout(helpText().trimEnd());
      return EXIT_OK;
    case "version":
      io.stdout(io.version ?? packageVersion());
      return EXIT_OK;
    case "list":
      return runList(parsed.statusClass, parsed.json, io);
    case "lookup":
      return runLookup(parsed, io);
  }
}

function runList(
  statusClass: StatusClass | undefined,
  json: boolean,
  io: RunIo,
): number {
  const entries = listByClass(statusClass);
  if (json) {
    io.stdout(
      JSON.stringify(
        entries.map((e) => {
          const row: {
            code: number;
            reason: string;
            nonStandard?: boolean;
            product?: string;
          } = { code: e.code, reason: e.reason };
          if (e.nonStandard) {
            row.nonStandard = true;
            if (e.product) row.product = e.product;
          }
          return row;
        }),
      ),
    );
  } else {
    for (const e of entries) {
      io.stdout(formatListLine(e));
    }
  }
  return EXIT_OK;
}

async function runLookup(
  parsed: Extract<ParsedArgs, { kind: "lookup" }>,
  io: RunIo,
): Promise<number> {
  const parsedCode = parseStatusCode(parsed.rawCode);
  if (!parsedCode.ok) {
    if (parsedCode.reason === "format") {
      io.stderr(`invalid status code: ${parsed.rawCode}`);
    } else {
      io.stderr(`status code out of range: ${parsed.rawCode}`);
    }
    return EXIT_INVALID_CODE;
  }

  const { code } = parsedCode;
  if (!isKnownCode(code)) {
    const iana = getIanaReason(code);
    if (iana) {
      // Real HTTP status with no http.cat image in our table (e.g. 505).
      // 505 checked against http.cat on 2026-10-21 — HEAD returned HTTP 404.
      io.stderr(`no cat image for ${code} (${iana})`);
    } else {
      io.stderr(`unknown status code: ${code}`);
    }
    return EXIT_INVALID_CODE;
  }

  const entry = getStatus(code)!;
  const url = imageUrl(code);

  if (parsed.savePath) {
    try {
      await saveImage({
        url,
        path: parsed.savePath,
        force: parsed.force,
        timeoutMs: parsed.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        fetchImpl: io.fetchImpl,
      });
    } catch (err) {
      const msg = err instanceof SaveError ? err.message : err instanceof Error ? err.message : String(err);
      io.stderr(msg);
      return EXIT_DOWNLOAD;
    }
  }

  if (parsed.json) {
    io.stdout(JSON.stringify({ code: entry.code, reason: entry.reason, url }));
  } else {
    io.stdout(url);
  }
  return EXIT_OK;
}
