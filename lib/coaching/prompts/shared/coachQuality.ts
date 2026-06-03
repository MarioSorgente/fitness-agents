/**
 * Shared quality bar for both plan writers (fitness + nutrition) and both their draft and
 * cross-challenge passes. Edit once to raise/lower the standard every plan is held to.
 */
export const COACH_QUALITY_RULES = [
  "QUALITY BAR:",
  "- Brief \"why\": after each key choice (the split, the calorie target, a flagged swap) add a short",
  "  plain-language reason in one clause, so the client learns as they read.",
  "- Be concrete — no placeholders or hedging (\"etc.\", \"as needed\", \"some\", \"a few\", \"varies as",
  "  appropriate\"). Give a real number or a named item every time; if unsure, pick a sensible",
  "  default and say so.",
  "- Adherence first: bias toward the simplest plan the client will actually follow given their",
  "  stated time, schedule, and struggles. Prefer a few high-impact moves over an exhaustive",
  "  program; when two options are similar, choose the one that is easier to sustain.",
].join("\n");
