/** Heading-based doc chunking for rag context mode. */

export type DocPage = {
  /** Source filename, e.g. command-reference.md */
  file: string;
  /** Page title from frontmatter (or file name). */
  title: string;
  /** Body after frontmatter strip (no leading # title line). */
  body: string;
};

export type DocChunk = {
  id: string;
  pageTitle: string;
  headingPath: string;
  /** Display prefix: "<page title>" or "<page title> > <heading path>". */
  prefix: string;
  text: string;
};

const HEADING_RE = /^(#{2,3})\s+(.+?)\s*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "section";
}

export function pageSlug(file: string): string {
  return slugify(file.replace(/\.(md|mdx)$/i, ""));
}

/**
 * Split one page by ## / ###.
 * - No ##/### → one chunk (entire body under page title).
 * - Content before first heading → chunk for the page title.
 */
export function chunkPage(page: DocPage): DocChunk[] {
  const pageId = pageSlug(page.file);
  const lines = page.body.replace(/\r\n/g, "\n").split("\n");
  const hasHeading = lines.some((l) => HEADING_RE.test(l));

  if (!hasHeading) {
    const text = page.body.trim();
    return [
      {
        id: pageId,
        pageTitle: page.title,
        headingPath: "",
        prefix: page.title,
        text,
      },
    ];
  }

  type Seg = { level: number; heading: string; lines: string[] };
  const segs: Seg[] = [{ level: 0, heading: "", lines: [] }];
  let h2 = "";

  for (const line of lines) {
    const m = HEADING_RE.exec(line);
    if (m) {
      const level = m[1]!.length;
      const heading = m[2]!.trim();
      if (level === 2) h2 = heading;
      segs.push({ level, heading, lines: [] });
      continue;
    }
    segs[segs.length - 1]!.lines.push(line);
  }

  const chunks: DocChunk[] = [];
  let h2ForPath = "";

  for (const seg of segs) {
    const body = seg.lines.join("\n").trim();
    if (seg.level === 0) {
      if (!body) continue;
      chunks.push({
        id: `${pageId}--intro`,
        pageTitle: page.title,
        headingPath: "",
        prefix: page.title,
        text: body,
      });
      continue;
    }
    if (seg.level === 2) h2ForPath = seg.heading;
    const headingPath =
      seg.level === 2
        ? seg.heading
        : h2ForPath
          ? `${h2ForPath} > ${seg.heading}`
          : seg.heading;
    const id =
      seg.level === 2
        ? `${pageId}--${slugify(seg.heading)}`
        : `${pageId}--${slugify(h2ForPath || "section")}--${slugify(seg.heading)}`;
    chunks.push({
      id,
      pageTitle: page.title,
      headingPath,
      prefix: `${page.title} > ${headingPath}`,
      text: body,
    });
  }

  return chunks;
}

export function chunkPages(pages: DocPage[]): DocChunk[] {
  return pages.flatMap(chunkPage);
}
