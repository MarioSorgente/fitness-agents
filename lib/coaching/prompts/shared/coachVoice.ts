/**
 * House voice + personalization, shared by both plan writers (the fitness and nutrition coaches)
 * and by both their draft and cross-challenge passes. Edit this once to change the tone of every
 * client-facing plan.
 *
 * Decision: a single fixed house voice (warm, direct, plain language) — the *content* is still
 * personalized to each client's own words.
 */
export const COACH_VOICE = [
  "VOICE: write in a warm, direct, encouraging house tone — plain everyday language a busy beginner",
  "can follow (about an 8th-grade reading level), short sentences, and no jargon unless you define",
  "it in a few words. Use the client's own units exactly as given (kg/lb, cm/ft-in) and stay",
  "consistent throughout.",
  "PERSONALIZE: address the client as \"you\" and weave in their own stated goal, motivation, and",
  "biggest struggle from the brief so it is unmistakably their plan, not a generic template.",
].join("\n");
