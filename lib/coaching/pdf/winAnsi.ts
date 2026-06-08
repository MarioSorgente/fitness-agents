/**
 * Shared text encoding for the dependency-light PDF renderers.
 *
 * Both renderers (`renderMarkdownPdf.ts` and `renderPdf.tsx`) draw text with the Standard-14
 * Helvetica/Courier fonts declared with `/Encoding /WinAnsiEncoding`, and write the final buffer as
 * `latin1` (one byte per character). For that to render correctly, every drawn string must contain
 * only WinAnsi single-byte characters — otherwise glyphs come out as mojibake (and a stray
 * codepoint > 255 would desync the xref byte offsets). Keep both renderers using THESE helpers so
 * they stay in lockstep.
 */

// Common typographic characters → their WinAnsi byte (0x80–0x9F range). Page text can use these
// because the fonts declare WinAnsiEncoding.
const WINANSI: Record<string, string> = {
  "—": "\x97",
  "–": "\x96",
  "•": "\x95",
  "“": "\x93",
  "”": "\x94",
  "‘": "\x91",
  "’": "\x92",
  "…": "\x85",
  "™": "\x99",
  "€": "\x80",
};

/**
 * Make text safe to draw in a content stream: map typographic punctuation to WinAnsi bytes,
 * replace symbols we can't show with ASCII stand-ins, and drop anything still outside latin1
 * (emoji, combining marks) so the byte offsets stay exact.
 */
export function sanitizeWinAnsi(text: string): string {
  let out = text.replace(/[—–•“”‘’…™€]/g, (ch) => WINANSI[ch] ?? ch);
  out = out
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[⚠]️?/g, "(!)")
    .replace(/[✓✔]/g, "[x]")
    .replace(/[✕✗✘]/g, "x")
    .replace(/[○●◦‣·]/g, "-");
  out = Array.from(out)
    .map((ch) => ((ch.codePointAt(0) ?? 0) <= 255 ? ch : ""))
    .join("");
  return out;
}

/**
 * Make text safe for PDF document metadata (Info dictionary), which readers decode with
 * PDFDocEncoding — NOT the font's WinAnsiEncoding. So a WinAnsi C1 byte would show the wrong glyph
 * in the title bar (e.g. an em-dash rendering as "Š"). Reduce metadata to plain ASCII instead.
 */
export function sanitizeAscii(text: string): string {
  let out = text
    .replace(/[—–]/g, "-")
    .replace(/•/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/™/g, "(TM)")
    .replace(/€/g, "EUR")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/·/g, "-");
  out = Array.from(out)
    .map((ch) => ((ch.codePointAt(0) ?? 0) <= 127 ? ch : ""))
    .join("");
  return out;
}

/** Escape the three characters that are special inside a PDF literal `(...)` string. */
export function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
