/**
 * PDF regression guard (no test runner is configured, so run this directly):
 *
 *   npx tsx scripts/check-pdf.ts
 *
 * Renders both PDF paths — the admin Markdown path (`renderMarkdownPdf`) and the structured
 * thank-you path (`renderCoachingPlanPdf`) — from realistic content that includes tables, em-dashes,
 * emoji, and a blockquote, then asserts each output is a structurally valid PDF: the xref offsets
 * point at their objects, every stream `/Length` matches, `startxref` points at `xref`, and the file
 * ends with `%%EOF`. Exits non-zero on any problem so a future edit (e.g. reverting to utf8) fails
 * loudly instead of silently shipping corrupt PDFs.
 */
import { sampleIntakeFormData } from "../lib/coaching/form/sampleIntake";
import { assemblePlanDocument } from "../lib/coaching/markdown/buildPlanDocument";
import { renderMarkdownPdf } from "../lib/coaching/pdf/renderMarkdownPdf";
import { renderCoachingPlanPdf } from "../lib/coaching/pdf/renderPdf";
import {
  coachingPlanSchema,
  type PdfGenerationRequest,
} from "../lib/coaching/schemas/coachingPlanSchema";
import { coachingIntakeSchema } from "../lib/coaching/schemas/intakeSchema";

function validatePdf(buffer: Buffer): string[] {
  const problems: string[] = [];
  const latin1 = buffer.toString("latin1");

  if (!latin1.startsWith("%PDF-")) problems.push("missing %PDF- header");
  if (!latin1.trimEnd().endsWith("%%EOF")) problems.push("does not end with %%EOF");

  const startxref = latin1.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
  if (!startxref) {
    problems.push("no startxref/%%EOF trailer found");
  } else {
    const xrefOffset = Number(startxref[1]);
    if (buffer.slice(xrefOffset, xrefOffset + 4).toString("latin1") !== "xref") {
      problems.push(`startxref ${xrefOffset} does not point at "xref"`);
    }
    const xrefBody = latin1.slice(xrefOffset);
    const header = xrefBody.match(/xref\s+\d+\s+(\d+)\s/);
    if (header) {
      const count = Number(header[1]);
      const entryRe = /(\d{10}) (\d{5}) (n|f)/g;
      let m: RegExpExecArray | null;
      let idx = 0;
      while ((m = entryRe.exec(xrefBody)) && idx < count) {
        if (m[3] === "n") {
          const off = Number(m[1]);
          const objAt = buffer.slice(off, off + 24).toString("latin1");
          if (!new RegExp(`^${idx} 0 obj`).test(objAt)) {
            problems.push(`xref obj ${idx}: offset ${off} -> "${objAt.slice(0, 12)}"`);
          }
        }
        idx += 1;
      }
    }
  }

  const streamRe = /\/Length (\d+) >>\s*stream\n/g;
  let sm: RegExpExecArray | null;
  let streamIdx = 0;
  while ((sm = streamRe.exec(latin1))) {
    const declared = Number(sm[1]);
    const dataStart = sm.index + sm[0].length;
    const endIdx = latin1.indexOf("\nendstream", dataStart);
    const actual = Buffer.byteLength(latin1.slice(dataStart, endIdx), "latin1");
    if (declared !== actual)
      problems.push(`stream #${streamIdx}: /Length ${declared} != actual ${actual}`);
    streamIdx += 1;
  }

  return problems;
}

const planBody = `### Plan snapshot
A 3-day full-body plan — short and doable. **Split:** Full Body 💪.

#### Phase 1 — Foundation (Weeks 1–4)

##### Day 1 — Full Body

| Exercise | Sets | Reps | Rest | RPE | Notes |
| --- | --- | --- | --- | --- | --- |
| Goblet Squat | 3 | 8–10 | 90s | 7 | brace ribs down |

---

### Daily targets

| Metric | Target |
| --- | --- |
| Calories | ~1,680 kcal/day |
| Protein | 125 g |

> Not medical nutrition therapy — check with a professional for clinical conditions.
`;

async function main(): Promise<void> {
  let failed = false;

  // 1) Admin Markdown path — the full assembled document (intake summary + plan).
  const intake = coachingIntakeSchema.parse(sampleIntakeFormData);
  const assembled = assemblePlanDocument(intake, planBody);
  const mdProblems = validatePdf(
    renderMarkdownPdf(assembled, { title: "Coaching document — Sample" }),
  );
  console.log(`[markdown] ${mdProblems.length === 0 ? "PASS" : "FAIL"}`);
  mdProblems.forEach((p) => console.log("  -", p));
  failed ||= mdProblems.length > 0;

  // 2) Structured thank-you path — a minimal plan with non-ASCII content to exercise sanitization.
  const plan = coachingPlanSchema.parse({
    id: "check-pdf",
    userId: "checker",
    intakeSubmissionId: "check",
    status: "ready",
    plan: {
      version: 1,
      content: { overview: "Fuel your strength — week 1 💪 (em-dash + emoji test)" },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const request = {
    includeAppendix: false,
    planId: plan.id,
    userId: plan.userId,
  } as PdfGenerationRequest;
  const structuredProblems = validatePdf(await renderCoachingPlanPdf(plan, request));
  console.log(`[structured] ${structuredProblems.length === 0 ? "PASS" : "FAIL"}`);
  structuredProblems.forEach((p) => console.log("  -", p));
  failed ||= structuredProblems.length > 0;

  if (failed) {
    console.error("\nPDF CHECK FAILED");
    process.exit(1);
  }
  console.log("\nPDF CHECK PASSED");
}

void main();
