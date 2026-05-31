import type { CoachingPlan, PdfGenerationRequest } from "../schemas/coachingPlanSchema";
import { CoachingPlanPdf, type CoachingPlanPdfDocument } from "./CoachingPlanPdf";
import { pdfTheme, type PdfColor, type PdfFontName } from "./pdfTheme";
import type { PdfSection, PdfSectionBlock } from "./sections";

type PdfTextLine = {
  text: string;
  font: PdfFontName;
  size: number;
  color: PdfColor;
  spacingAfter: number;
};

type PdfPage = {
  lines: PdfTextLine[];
};

const FONT_RESOURCE_NAMES: Record<PdfFontName, string> = {
  [pdfTheme.fonts.body]: "F1",
  [pdfTheme.fonts.bold]: "F2",
  [pdfTheme.fonts.mono]: "F3",
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function textWidthEstimate(text: string, fontSize: number): number {
  return text.length * fontSize * 0.52;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const hardLines = text.split(/\r?\n/);
  const wrapped: string[] = [];

  for (const hardLine of hardLines) {
    const words = hardLine.split(/\s+/).filter(Boolean);
    let current = "";

    if (words.length === 0) {
      wrapped.push("");
      continue;
    }

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;

      if (textWidthEstimate(candidate, fontSize) <= maxWidth || !current) {
        current = candidate;
      } else {
        wrapped.push(current);
        current = word;
      }
    }

    if (current) {
      wrapped.push(current);
    }
  }

  return wrapped;
}

function addWrappedText(
  lines: PdfTextLine[],
  text: string,
  options: Omit<PdfTextLine, "text"> & { prefix?: string },
) {
  const maxWidth = pdfTheme.page.width - pdfTheme.page.marginX * 2;
  const wrapped = wrapText(`${options.prefix ?? ""}${text}`, options.size, maxWidth);

  wrapped.forEach((line, index) => {
    lines.push({
      text: line,
      font: options.font,
      size: options.size,
      color: options.color,
      spacingAfter: index === wrapped.length - 1 ? options.spacingAfter : 2,
    });
  });
}

function addBlock(lines: PdfTextLine[], block: PdfSectionBlock) {
  if (block.type === "text") {
    if (block.variant === "subheading") {
      addWrappedText(lines, block.text, {
        font: pdfTheme.fonts.bold,
        size: pdfTheme.fontSizes.subheading,
        color: pdfTheme.colors.ink,
        spacingAfter: pdfTheme.spacing.xs,
      });
      return;
    }

    if (block.variant === "code") {
      addWrappedText(lines, block.text, {
        font: pdfTheme.fonts.mono,
        size: pdfTheme.fontSizes.small,
        color: pdfTheme.colors.ink,
        spacingAfter: pdfTheme.spacing.sm,
      });
      return;
    }

    addWrappedText(lines, block.text, {
      font: pdfTheme.fonts.body,
      size: pdfTheme.fontSizes.body,
      color: block.variant === "muted" ? pdfTheme.colors.muted : pdfTheme.colors.ink,
      spacingAfter: pdfTheme.spacing.sm,
    });
    return;
  }

  if (block.type === "bullets") {
    for (const item of block.items) {
      addWrappedText(lines, item, {
        font: pdfTheme.fonts.body,
        size: pdfTheme.fontSizes.body,
        color: pdfTheme.colors.ink,
        prefix: "- ",
        spacingAfter: pdfTheme.spacing.xs,
      });
    }
    lines.push({
      text: "",
      font: pdfTheme.fonts.body,
      size: pdfTheme.fontSizes.body,
      color: pdfTheme.colors.ink,
      spacingAfter: pdfTheme.spacing.xs,
    });
    return;
  }

  for (const [label, value] of block.entries) {
    addWrappedText(lines, label.toUpperCase(), {
      font: pdfTheme.fonts.bold,
      size: pdfTheme.fontSizes.small,
      color: pdfTheme.colors.muted,
      spacingAfter: 1,
    });
    addWrappedText(lines, value, {
      font: pdfTheme.fonts.body,
      size: pdfTheme.fontSizes.body,
      color: pdfTheme.colors.ink,
      spacingAfter: pdfTheme.spacing.xs,
    });
  }
  lines.push({
    text: "",
    font: pdfTheme.fonts.body,
    size: pdfTheme.fontSizes.body,
    color: pdfTheme.colors.ink,
    spacingAfter: pdfTheme.spacing.xs,
  });
}

function sectionToLines(section: PdfSection, isCover: boolean): PdfTextLine[] {
  const lines: PdfTextLine[] = [];

  if (section.eyebrow) {
    addWrappedText(lines, section.eyebrow.toUpperCase(), {
      font: pdfTheme.fonts.bold,
      size: pdfTheme.fontSizes.eyebrow,
      color: pdfTheme.colors.primary,
      spacingAfter: pdfTheme.spacing.sm,
    });
  }

  addWrappedText(lines, section.title, {
    font: pdfTheme.fonts.bold,
    size: isCover ? pdfTheme.fontSizes.title : pdfTheme.fontSizes.heading,
    color: pdfTheme.colors.ink,
    spacingAfter: isCover ? pdfTheme.spacing.lg : pdfTheme.spacing.sm,
  });

  for (const block of section.blocks) {
    addBlock(lines, block);
  }

  lines.push({
    text: "",
    font: pdfTheme.fonts.body,
    size: pdfTheme.fontSizes.body,
    color: pdfTheme.colors.ink,
    spacingAfter: pdfTheme.spacing.lg,
  });

  return lines;
}

function paginate(document: CoachingPlanPdfDocument): PdfPage[] {
  const pages: PdfPage[] = [];
  let currentPage: PdfPage = { lines: [] };
  let currentY = pdfTheme.page.height - pdfTheme.page.marginTop;
  const minY = pdfTheme.page.marginBottom;

  document.sections.forEach((section, sectionIndex) => {
    const isCover = sectionIndex === 0;
    const sectionLines = sectionToLines(section, isCover);

    if (isCover) {
      pages.push({ lines: sectionLines });
      currentPage = { lines: [] };
      currentY = pdfTheme.page.height - pdfTheme.page.marginTop;
      return;
    }

    for (const line of sectionLines) {
      const lineHeight = line.size * 1.25 + line.spacingAfter;

      if (currentY - lineHeight < minY && currentPage.lines.length > 0) {
        pages.push(currentPage);
        currentPage = { lines: [] };
        currentY = pdfTheme.page.height - pdfTheme.page.marginTop;
      }

      currentPage.lines.push(line);
      currentY -= lineHeight;
    }
  });

  if (currentPage.lines.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function pageContentStream(page: PdfPage, pageNumber: number, pageCount: number): string {
  let y = pdfTheme.page.height - pdfTheme.page.marginTop;
  const x = pdfTheme.page.marginX;
  const chunks: string[] = [];

  for (const line of page.lines) {
    if (line.text) {
      const color = line.color.match(/.{2}/g)?.map((part) => parseInt(part, 16) / 255) ?? [0, 0, 0];
      chunks.push(
        "BT",
        `${color.map((part) => part.toFixed(3)).join(" ")} rg`,
        `/${FONT_RESOURCE_NAMES[line.font]} ${line.size} Tf`,
        `${x} ${y.toFixed(2)} Td`,
        `(${escapePdfText(line.text)}) Tj`,
        "ET",
      );
    }
    y -= line.size * 1.25 + line.spacingAfter;
  }

  chunks.push(
    "BT",
    "0.388 0.439 0.514 rg",
    `/${FONT_RESOURCE_NAMES[pdfTheme.fonts.body]} ${pdfTheme.fontSizes.small} Tf`,
    `${x} 24 Td`,
    `(Page ${pageNumber} of ${pageCount}) Tj`,
    "ET",
  );

  return chunks.join("\n");
}

function pdfStringObject(value: string): string {
  return `(${escapePdfText(value)})`;
}

function buildPdf(document: CoachingPlanPdfDocument): Buffer {
  const pages = paginate(document);
  const pageCount = pages.length;
  const objects: string[] = [];
  const catalogObjectId = 1;
  const pagesObjectId = 2;
  const fontObjectIds = {
    [pdfTheme.fonts.body]: 3,
    [pdfTheme.fonts.bold]: 4,
    [pdfTheme.fonts.mono]: 5,
  } satisfies Record<PdfFontName, number>;
  const infoObjectId = 6;
  const firstPageObjectId = 7;
  const firstContentObjectId = firstPageObjectId + pageCount;

  objects[catalogObjectId] = `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`;
  objects[fontObjectIds[pdfTheme.fonts.body]] =
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  objects[fontObjectIds[pdfTheme.fonts.bold]] =
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  objects[fontObjectIds[pdfTheme.fonts.mono]] =
    `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`;
  objects[infoObjectId] =
    `<< /Title ${pdfStringObject(document.title)} /Author ${pdfStringObject(document.author)} /Subject ${pdfStringObject(document.subject)} >>`;

  const kids: string[] = [];

  pages.forEach((page, index) => {
    const pageObjectId = firstPageObjectId + index;
    const contentObjectId = firstContentObjectId + index;
    const stream = pageContentStream(page, index + 1, pageCount);

    kids.push(`${pageObjectId} 0 R`);
    objects[pageObjectId] =
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pdfTheme.page.width} ${pdfTheme.page.height}] /Resources << /Font << /F1 ${fontObjectIds[pdfTheme.fonts.body]} 0 R /F2 ${fontObjectIds[pdfTheme.fonts.bold]} 0 R /F3 ${fontObjectIds[pdfTheme.fonts.mono]} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] =
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
  });

  objects[pagesObjectId] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  const parts = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(parts.join(""), "utf8");
    parts.push(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(parts.join(""), "utf8");
  parts.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);

  for (let id = 1; id < objects.length; id += 1) {
    parts.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }

  parts.push(
    `trailer\n<< /Size ${objects.length} /Root ${catalogObjectId} 0 R /Info ${infoObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(parts.join(""), "utf8");
}

export async function renderCoachingPlanPdf(
  plan: CoachingPlan,
  request: PdfGenerationRequest,
): Promise<Buffer> {
  return buildPdf(CoachingPlanPdf({ plan, request }));
}

export function coachingPlanPdfFilename(plan: CoachingPlan): string {
  const safePlanId = plan.id.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");

  return `coaching-plan-${safePlanId || "approved"}.pdf`;
}
