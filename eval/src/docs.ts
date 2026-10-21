import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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

/**
 * Load docs pages as plain markdown, concatenated in fixed order with titles.
 * Also appends llms.txt from the docs root if present.
 */
export async function loadDocsCorpus(docsContentDir: string, docsRoot?: string): Promise<string> {
  const parts: string[] = [];

  for (const file of DOCS_PAGE_ORDER) {
    const path = join(docsContentDir, file);
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      continue;
    }
    const { title, body } = stripFrontmatter(raw);
    parts.push(`# ${title || file}\n\n${body.trim()}\n`);
  }

  const root = docsRoot ?? join(docsContentDir, "..", "..", "..");
  try {
    const llms = await readFile(join(root, "llms.txt"), "utf8");
    parts.push(`# llms.txt\n\n${llms.trim()}\n`);
  } catch {
    // optional
  }

  // Also check docs/llms.txt
  try {
    const llms = await readFile(join(docsRoot ?? join(docsContentDir, "..", ".."), "llms.txt"), "utf8");
    if (!parts.some((p) => p.startsWith("# llms.txt"))) {
      parts.push(`# llms.txt\n\n${llms.trim()}\n`);
    }
  } catch {
    // optional
  }

  return parts.join("\n---\n\n");
}

/** Default content dir relative to repo root. */
export function defaultDocsContentDir(repoRoot: string): string {
  return join(repoRoot, "docs", "src", "content", "docs");
}

export async function listDocFiles(docsContentDir: string): Promise<string[]> {
  const names = await readdir(docsContentDir);
  return names.filter((n) => n.endsWith(".md") || n.endsWith(".mdx")).sort();
}
