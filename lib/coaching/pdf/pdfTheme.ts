export const pdfTheme = {
  page: {
    width: 612,
    height: 792,
    marginX: 40,
    marginTop: 44,
    marginBottom: 42,
  },
  colors: {
    ink: "172033",
    muted: "637083",
    primary: "224C9A",
  },
  fonts: {
    body: "Helvetica",
    bold: "Helvetica-Bold",
    mono: "Courier",
  },
  fontSizes: {
    eyebrow: 8,
    title: 24,
    heading: 15,
    subheading: 11,
    body: 10,
    small: 8,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18,
    xl: 28,
  },
} as const;

export type PdfFontName = (typeof pdfTheme.fonts)[keyof typeof pdfTheme.fonts];
export type PdfColor = (typeof pdfTheme.colors)[keyof typeof pdfTheme.colors];
