/**
 * Shared quality bar for both plan writers (fitness + nutrition) and both their draft and
 * cross-challenge passes. Edit once to raise/lower the standard every plan is held to.
 */
export const COACH_QUALITY_RULES = [
  "QUALITY BAR:",
  "- Brief \"why\": after each key choice (the split, the calorie target, a flagged swap) add a short",
  "  plain-language reason in one clause, so the client learns as they read.",
  "- This is a PLAN, not a suggestion. Every instruction must be specific enough to act on today.",
  "  Never write vague guidance like \"eat more protein\", \"do some cardio\", or \"lift heavier\" —",
  "  give the exact number and a named example instead (e.g. \"hit 120 g protein/day, e.g. 200 g",
  "  chicken breast + 200 g Greek yogurt + 2 eggs\").",
  "- Be concrete — no placeholders or hedging (\"etc.\", \"as needed\", \"some\", \"a few\", \"varies as",
  "  appropriate\"). Give a real number or a named item every time; if unsure, pick a sensible",
  "  default and say so.",
  "- Category-aware: the plan must fit THIS client's sex and body composition (a plan for a smaller",
  "  woman is not a plan for a larger man). When authoritative calorie/macro targets are provided,",
  "  use them exactly — do not recompute or substitute generic numbers.",
  "- Adherence first: bias toward the simplest plan the client will actually follow given their",
  "  stated time, schedule, and struggles. Prefer a few high-impact moves over an exhaustive",
  "  program; when two options are similar, choose the one that is easier to sustain.",
].join("\n");
