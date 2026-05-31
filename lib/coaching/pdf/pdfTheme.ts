import { StyleSheet } from "@react-pdf/renderer";

export const pdfTheme = {
  colors: {
    ink: "#172033",
    muted: "#637083",
    border: "#D9E1EA",
    panel: "#F4F7FB",
    primary: "#224C9A",
    primarySoft: "#E8EEF9",
    success: "#1D6F42",
  },
  fontFamilies: {
    body: "Helvetica",
    bold: "Helvetica-Bold",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18,
    xl: 28,
  },
} as const;

export const pdfStyles = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingVertical: 36,
    fontFamily: pdfTheme.fontFamilies.body,
    fontSize: 10.5,
    color: pdfTheme.colors.ink,
    lineHeight: 1.45,
  },
  coverPage: {
    paddingHorizontal: 44,
    paddingVertical: 48,
    fontFamily: pdfTheme.fontFamilies.body,
    fontSize: 11,
    color: pdfTheme.colors.ink,
    lineHeight: 1.45,
  },
  section: {
    marginBottom: pdfTheme.spacing.lg,
  },
  panel: {
    backgroundColor: pdfTheme.colors.panel,
    borderColor: pdfTheme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: pdfTheme.spacing.md,
    marginBottom: pdfTheme.spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: pdfTheme.spacing.sm,
  },
  column: {
    flexDirection: "column",
  },
  eyebrow: {
    color: pdfTheme.colors.primary,
    fontFamily: pdfTheme.fontFamilies.bold,
    fontSize: 8,
    letterSpacing: 1.1,
    marginBottom: pdfTheme.spacing.xs,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: pdfTheme.fontFamilies.bold,
    fontSize: 26,
    lineHeight: 1.15,
    marginBottom: pdfTheme.spacing.sm,
  },
  heading: {
    fontFamily: pdfTheme.fontFamilies.bold,
    fontSize: 16,
    marginBottom: pdfTheme.spacing.sm,
  },
  subheading: {
    fontFamily: pdfTheme.fontFamilies.bold,
    fontSize: 12,
    marginBottom: pdfTheme.spacing.xs,
  },
  body: {
    marginBottom: pdfTheme.spacing.xs,
  },
  muted: {
    color: pdfTheme.colors.muted,
  },
  list: {
    marginTop: pdfTheme.spacing.xs,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bullet: {
    color: pdfTheme.colors.primary,
    width: 12,
  },
  listItemText: {
    flex: 1,
  },
  divider: {
    borderBottomColor: pdfTheme.colors.border,
    borderBottomWidth: 1,
    marginBottom: pdfTheme.spacing.md,
    marginTop: pdfTheme.spacing.sm,
  },
  smallCaps: {
    color: pdfTheme.colors.muted,
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  codeBlock: {
    backgroundColor: "#F8FAFC",
    borderColor: pdfTheme.colors.border,
    borderRadius: 6,
    borderWidth: 1,
    fontFamily: "Courier",
    fontSize: 8,
    lineHeight: 1.3,
    padding: pdfTheme.spacing.sm,
  },
  footer: {
    bottom: 20,
    color: pdfTheme.colors.muted,
    fontSize: 8,
    left: 40,
    position: "absolute",
    right: 40,
  },
});
