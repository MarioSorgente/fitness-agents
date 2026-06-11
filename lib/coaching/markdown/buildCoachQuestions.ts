import { runRoutedCompletion } from "../ai/provider";
import { createDefaultProviderRegistry } from "../ai/registry";

/**
 * Generates a short "Questions for the coach to ask" section from a client's
 * intake summary using the cheap/fast provider route (Haiku · gpt-4.1-nano ·
 * Kimi, with fallback). This is a deliberately lightweight, single-call helper —
 * it does NOT run the full coaching agent pipeline. Facts in the summary are
 * never invented here; the model only surfaces follow-up questions.
 *
 * Always resolves: if no AI provider is configured/reachable it returns a
 * deterministic fallback section so the download still succeeds.
 */

const QUESTIONS_HEADING = "## Questions for the coach to ask";

const SYSTEM_PROMPT = `You are an assistant to an experienced fitness coach. You are given a client's intake summary. Produce the most useful follow-up questions the coach should ask the client before designing their program.

Focus on:
- Ambiguous or missing information that materially affects programming.
- Safety/medical flags — especially any PAR-Q or health item answered "yes" without a clear explanation.
- Conflicts or inconsistencies between answers (e.g. availability vs. preferred days, stated goal vs. nutrition/lifestyle).
- Goal clarity, motivation, and realistic expectations.

Rules:
- Output GitHub-flavored Markdown only.
- Start with this exact heading on its own line: "${QUESTIONS_HEADING}".
- Then a numbered list of 5-12 concise, specific questions, one per item.
- Do not restate the intake. Do not provide medical advice or diagnoses. Do not add any other sections or commentary.`;

function ensureHeading(content: string): string {
  const trimmed = content.trim();
  return /^##\s+questions for the coach/im.test(trimmed)
    ? trimmed
    : `${QUESTIONS_HEADING}\n\n${trimmed}`;
}

export async function buildCoachQuestionsSection(summaryMarkdown: string): Promise<string> {
  const providers = createDefaultProviderRegistry();

  try {
    const completion = await runRoutedCompletion(providers, "intake_compression", "production", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Client intake summary:\n\n${summaryMarkdown}` },
      ],
      temperature: 0.3,
      maxTokens: 900,
    });

    const content = completion.content.trim();
    return content
      ? ensureHeading(content)
      : fallbackSection("the model returned an empty response");
  } catch (error) {
    return fallbackSection(error instanceof Error ? error.message : "unknown error");
  }
}

function fallbackSection(reason: string): string {
  return [
    QUESTIONS_HEADING,
    "",
    `_Automatic question suggestions were unavailable (${reason}). Review the intake above and clarify: any blank fields, any health/PAR-Q "yes" answers without an explanation, reported pain or injuries, and whether the client's stated goal is realistic given their availability, lifestyle, and nutrition._`,
  ].join("\n");
}
