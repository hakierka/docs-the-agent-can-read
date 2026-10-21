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

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SaveError(`download timed out after ${timeoutMs}ms`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new SaveError(`download failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new SaveError(`download failed: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path, buffer);
}
