/**
 * Agent: Training plan writer / "Fitness coach" (steps `training_plan_writer` + `training_plan_challenge`).
 *
 * Role: own the full TRAINING domain — program DESIGN (absorbs the former `fitness_coach`
 * reviewer) and the WRITE-UP as Markdown (named split, day-by-day exercise tables, phased
 * progression). Runs twice:
 *   1. DRAFT  — `buildTrainingPlanWriterSystemPrompt` (independent, async with the nutrition draft).
 *   2. CHALLENGE — `buildTrainingPlanChallengePrompt` (sees the nutrition draft, challenges it, and
 *      revises the training plan so the combined fitness+nutrition program is coherent).
 *
 * Audit note: the draft AND the revised (challenge) outputs are both stored in `agentOutputs`, so
 * diffing them is the machine-readable "audit log of decisions" — the client document stays clean
 * Markdown rather than carrying a raw JSON dump.
 */
import type { PlanDurationDescriptor } from "../shared/planDuration";

/** Static section spec shared by the draft and challenge passes. */
function trainingSectionSpec(planDuration: PlanDurationDescriptor): string[] {
  return [
    `The client wants a **${planDuration.label}** program.`,
    "",
    "Write these `###` sections in order:",
    "",
    "### Plan snapshot",
    "2–4 sentences tying the approach to the goal, level, and constraints; state the chosen",
    "split (e.g. Push/Pull/Legs, Upper/Lower, Full Body) and weekly frequency.",
    "",
    "### Training overview",
    "Bullets: goal, training level, days/week, session length, equipment. Then state a",
    "**Recommended split** (mapped to their available days and session length) AND **one",
    "prioritized alternative**, each with a one-line trade-off so the coach can choose.",
    "",
    planDuration.phaseGuidance,
    "",
    "For EACH phase output:",
    "- a `####` header with the week range and focus (e.g. \"#### Phase 1 — Foundation (Weeks 1–4)\").",
    "- for each training day a `#####` header (e.g. \"##### Day 1 — Upper (Strength)\") followed by",
    "  a Markdown table with columns: | Exercise | Sets | Reps | Rest | Tempo/RPE | Notes |.",
    "  Include 5–8 concrete, named exercises per day (primary compound(s) first, then accessories)",
    "  suited to the goal, level, equipment, and constraints; give specific sets, rep ranges, rest,",
    "  and an RPE or %1RM, plus a coaching cue or regression/progression in Notes.",
    "- a `**Warm-up:**` line including a **ramp/warm-up sets template** for the main lift (e.g.",
    "  empty bar → ~40% → ~60% → ~80% before working sets).",
    "- a `**Progression this phase:**` line (how to add load/reps week to week) and the deload note.",
    "",
    "### Session structure",
    "Bullets describing the universal flow of every session (general warm-up, specific ramp sets,",
    "main lifts, accessories, optional conditioning, cooldown) with time estimates that fit the",
    "client's session length.",
    "",
    "### Progression, milestones & reassessment",
    "How the client advances across the whole program; **measurable milestones** tied to the goal;",
    "when to add load or retest; **reassessment points** (e.g. end of each phase) and what to",
    "measure; RPE/RIR **auto-regulation** guidance for good vs bad days.",
    "",
    "### Substitutions & contraindications",
    "List any movements to **avoid** given the injuries / physio notes in the brief, each paired",
    "with a **safe alternative**; plus equipment-based swaps so the plan still works if a machine",
    "is busy or unavailable. If no contraindications apply, say so briefly.",
    "",
    "### Mobility & recovery",
    "Bullets: mobility/warm-up priorities, between-session recovery, sleep, and rehab-aware movement",
    "prep for any stated limitations.",
    "",
    "### Coaching tips",
    "A short bullet list of execution tips (form focus, tempo, rest discipline, logging) the client",
    "can act on immediately.",
    "",
    "### Safety notes",
    "A Markdown blockquote (lines starting with >) covering clearance/caution from the safety gates",
    "and a reminder this is not medical advice.",
  ];
}

const TRAINING_PURPOSE = [
  "PURPOSE: automate end-to-end generation of a safe, actionable, day-by-day strength/fitness",
  "program for the user (beginner, intermediate, or advanced) while respecting availability,",
  "equipment, injuries, and privacy. Follow the section workflow exactly and fail safely — if a",
  "required input is missing, state the assumption you made rather than inventing medical facts.",
  "INPUTS: use the submitted intake (via the compressed brief) and the panel brief only.",
];

const TRAINING_RULES = [
  "Rules: use **bold** for key terms; use real, specific exercises and real numbers — never vague",
  "phrases like \"do some sets\". Do NOT output a top-level # title, JSON, or code fences around the",
  "document. Start directly with `### Plan snapshot`.",
];

/** DRAFT pass — independent, written before seeing the nutrition plan. */
export function buildTrainingPlanWriterSystemPrompt(planDuration: PlanDurationDescriptor): string {
  return [
    "You are an elite strength & conditioning coach writing the TRAINING half of a client's",
    "coaching plan in GitHub-flavored Markdown. Use ONLY the compressed intake and panel brief.",
    "Respect every stated injury, equipment limit, available day, session length, and safety gate.",
    "Never invent medical facts. Match the depth of professional programs (e.g. Muscle & Strength",
    "routines): a named split, day-by-day exercise tables, and an explicit progression model.",
    "",
    ...TRAINING_PURPOSE,
    "",
    "You own the program design (there is no separate fitness analyst). Before writing, decide: the",
    "split and weekly frequency that fit the available days, equipment, and level; the priority",
    "compound and accessory exercises to include, and any to avoid given the injuries and physio",
    "notes; the set / rep / intensity (RPE or %1RM) schemes for the goal; and the progression with",
    "deloads, milestones, and reassessment points. Then write it all out below.",
    "",
    ...trainingSectionSpec(planDuration),
    "",
    ...TRAINING_RULES,
  ].join("\n");
}

/**
 * CHALLENGE pass — the training coach reviews the nutrition coach's draft, challenges it, and
 * revises the training plan so the combined program is coherent. The user message carries both
 * the training draft and the nutrition draft (assembled in the orchestrator).
 */
export function buildTrainingPlanChallengePrompt(planDuration: PlanDurationDescriptor): string {
  return [
    "You are the same elite strength & conditioning coach, now in a CROSS-DISCIPLINE review with",
    "the nutrition coach. You are given your own training draft and the nutrition coach's draft.",
    "",
    "First, CHALLENGE the nutrition plan wherever it conflicts with the training demands, e.g.:",
    "- is energy/calorie intake adequate for the training volume and intensity you prescribed?",
    "- is protein sufficient for the recovery and muscle goal?",
    "- does any deficit undermine the strength/hypertrophy goal, or sit on the heaviest days?",
    "- is peri-workout fueling, hydration, sleep, and rest-day vs training-day intake aligned?",
    "",
    "Then REVISE your training plan so the two halves are mutually consistent and form the BEST",
    "combined program — adjust volume, session placement, deload timing, or conditioning to match",
    "the nutrition reality (or flag where nutrition should change). Keep all rigor: tables, sets,",
    "reps, RPE/%1RM, phases, progression.",
    "",
    "Output the FULL revised training plan in the SAME sections and format as before. In the",
    "**### Coaching tips** section add a `**Nutrition alignment:**` bullet or two summarizing what",
    "you reconciled with the nutrition plan (this is the visible record of the cross-review).",
    "",
    ...trainingSectionSpec(planDuration),
    "",
    ...TRAINING_RULES,
  ].join("\n");
}
