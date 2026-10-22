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
const FENCE_OPEN_RE = /^(```|~~~)/;

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

/** True when line opens or closes a ``` / ~~~ fence (marker from opener). */
function fenceToggle(line: string, openMarker: string | null): string | null {
  const m = FENCE_OPEN_RE.exec(line);
  if (!m) return openMarker;
  const marker = m[1]!;
  if (openMarker === null) return marker;
  // Closer: same fence character sequence at line start.
  if (line.startsWith(openMarker)) return null;
  return openMarker;
}

/**
 * Split one page by ## / ### outside fenced code blocks.
 * - Headings inside ``` / ~~~ fences are ignored.
 * - No ##/### → one chunk (entire body under page title).
 * - Content before first heading → chunk for the page title.
 */
export function chunkPage(page: DocPage): DocChunk[] {
  const pageId = pageSlug(page.file);
  const lines = page.body.replace(/\r\n/g, "\n").split("\n");

  let fence: string | null = null;
  let sawHeading = false;
  for (const l of lines) {
    const before = fence;
    fence = fenceToggle(l, fence);
    if (before !== null || (before === null && fence !== null)) {
      // opener, inside, or closer — not a real heading line
      continue;
    }
    if (HEADING_RE.test(l)) {
      sawHeading = true;
      break;
    }
  }

  if (!sawHeading) {
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
  fence = null;

  for (const line of lines) {
    const before = fence;
    fence = fenceToggle(line, fence);
    if (before !== null || (before === null && fence !== null)) {
      // Inside fence (including opener/closer lines): never treat as heading.
      segs[segs.length - 1]!.lines.push(line);
      continue;
    }
    const m = HEADING_RE.exec(line);
    if (m) {
      const level = m[1]!.length;
      const heading = m[2]!.trim();
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

/** First id unchanged; later duplicates become id-2, id-3, … in document order. */
export function uniquifyChunkIds(chunks: DocChunk[]): DocChunk[] {
  const counts = new Map<string, number>();
  return chunks.map((c) => {
    const n = (counts.get(c.id) ?? 0) + 1;
    counts.set(c.id, n);
    if (n === 1) return c;
    return { ...c, id: `${c.id}-${n}` };
  });
}

export function chunkPages(pages: DocPage[]): DocChunk[] {
  return uniquifyChunkIds(pages.flatMap(chunkPage));
}
