import { createHash } from "node:crypto";
import { readFile, readdir, access } from "node:fs/promises";
import { join, basename } from "node:path";
import type { DocPage } from "./chunk.js";

/** Fixed page order for the docs corpus when there is no llms.txt (v1). */
export const DOCS_PAGE_ORDER = [
  "index.mdx",
  "install.md",
  "quick-start.md",
  "command-reference.md",
  "troubleshooting.md",
  "changelog.md",
] as const;

/** Golden SHA-256 of the v1 full-mode corpus *string* (pre–docs-v2-loader fix). */
export const V1_FULL_CORPUS_SHA256 =
  "59c0e39eb467cdb6a53ff8e4a85f8b960b6b728038a243529dc3a378d7c1ae21";

/** Character length of that same v1 full-mode corpus string. */
export const V1_FULL_CORPUS_CHARS = 6476;

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
   * When true (default), include llms.txt when present (full mode).
   * Rag mode must pass false: llms.txt is full-mode only and is not BM25-indexed.
   * Frontmatter `description` is never loaded (stripFrontmatter keeps title + body only).
   */
  includeLlms?: boolean;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse markdown links `(file.md)` / `[text](file.md)` from llms.txt.
 * Returns relative filenames in document order (first occurrence wins).
 */
export function parseLlmsPageLinks(llmsText: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(llmsText)) !== null) {
    const target = m[1]!.trim();
    // Only local page links (reject URLs and path escapes).
    if (!target || target.includes("://") || target.startsWith("/")) continue;
    if (target.includes("..")) {
      throw new Error(`refuse: llms.txt link escapes directory: ${target}`);
    }
    const file = basename(target);
    if (!/\.(md|mdx)$/i.test(file)) continue;
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(file);
  }
  return out;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const names = await readdir(dir);
  return names.filter((n) => /\.md$/i.test(n)).sort();
}

/**
 * When docsContentDir contains llms.txt: load pages in llms.txt link order.
 * Validates every link resolves and every `.md` file in the directory is listed.
 * Full mode (includeLlms): llms.txt page first, then linked pages.
 * Rag mode: linked pages only (never indexes llms.txt).
 *
 * When there is no llms.txt: keep DOCS_PAGE_ORDER (v1) behaviour.
 */
export async function loadDocsPages(
  docsContentDir: string,
  docsRoot?: string,
  options: LoadPagesOptions = {},
): Promise<DocPage[]> {
  const includeLlms = options.includeLlms !== false;
  const llmsPath = join(docsContentDir, "llms.txt");

  if (await fileExists(llmsPath)) {
    const llmsRaw = await readFile(llmsPath, "utf8");
    const links = parseLlmsPageLinks(llmsRaw);
    if (links.length === 0) {
      throw new Error(`refuse: llms.txt in ${docsContentDir} lists no page links`);
    }

    const mdOnDisk = await listMarkdownFiles(docsContentDir);
    const listed = new Set(links);
    const unlisted = mdOnDisk.filter((f) => !listed.has(f));
    if (unlisted.length > 0) {
      throw new Error(
        `refuse: .md file(s) in ${docsContentDir} not listed in llms.txt: ${unlisted.join(", ")}`,
      );
    }
    for (const file of links) {
      const path = join(docsContentDir, file);
      if (!(await fileExists(path))) {
        throw new Error(`refuse: llms.txt link does not resolve: ${file}`);
      }
    }

    const pages: DocPage[] = [];
    for (const file of links) {
      const raw = await readFile(join(docsContentDir, file), "utf8");
      const { title, body } = stripFrontmatter(raw);
      pages.push({
        file,
        title: title || file,
        body: body.trim(),
      });
    }

    if (includeLlms) {
      return [
        {
          file: "llms.txt",
          title: "llms.txt",
          body: llmsRaw.trim(),
        },
        ...pages,
      ];
    }
    return pages;
  }

  // No llms.txt in content dir → v1-style fixed order (DOCS_PAGE_ORDER only).
  const pages: DocPage[] = [];
  for (const file of DOCS_PAGE_ORDER) {
    const path = join(docsContentDir, file);
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      continue;
    }
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

  // Optional llms.txt beside older layouts (docs root), appended for full mode only.
  const root = docsRoot ?? join(docsContentDir, "..", "..", "..");
  const tryLlms = async (candidate: string, already: boolean): Promise<boolean> => {
    if (already) return true;
    try {
      const llms = await readFile(candidate, "utf8");
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
 * With llms.txt in the content dir: llms.txt first, then linked pages.
 * Without: DOCS_PAGE_ORDER (+ optional root llms.txt append for legacy).
 * Byte-stable: same inputs → same corpus string (full mode depends on this).
 */
export async function loadDocsCorpus(docsContentDir: string, docsRoot?: string): Promise<string> {
  const pages = await loadDocsPages(docsContentDir, docsRoot, { includeLlms: true });
  const parts = pages.map((p) => `# ${p.title}\n\n${p.body}\n`);
  return parts.join("\n---\n\n");
}

/**
 * SHA-256 over sorted relative paths + file contents (UTF-8).
 * With llms.txt in content dir: hashes llms.txt + every linked page (all corpus files).
 * Without: DOCS_PAGE_ORDER files (+ optional root llms.txt).
 */
export async function hashDocsSources(
  docsContentDir: string,
  docsRoot?: string,
): Promise<string> {
  const files: LoadedDocFile[] = [];
  const llmsPath = join(docsContentDir, "llms.txt");

  if (await fileExists(llmsPath)) {
    const llmsRaw = await readFile(llmsPath, "utf8");
    const links = parseLlmsPageLinks(llmsRaw);
    const mdOnDisk = await listMarkdownFiles(docsContentDir);
    const listed = new Set(links);
    const unlisted = mdOnDisk.filter((f) => !listed.has(f));
    if (unlisted.length > 0) {
      throw new Error(
        `refuse: .md file(s) in ${docsContentDir} not listed in llms.txt: ${unlisted.join(", ")}`,
      );
    }
    for (const file of links) {
      const path = join(docsContentDir, file);
      if (!(await fileExists(path))) {
        throw new Error(`refuse: llms.txt link does not resolve: ${file}`);
      }
      const raw = await readFile(path, "utf8");
      files.push({ path, relativePath: file, raw });
    }
    files.push({ path: llmsPath, relativePath: "llms.txt", raw: llmsRaw });
  } else {
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
