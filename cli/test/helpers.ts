import { run, type RunIo } from "../src/run.js";
import type { FetchLike } from "../src/save.js";

export interface Capture {
  stdout: string[];
  stderr: string[];
  code: number;
}

export async function runCli(
  args: string[],
  opts: { fetchImpl?: FetchLike; version?: string } = {},
): Promise<Capture> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: RunIo = {
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
    fetchImpl: opts.fetchImpl,
    version: opts.version ?? "1.0.0",
  };
  const code = await run(["node", "cat-status", ...args], io);
  return { stdout, stderr, code };
}

export function mockFetch(options: {
  status?: number;
  body?: Uint8Array | string;
  delayMs?: number;
  throwError?: Error;
}): FetchLike {
  const {
    status = 200,
    body = new Uint8Array([0xff, 0xd8, 0xff]),
    delayMs = 0,
    throwError,
  } = options;

  return async (_input, init) => {
    if (throwError) throw throwError;

    const signal = init?.signal;
    if (delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        const onAbort = () => {
          clearTimeout(timer);
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        };
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }

    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return new Response(bytes, { status });
  };
}
