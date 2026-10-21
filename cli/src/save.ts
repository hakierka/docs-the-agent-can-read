import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveError";
  }
}

export interface SaveOptions {
  url: string;
  path: string;
  force?: boolean;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function mapWriteError(err: unknown, path: string): never {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : undefined;

  if (code === "EEXIST") {
    throw new SaveError(`file exists: ${path} (use --force to overwrite)`);
  }
  if (code === "ENOENT") {
    throw new SaveError(`cannot write ${path}: directory does not exist`);
  }
  if (code === "EISDIR") {
    throw new SaveError(`cannot write ${path}: path is a directory`);
  }
  if (code === "EACCES") {
    throw new SaveError(`cannot write ${path}: permission denied`);
  }
  const msg = err instanceof Error ? err.message : String(err);
  throw new SaveError(`cannot write ${path}: ${msg}`);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export async function saveImage(options: SaveOptions): Promise<void> {
  const {
    url,
    path,
    force = false,
    timeoutMs = 5000,
    fetchImpl = globalThis.fetch,
  } = options;

  if (!force && (await pathExists(path))) {
    throw new SaveError(`file exists: ${path} (use --force to overwrite)`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, { signal: controller.signal });
    } catch (err) {
      if (isAbortError(err)) {
        throw new SaveError(`download timed out after ${timeoutMs}ms`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new SaveError(`download failed: ${msg}`);
    }

    if (!response.ok) {
      throw new SaveError(`download failed: HTTP ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new SaveError(`download failed: unexpected content type ${contentType}`);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await response.arrayBuffer());
    } catch (err) {
      if (isAbortError(err)) {
        throw new SaveError(`download timed out after ${timeoutMs}ms`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new SaveError(`download failed: ${msg}`);
    }

    try {
      await writeFile(path, buffer, { flag: force ? "w" : "wx" });
    } catch (err) {
      mapWriteError(err, path);
    }
  } finally {
    clearTimeout(timer);
  }
}
