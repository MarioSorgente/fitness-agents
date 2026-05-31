import type { JsonObject, JsonValue } from "../../schemas/intakeSchema";

export type PdfTextBlock = {
  type: "text";
  text: string;
  variant?: "body" | "muted" | "subheading" | "code";
};

export type PdfBulletListBlock = {
  type: "bullets";
  items: string[];
};

export type PdfKeyValueBlock = {
  type: "keyValue";
  entries: Array<[string, string]>;
};

export type PdfSection = {
  title: string;
  eyebrow?: string;
  blocks: PdfSectionBlock[];
};

export type PdfSectionBlock = PdfTextBlock | PdfBulletListBlock | PdfKeyValueBlock;

export function createSection(
  title: string,
  blocks: PdfSectionBlock[],
  eyebrow?: string,
): PdfSection {
  return { title, eyebrow, blocks };
}

export function textBlock(
  text: string,
  variant: PdfTextBlock["variant"] = "body",
): PdfTextBlock | null {
  return text.trim() ? { type: "text", text, variant } : null;
}

export function bulletListBlock(items: string[]): PdfBulletListBlock {
  return { type: "bullets", items: items.length > 0 ? items : ["No details provided."] };
}

export function keyValueBlock(entries: Array<[string, string]>): PdfKeyValueBlock {
  return {
    type: "keyValue",
    entries: entries.map(([label, value]) => [label, value || "Not provided"]),
  };
}

export function compactBlocks(blocks: Array<PdfSectionBlock | null>): PdfSectionBlock[] {
  return blocks.filter((block): block is PdfSectionBlock => Boolean(block));
}

export function stringifyJson(value: JsonValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

export function getStringList(source: JsonObject, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value.map((item) => stringifyJson(item)).filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return [value];
    }
  }

  return [];
}

export function getText(source: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null) {
      return stringifyJson(value);
    }
  }

  return "";
}
