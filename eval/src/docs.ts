import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DocPage } from "./chunk.js";

/** Fixed page order for the docs corpus (v1). */
export const DOCS_PAGE_ORDER = [
  "index.mdx",
  "install.md",
  "quick-start.md",
  "command-reference.md",
  "troubleshooting.md",
  "changelog.md",
] as const;

function stripFrontmatter(src: string): { title: string; body: string } {
  if (!src.startsWith("---")) {
    return { title: "", body: src };
  }
  const end = src.indexOf("\n---", 3);
  if (end === -1) {
    return { title: "", body: src };
  }
  const fm = src.slice(3, end).trim();
  const body = src.slice(end + 4).replace(/^\s*\n/, "");
  const titleMatch = /^title:\s*(.+)$/m.exec(fm);
  const title = titleMatch ? titleMatch[1]!.trim() : "";
  return { title, body };
}

export type LoadedDocFile = {
  path: string;
  relativePath: string;
  raw: string;
};

export type LoadPagesOptions = {
  /**
   * When true (default), append llms.txt if present.
   * Rag mode must pass false: llms.txt is full-mode only and is not BM25-indexed.
   * Frontmatter `description` is never loaded (stripFrontmatter keeps title + body only).
   */
  includeLlms?: boolean;
};

/**
 * Load ordered doc pages (same sources as full-mode corpus).
 * Does not concatenate — use loadDocsCorpus for the byte-stable full string.
 */
export async function loadDocsPages(
  docsContentDir: string,
  docsRoot?: string,
  options: LoadPagesOptions = {},
): Promise<DocPage[]> {
  const includeLlms = options.includeLlms !== false;
  const pages: DocPage[] = [];

  for (const file of DOCS_PAGE_ORDER) {
    const path = join(docsContentDir, file);
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      continue;
    }
    // title only from frontmatter; description and other FM fields are dropped.
    const { title, body } = stripFrontmatter(raw);
    pages.push({
      file,
      title: title || file,
      body: body.trim(),
    });
  }

  if (!includeLlms) {
    return pages;
  }

  const root = docsRoot ?? join(docsContentDir, "..", "..", "..");
  const tryLlms = async (llmsPath: string, already: boolean): Promise<boolean> => {
    if (already) return true;
    try {
      const llms = await readFile(llmsPath, "utf8");
      pages.push({
        file: "llms.txt",
        title: "llms.txt",
        body: llms.trim(),
      });
      return true;
    } catch {
      return false;
    }
  };

  let haveLlms = false;
  haveLlms = await tryLlms(join(root, "llms.txt"), haveLlms);
  haveLlms = await tryLlms(
    join(docsRoot ?? join(docsContentDir, "..", ".."), "llms.txt"),
    haveLlms,
  );
  void haveLlms;

  return pages;
}

/**
 * Load docs pages as plain markdown, concatenated in fixed order with titles.
 * Also appends llms.txt from the docs root if present.
 * Byte-stable: same inputs → same corpus string (full mode depends on this).
 */
export async function loadDocsCorpus(docsContentDir: string, docsRoot?: string): Promise<string> {
  const pages = await loadDocsPages(docsContentDir, docsRoot, { includeLlms: true });
  const parts = pages.map((p) => `# ${p.title}\n\n${p.body}\n`);
  return parts.join("\n---\n\n");
}

/**
 * SHA-256 over sorted relative paths + file contents (UTF-8).
 * Used for results provenance; does not print retrieval hits.
 */
export async function hashDocsSources(
  docsContentDir: string,
  docsRoot?: string,
): Promise<string> {
  const files: LoadedDocFile[] = [];
  for (const file of DOCS_PAGE_ORDER) {
    const path = join(docsContentDir, file);
    try {
      const raw = await readFile(path, "utf8");
      files.push({ path, relativePath: file, raw });
    } catch {
      // skip missing
    }
  }
  const root = docsRoot ?? join(docsContentDir, "..", "..", "..");
  for (const candidate of [
    join(root, "llms.txt"),
    join(docsRoot ?? join(docsContentDir, "..", ".."), "llms.txt"),
  ]) {
    try {
      const raw = await readFile(candidate, "utf8");
      if (!files.some((f) => f.relativePath === "llms.txt")) {
        files.push({ path: candidate, relativePath: "llms.txt", raw });
      }
      break;
    } catch {
      // optional
    }
  }
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f.relativePath);
    h.update("\0");
    h.update(f.raw);
    h.update("\0");
  }
  return h.digest("hex");
}

/** Default content dir relative to repo root. */
export function defaultDocsContentDir(repoRoot: string): string {
  return join(repoRoot, "docs", "src", "content", "docs");
}

export async function listDocFiles(docsContentDir: string): Promise<string[]> {
  const names = await readdir(docsContentDir);
  return names.filter((n) => n.endsWith(".md") || n.endsWith(".mdx")).sort();
}
