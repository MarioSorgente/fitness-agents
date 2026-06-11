"use client";

import { useRef, useState } from "react";

import { MarkdownPreview } from "@/lib/coaching/markdown/MarkdownPreview";

type AgentStatus = "waiting" | "running" | "done" | "failed";

type AgentRow = {
  step: string;
  title: string;
  status: AgentStatus;
  provider?: string;
  durationMs?: number;
  error?: string;
};

type Phase = "idle" | "generating" | "ready" | "error";

type SaveState = { status: "idle" | "saving" | "saved" | "error"; message?: string };
type PdfState = { status: "idle" | "working" | "error"; message?: string };
// "plain" = deterministic dump in flight; "questions" = dump + cheap-model questions in flight.
type IntakeExportState = { status: "idle" | "plain" | "questions" | "error"; message?: string };

type QualityMode = "production" | "test";

const PLAN_LENGTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "1 week (sample)" },
  { value: 4, label: "4 weeks (1 month)" },
  { value: 12, label: "12 weeks (3 months)" },
  { value: 24, label: "24 weeks (6 months)" },
];

const QUALITY_OPTIONS: Array<{ value: QualityMode; label: string }> = [
  { value: "production", label: "Final (premium models)" },
  { value: "test", label: "Draft (fast/cheap)" },
];

type SubmissionWorkflowProps = {
  submissionId: string;
  userId: string;
  payload: Record<string, unknown>;
  initialPlanId?: string;
  initialMarkdown?: string;
};

function statusIcon(status: AgentStatus): string {
  return status === "done" ? "✓" : status === "failed" ? "✕" : status === "running" ? "●" : "○";
}

function statusColor(status: AgentStatus): string {
  return status === "done"
    ? "#1a7f37"
    : status === "failed"
      ? "#cf222e"
      : status === "running"
        ? "#1f6feb"
        : "rgba(120,120,120,0.7)";
}

function deriveTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Coaching document";
}

export function SubmissionWorkflow({
  submissionId,
  userId,
  payload,
  initialPlanId,
  initialMarkdown,
}: SubmissionWorkflowProps) {
  const [phase, setPhase] = useState<Phase>(initialMarkdown ? "ready" : "idle");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [markdown, setMarkdown] = useState(initialMarkdown ?? "");
  const [planId, setPlanId] = useState<string | undefined>(initialPlanId);
  const [planLength, setPlanLength] = useState<number>(12);
  const [quality, setQuality] = useState<QualityMode>("production");
  const [genError, setGenError] = useState<string | undefined>(undefined);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [pdf, setPdf] = useState<PdfState>({ status: "idle" });
  const [intakeExport, setIntakeExport] = useState<IntakeExportState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  function setAgent(step: string, patch: Partial<AgentRow>) {
    setAgents((current) => current.map((row) => (row.step === step ? { ...row, ...patch } : row)));
  }

  async function generate() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setPhase("generating");
    setGenError(undefined);
    setAgents([]);
    setSave({ status: "idle" });

    try {
      const response = await fetch("/api/coaching/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          intakeSubmissionId: submissionId,
          intakePayload: payload,
          orchestrationMode: quality,
          planDurationWeeks: planLength,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        let message = `Generation failed (HTTP ${response.status}).`;
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string } };
          if (parsed?.error?.message) message = parsed.error.message;
        } catch {
          /* ignore */
        }
        setPhase("error");
        setGenError(message);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          const rawEvent = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          separator = buffer.indexOf("\n\n");

          const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            handleEvent(JSON.parse(json));
          } catch {
            /* skip malformed line */
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setPhase("error");
      setGenError(error instanceof Error ? error.message : "Lost connection to the generator.");
    }
  }

  function handleEvent(event: Record<string, unknown>) {
    const kind = event.kind as string;
    switch (kind) {
      case "timeline":
        setAgents(
          (event.steps as Array<{ step: string; title: string }>).map((entry) => ({
            step: entry.step,
            title: entry.title,
            status: "waiting",
          })),
        );
        break;
      case "step_started":
        setAgent(event.step as string, { status: "running" });
        break;
      case "step_completed":
        setAgent(event.step as string, {
          status: "done",
          provider: event.provider as string,
          durationMs: event.durationMs as number,
        });
        break;
      case "step_failed":
        setAgent(event.step as string, {
          status: "failed",
          error: event.error as string,
          durationMs: event.durationMs as number,
        });
        break;
      case "plan_ready": {
        const plan = event.plan as { markdown?: string } | undefined;
        const doc = (event.markdown as string) ?? plan?.markdown ?? "";
        setMarkdown(doc);
        setPlanId(event.planId as string);
        setPhase("ready");
        break;
      }
      case "plan_text_fallback":
        setMarkdown(event.planText as string);
        setPlanId(event.planId as string);
        setPhase("ready");
        setGenError(
          `AI providers were unavailable, so a deterministic draft was used (${event.reason as string}). Review carefully.`,
        );
        break;
      case "error":
        setPhase("error");
        setGenError(event.message as string);
        break;
      default:
        break;
    }
  }

  async function handleSave() {
    if (!planId) {
      setSave({ status: "error", message: "Generate a draft before saving." });
      return;
    }
    setSave({ status: "saving" });
    try {
      const response = await fetch("/api/coaching/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId, markdown }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSave({ status: "error", message: body?.error?.message ?? "Save failed." });
        return;
      }
      setSave({ status: "saved" });
    } catch (error) {
      setSave({
        status: "error",
        message: error instanceof Error ? error.message : "Save failed.",
      });
    }
  }

  async function handlePdf() {
    setPdf({ status: "working" });
    try {
      const response = await fetch("/api/coaching/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId, markdown, documentTitle: deriveTitle(markdown) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setPdf({ status: "error", message: body?.error?.message ?? "PDF generation failed." });
        return;
      }
      const blob = await response.blob();
      triggerDownload(blob, `coaching-document-${planId ?? submissionId}.pdf`);
      setPdf({ status: "idle" });
    } catch (error) {
      setPdf({
        status: "error",
        message: error instanceof Error ? error.message : "PDF generation failed.",
      });
    }
  }

  function handleDownloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    triggerDownload(blob, `coaching-document-${planId ?? submissionId}.md`);
  }

  async function handleIntakeMarkdown(withQuestions: boolean) {
    if (intakeExport.status === "plain" || intakeExport.status === "questions") return;
    setIntakeExport({ status: withQuestions ? "questions" : "plain" });
    try {
      const response = await fetch("/api/coaching/intake-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, withQuestions }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setIntakeExport({
          status: "error",
          message: body?.error?.message ?? "Could not build the intake document.",
        });
        return;
      }
      const md = await response.text();
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      triggerDownload(blob, `intake-${submissionId}${withQuestions ? "-with-questions" : ""}.md`);
      setIntakeExport({ status: "idle" });
    } catch (error) {
      setIntakeExport({
        status: "error",
        message: error instanceof Error ? error.message : "Could not build the intake document.",
      });
    }
  }

  const generationControls = (
    <div className="generation-controls" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        Plan length
        <select
          value={planLength}
          onChange={(event) => setPlanLength(Number(event.target.value))}
          disabled={phase === "generating"}
        >
          {PLAN_LENGTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        Quality
        <select
          value={quality}
          onChange={(event) => setQuality(event.target.value as QualityMode)}
          disabled={phase === "generating"}
        >
          {QUALITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const intakeBusy = intakeExport.status === "plain" || intakeExport.status === "questions";

  return (
    <>
      <section className="card stack">
        <div className="section-heading">
          <h2>Client intake document</h2>
        </div>
        <p className="muted-copy">
          Download everything the client entered as a human-readable Markdown file — useful before
          you run the agents. Add cheap-model-suggested follow-up questions to prep your first call,
          or grab the plain dump to paste into any chat model yourself.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => handleIntakeMarkdown(false)}
            disabled={intakeBusy}
          >
            {intakeExport.status === "plain" ? "Preparing…" : "Download intake .md"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => handleIntakeMarkdown(true)}
            disabled={intakeBusy}
          >
            {intakeExport.status === "questions"
              ? "Asking model…"
              : "Download + coach questions .md"}
          </button>
          {intakeExport.status === "error" ? (
            <span className="error-text">{intakeExport.message}</span>
          ) : null}
        </div>
      </section>

      <section className="card stack">
        <div className="section-heading">
          <h2>Coaching document</h2>
          {phase === "ready" ? <span>Draft ready</span> : null}
        </div>

        {phase === "idle" ? (
          <>
            <p className="muted-copy">
              Run the coaching agents on this intake to draft an editable Markdown document (client
              summary + plan). Choose a program length and quality, then generate. You can edit it
              before exporting a PDF.
            </p>
            {generationControls}
            <div className="button-row">
              <button type="button" onClick={generate}>
                Generate draft
              </button>
            </div>
          </>
        ) : null}

        {phase === "generating" ? (
          <>
            <p className="muted-copy">The coaching panel is reviewing this intake…</p>
            <ul className="agent-timeline" aria-live="polite">
              {agents.map((row) => (
                <li key={row.step} data-status={row.status}>
                  <span style={{ color: statusColor(row.status), fontWeight: 700 }}>
                    {statusIcon(row.status)}
                  </span>
                  <span>{row.title}</span>
                  <small style={{ color: statusColor(row.status) }}>
                    {row.status === "done"
                      ? `Done${row.provider ? ` · ${row.provider}` : ""}`
                      : row.status === "failed"
                        ? `Failed${row.error ? `: ${row.error}` : ""}`
                        : row.status === "running"
                          ? "Thinking…"
                          : "Waiting…"}
                  </small>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {phase === "error" ? (
          <>
            <p className="error-text">{genError ?? "Generation failed."}</p>
            <div className="button-row">
              <button type="button" onClick={generate}>
                Try again
              </button>
            </div>
          </>
        ) : null}

        {phase === "ready" ? (
          <>
            {genError ? <p className="error-text">{genError}</p> : null}
            {generationControls}
            <div className="md-toolbar">
              <button type="button" onClick={handleSave} disabled={save.status === "saving"}>
                {save.status === "saving" ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handlePdf}
                disabled={pdf.status === "working"}
              >
                {pdf.status === "working" ? "Preparing PDF…" : "Generate PDF"}
              </button>
              <button type="button" className="secondary-button" onClick={handleDownloadMarkdown}>
                Download .md
              </button>
              <button type="button" className="text-button" onClick={generate}>
                Regenerate
              </button>
              {save.status === "saved" ? <span className="save-ok">Saved ✓</span> : null}
              {save.status === "error" ? <span className="error-text">{save.message}</span> : null}
              {pdf.status === "error" ? <span className="error-text">{pdf.message}</span> : null}
            </div>

            <div className="md-workbench">
              <label className="md-editor-label">
                Markdown
                <textarea
                  className="md-editor"
                  value={markdown}
                  onChange={(event) => {
                    setMarkdown(event.target.value);
                    if (save.status !== "idle") setSave({ status: "idle" });
                  }}
                  spellCheck
                />
              </label>
              <div className="md-preview-pane">
                <span className="md-preview-label">Preview</span>
                <MarkdownPreview markdown={markdown} />
              </div>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
