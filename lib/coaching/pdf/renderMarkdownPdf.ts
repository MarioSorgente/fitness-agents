import { marked, type Token, type Tokens } from "marked";

import { pdfTheme } from "./pdfTheme";
import { escapePdf, sanitizeAscii, sanitizeWinAnsi } from "./winAnsi";

/**
 * Render a Markdown document to a polished PDF using the project's
 * dependency-light PDF assembly (no headless browser). Supports headings,
 * paragraphs with inline bold/italic/code, ordered + unordered lists (nested),
 * blockquotes, horizontal rules, and tables.
 */

type SpanStyle = { bold?: boolean; italic?: boolean; mono?: boolean };
type Span = { text: string } & SpanStyle;

type Line =
  | {
      kind: "text";
      spans: Span[];
      size: number;
      color: string;
      spacingAfter: number;
      indent: number;
      leftBar?: boolean;
    }
  | { kind: "rule"; spacingAfter: number }
  | {
      kind: "columns";
      cells: Span[][];
      widths: number[];
      size: number;
      color: string;
      spacingAfter: number;
      header?: boolean;
    };

type PdfMeta = { title?: string; author?: string; subject?: string };

const PAGE = pdfTheme.page;
const COLORS = pdfTheme.colors;
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

const SIZE = {
  h1: 22,
  h2: 15,
  h3: 12,
  body: 10.5,
  table: 9.5,
  small: 8,
} as const;

const FONT_RESOURCE: Record<string, string> = {
  regular: "F1",
  bold: "F2",
  mono: "F3",
  italic: "F4",
  boldItalic: "F5",
};

function fontKey(style: SpanStyle): string {
  if (style.mono) return "mono";
  if (style.bold && style.italic) return "boldItalic";
  if (style.bold) return "bold";
  if (style.italic) return "italic";
  return "regular";
}

// Text encoding (sanitizeWinAnsi / sanitizeAscii / escapePdf) is shared via ./winAnsi so this
// renderer and the structured renderer stay in lockstep.

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function widthOf(text: string, size: number, mono: boolean): number {
  return text.length * size * (mono ? 0.6 : 0.5);
}

function colorToRg(hex: string): string {
  const parts = hex.match(/.{2}/g)?.map((p) => (parseInt(p, 16) / 255).toFixed(3)) ?? ["0", "0", "0"];
  return parts.join(" ");
}

// ── Inline tokens → styled spans ───────────────────────────────────────────────
function inlineSpans(tokens: Token[] | undefined, style: SpanStyle): Span[] {
  if (!tokens) return [];
  const spans: Span[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        if (t.tokens?.length) {
          spans.push(...inlineSpans(t.tokens, style));
        } else {
          spans.push({ text: decodeEntities(t.text), ...style });
        }
        break;
      }
      case "strong":
        spans.push(...inlineSpans((token as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        spans.push(...inlineSpans((token as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case "codespan":
        spans.push({ text: decodeEntities((token as Tokens.Codespan).text), ...style, mono: true });
        break;
      case "link":
        spans.push(...inlineSpans((token as Tokens.Link).tokens, style));
        break;
      case "del":
        spans.push(...inlineSpans((token as Tokens.Del).tokens, style));
        break;
      case "br":
        break;
      case "escape":
        spans.push({ text: (token as Tokens.Escape).text, ...style });
        break;
      default: {
        const raw = (token as { text?: string }).text;
        if (raw) spans.push({ text: decodeEntities(raw), ...style });
      }
    }
  }

  return spans;
}

// ── Wrapping spans to a width, preserving styles ──────────────────────────────
function wrapSpans(spans: Span[], size: number, maxWidth: number): Span[][] {
  const lines: Span[][] = [];
  let current: Span[] = [];
  let currentWidth = 0;
  const spaceWidth = widthOf(" ", size, false);

  // Punctuation that should hug the preceding word rather than gain a space when it
  // begins a new inline span (e.g. a comma right after **bold** text).
  const noSpaceBefore = /^[,.;:!?)\]}%'"”’»…]/;

  for (const span of spans) {
    const words = span.text.split(/\s+/).filter((w) => w.length > 0);
    words.forEach((word, wordIndex) => {
      const wordWidth = widthOf(word, size, Boolean(span.mono));
      // The first word of a non-leading span has no source whitespace before it; only
      // add a joining space when this word isn't leading punctuation.
      const attach = wordIndex === 0 && noSpaceBefore.test(word);
      const lead = current.length > 0 && !attach ? spaceWidth : 0;
      if (current.length > 0 && currentWidth + lead + wordWidth > maxWidth) {
        lines.push(current);
        current = [];
        currentWidth = 0;
      }
      const prefix = current.length > 0 && !attach ? " " : "";
      current.push({ ...span, text: `${prefix}${word}` });
      currentWidth += (current.length > 1 && !attach ? spaceWidth : 0) + wordWidth;
    });
  }

  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [[{ text: "" }]];
}

// ── Layout: tokens → flat, pre-wrapped lines ──────────────────────────────────
function pushParagraph(
  out: Line[],
  spans: Span[],
  size: number,
  color: string,
  spacingAfter: number,
  indent: number,
  leftBar?: boolean,
) {
  const wrapped = wrapSpans(spans, size, CONTENT_WIDTH - indent);
  wrapped.forEach((lineSpans, index) => {
    out.push({
      kind: "text",
      spans: lineSpans,
      size,
      color,
      indent,
      leftBar,
      spacingAfter: index === wrapped.length - 1 ? spacingAfter : 1,
    });
  });
}

function layoutList(list: Tokens.List, out: Line[], depth: number) {
  list.items.forEach((item, index) => {
    const marker = list.ordered ? `${(Number(list.start) || 1) + index}.` : "•";
    const indent = 14 + depth * 16;
    const markerSpan: Span = { text: `${marker} ` };

    const childLists: Tokens.List[] = [];
    const inline: Span[] = [];
    for (const child of item.tokens ?? []) {
      if (child.type === "list") {
        childLists.push(child as Tokens.List);
      } else if (child.type === "text" || child.type === "paragraph") {
        const t = child as Tokens.Text | Tokens.Paragraph;
        if (t.tokens?.length) {
          inline.push(...inlineSpans(t.tokens, {}));
        } else if ("text" in t && t.text) {
          inline.push({ text: decodeEntities(t.text) });
        }
      }
    }

    pushParagraph(out, [markerSpan, ...inline], SIZE.body, COLORS.ink, 3, indent);
    for (const childList of childLists) {
      layoutList(childList, out, depth + 1);
    }
  });
  out.push({ kind: "text", spans: [{ text: "" }], size: 4, color: COLORS.ink, indent: 0, spacingAfter: 4 });
}

function layoutTable(table: Tokens.Table, out: Line[]) {
  const columns = table.header.length || 1;
  const colWidth = CONTENT_WIDTH / columns;
  const widths = Array.from({ length: columns }, () => colWidth);

  const renderRow = (cells: Tokens.TableCell[], header: boolean) => {
    const cellSpans = cells.map((cell) => inlineSpans(cell.tokens, header ? { bold: true } : {}));
    const wrappedCells = cellSpans.map((spans) => wrapSpans(spans, SIZE.table, colWidth - 8));
    const rowHeight = Math.max(1, ...wrappedCells.map((w) => w.length));

    for (let lineIndex = 0; lineIndex < rowHeight; lineIndex += 1) {
      out.push({
        kind: "columns",
        cells: wrappedCells.map((cellLines) => cellLines[lineIndex] ?? [{ text: "" }]),
        widths,
        size: SIZE.table,
        color: COLORS.ink,
        spacingAfter: lineIndex === rowHeight - 1 ? 3 : 1,
        header,
      });
    }
  };

  renderRow(table.header, true);
  out.push({ kind: "rule", spacingAfter: 3 });
  for (const row of table.rows) {
    renderRow(row, false);
  }
  out.push({ kind: "text", spans: [{ text: "" }], size: 4, color: COLORS.ink, indent: 0, spacingAfter: 4 });
}

function layout(tokens: Token[]): Line[] {
  const out: Line[] = [];

  tokens.forEach((token, index) => {
    switch (token.type) {
      case "heading": {
        const h = token as Tokens.Heading;
        const spans = inlineSpans(h.tokens, { bold: true });
        if (index > 0) {
          const gap = h.depth <= 2 ? 10 : 6;
          out.push({ kind: "text", spans: [{ text: "" }], size: gap, color: COLORS.ink, indent: 0, spacingAfter: 0 });
        }
        const size = h.depth === 1 ? SIZE.h1 : h.depth === 2 ? SIZE.h2 : SIZE.h3;
        const color = h.depth === 1 ? COLORS.ink : h.depth === 2 ? COLORS.primary : COLORS.ink;
        pushParagraph(out, spans, size, color, h.depth <= 2 ? 8 : 5, 0);
        if (h.depth === 1) out.push({ kind: "rule", spacingAfter: 8 });
        break;
      }
      case "paragraph": {
        const p = token as Tokens.Paragraph;
        pushParagraph(out, inlineSpans(p.tokens, {}), SIZE.body, COLORS.ink, 7, 0);
        break;
      }
      case "list":
        layoutList(token as Tokens.List, out, 0);
        break;
      case "blockquote": {
        const bq = token as Tokens.Blockquote;
        const inner = layout(bq.tokens);
        for (const line of inner) {
          if (line.kind === "text") {
            out.push({ ...line, color: COLORS.muted, indent: line.indent + 14, leftBar: true });
          } else {
            out.push(line);
          }
        }
        out.push({ kind: "text", spans: [{ text: "" }], size: 4, color: COLORS.ink, indent: 0, spacingAfter: 4 });
        break;
      }
      case "code": {
        const c = token as Tokens.Code;
        for (const raw of c.text.split("\n")) {
          pushParagraph(out, [{ text: raw || " ", mono: true }], SIZE.small, COLORS.muted, 1, 14);
        }
        out.push({ kind: "text", spans: [{ text: "" }], size: 4, color: COLORS.ink, indent: 0, spacingAfter: 4 });
        break;
      }
      case "table":
        layoutTable(token as Tokens.Table, out);
        break;
      case "hr":
        out.push({ kind: "rule", spacingAfter: 8 });
        break;
      case "space":
        break;
      default:
        break;
    }
  });

  return out;
}

// ── Pagination ────────────────────────────────────────────────────────────────
function lineHeight(line: Line): number {
  if (line.kind === "rule") return 6 + line.spacingAfter;
  return line.size * 1.34 + line.spacingAfter;
}

function paginate(lines: Line[]): Line[][] {
  const pages: Line[][] = [];
  let page: Line[] = [];
  let y = PAGE.height - PAGE.marginTop;

  for (const line of lines) {
    const height = lineHeight(line);
    if (y - height < PAGE.marginBottom && page.length > 0) {
      pages.push(page);
      page = [];
      y = PAGE.height - PAGE.marginTop;
    }
    // Skip a leading empty spacer at the very top of a page.
    if (page.length === 0 && line.kind === "text" && line.spans.every((s) => !s.text.trim())) {
      continue;
    }
    page.push(line);
    y -= height;
  }

  if (page.length > 0) pages.push(page);
  return pages.length > 0 ? pages : [[]];
}

// ── Content stream rendering ──────────────────────────────────────────────────
function drawSpans(chunks: string[], spans: Span[], x: number, y: number, size: number, color: string) {
  const visible = spans.filter((s) => s.text.length > 0);
  if (visible.length === 0) return;
  chunks.push("BT", `${colorToRg(color)} rg`, `${x.toFixed(2)} ${y.toFixed(2)} Td`);
  let lastFont = "";
  for (const span of visible) {
    const font = FONT_RESOURCE[fontKey(span)];
    if (font !== lastFont) {
      chunks.push(`/${font} ${size} Tf`);
      lastFont = font;
    }
    chunks.push(`(${escapePdf(sanitizeWinAnsi(span.text))}) Tj`);
  }
  chunks.push("ET");
}

function pageStream(page: Line[], pageNumber: number, pageCount: number): string {
  const chunks: string[] = [];
  let y = PAGE.height - PAGE.marginTop;

  for (const line of page) {
    const height = lineHeight(line);
    const baseline = y - (line.kind === "rule" ? 0 : line.size);

    if (line.kind === "rule") {
      const ruleY = y - 3;
      chunks.push(
        "q",
        "0.8 w",
        `${colorToRg(COLORS.muted)} RG`,
        `${PAGE.marginX} ${ruleY.toFixed(2)} m`,
        `${(PAGE.width - PAGE.marginX).toFixed(2)} ${ruleY.toFixed(2)} l`,
        "S",
        "Q",
      );
    } else if (line.kind === "columns") {
      let x = PAGE.marginX;
      line.cells.forEach((cellSpans, columnIndex) => {
        drawSpans(chunks, cellSpans, x + 2, baseline, line.size, line.color);
        x += line.widths[columnIndex] ?? 0;
      });
    } else {
      const x = PAGE.marginX + line.indent;
      if (line.leftBar) {
        chunks.push(
          "q",
          `${colorToRg(COLORS.primary)} rg`,
          `${(PAGE.marginX + line.indent - 8).toFixed(2)} ${(baseline - 1).toFixed(2)} 2 ${(line.size + 2).toFixed(2)} re`,
          "f",
          "Q",
        );
      }
      drawSpans(chunks, line.spans, x, baseline, line.size, line.color);
    }

    y -= height;
  }

  // Footer
  chunks.push(
    "BT",
    `${colorToRg(COLORS.muted)} rg`,
    `/F1 ${SIZE.small} Tf`,
    `${PAGE.marginX} 24 Td`,
    `(${escapePdf(`Page ${pageNumber} of ${pageCount}`)}) Tj`,
    "ET",
  );

  return chunks.join("\n");
}

// ── PDF object assembly ───────────────────────────────────────────────────────
// Document metadata (Info dict) is decoded with PDFDocEncoding, not the font's WinAnsiEncoding,
// so reduce it to ASCII to avoid wrong glyphs (e.g. an em-dash showing as "Š") in the title bar.
function pdfString(value: string): string {
  return `(${escapePdf(sanitizeAscii(value))})`;
}

function buildPdf(pages: Line[][], meta: Required<PdfMeta>): Buffer {
  const pageCount = pages.length;
  const objects: string[] = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontIds = { regular: 3, bold: 4, mono: 5, italic: 6, boldItalic: 7 };
  const infoId = 8;
  const firstPageId = 9;
  const firstContentId = firstPageId + pageCount;

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  const font = (base: string) =>
    `<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`;
  objects[fontIds.regular] = font("Helvetica");
  objects[fontIds.bold] = font("Helvetica-Bold");
  objects[fontIds.mono] = font("Courier");
  objects[fontIds.italic] = font("Helvetica-Oblique");
  objects[fontIds.boldItalic] = font("Helvetica-BoldOblique");
  objects[infoId] =
    `<< /Title ${pdfString(meta.title)} /Author ${pdfString(meta.author)} /Subject ${pdfString(meta.subject)} >>`;

  const resources =
    `/Resources << /Font << /F1 ${fontIds.regular} 0 R /F2 ${fontIds.bold} 0 R ` +
    `/F3 ${fontIds.mono} 0 R /F4 ${fontIds.italic} 0 R /F5 ${fontIds.boldItalic} 0 R >> >>`;

  const kids: string[] = [];
  pages.forEach((page, index) => {
    const pageId = firstPageId + index;
    const contentId = firstContentId + index;
    const stream = pageStream(page, index + 1, pageCount);

    kids.push(`${pageId} 0 R`);
    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ${resources} /Contents ${contentId} 0 R >>`;
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  objects[pagesId] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>`;

  const parts = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(parts.join(""), "latin1");
    parts.push(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(parts.join(""), "latin1");
  parts.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < objects.length; id += 1) {
    parts.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(
    `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(parts.join(""), "latin1");
}

function deriveTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Coaching document";
}

export function renderMarkdownPdf(markdown: string, meta: PdfMeta = {}): Buffer {
  const tokens = marked.lexer(markdown);
  const lines = layout(tokens);
  const pages = paginate(lines);

  return buildPdf(pages, {
    title: meta.title ?? deriveTitle(markdown),
    author: meta.author ?? "Fitness Agents",
    subject: meta.subject ?? "Coaching document",
  });
}

export function markdownPdfFilename(planId: string | undefined): string {
  const safe = (planId ?? "document").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
  return `coaching-document-${safe || "document"}.pdf`;
}
