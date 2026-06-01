"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type StreamEvent =
  | { kind: "intake_loaded"; submissionId: string }
  | { kind: "timeline"; steps: Array<{ step: string; title: string }> }
  | { kind: "step_started"; step: string; title: string }
  | {
      kind: "step_completed";
      step: string;
      title: string;
      provider: string;
      model: string;
      durationMs: number;
    }
  | {
      kind: "step_failed";
      step: string;
      title: string;
      error: string;
      durationMs: number;
    }
  | { kind: "plan_ready"; planId: string; reviewStateId?: string }
  | {
      kind: "plan_text_fallback";
      planId: string;
      reason: string;
      planText: string;
    }
  | { kind: "error"; message: string; details?: { name: string; message: string } }
  | { kind: "done" };

type AgentStatus = "waiting" | "running" | "done" | "failed";

type AgentRow = {
  step: string;
  title: string;
  status: AgentStatus;
  provider?: string;
  model?: string;
  durationMs?: number;
  error?: string;
};

type PageStatus =
  | { kind: "generating" }
  | { kind: "ready"; planId: string }
  | { kind: "text_fallback"; planId: string; reason: string; planText: string }
  | { kind: "error"; message: string };

type PdfStatus =
  | { kind: "idle" }
  | { kind: "downloading" }
  | { kind: "error"; message: string };

function statusIcon(status: AgentStatus): string {
  switch (status) {
    case "waiting":
      return "○";
    case "running":
      return "●";
    case "done":
      return "✓";
    case "failed":
      return "✕";
  }
}

function statusLabel(row: AgentRow): string {
  switch (row.status) {
    case "waiting":
      return "Waiting…";
    case "running":
      return "Thinking…";
    case "done":
      return `Done${row.provider ? ` · ${row.provider}` : ""}${
        row.durationMs !== undefined ? ` · ${(row.durationMs / 1000).toFixed(1)}s` : ""
      }`;
    case "failed":
      return `Failed${row.error ? `: ${row.error}` : ""}`;
  }
}

function statusColor(status: AgentStatus): string {
  switch (status) {
    case "waiting":
      return "rgba(120, 120, 120, 0.7)";
    case "running":
      return "#1f6feb";
    case "done":
      return "#1a7f37";
    case "failed":
      return "#cf222e";
  }
}

export function CoachingThankYouView({
  submissionId,
  userId,
}: {
  submissionId: string;
  userId?: string;
}) {
  const [page, setPage] = useState<PageStatus>({ kind: "generating" });
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [pdf, setPdf] = useState<PdfStatus>({ kind: "idle" });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const effectiveUserId = userId ?? "anonymous-intake";
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/coaching/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: effectiveUserId,
            intakeSubmissionId: submissionId,
            orchestrationMode: "test",
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          let message = `Plan generation failed (HTTP ${response.status}).`;
          try {
            const parsed = JSON.parse(text) as {
              error?: { message?: string; details?: { name?: string; message?: string } };
            };
            if (parsed?.error?.message) {
              const detail = parsed.error.details?.message
                ? ` (${parsed.error.details.name ?? "Error"}: ${parsed.error.details.message})`
                : "";
              message = `${parsed.error.message}${detail}`;
            }
          } catch {
            // ignore
          }
          setPage({ kind: "error", message });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let separatorIndex = buffer.indexOf("\n\n");
          while (separatorIndex !== -1) {
            const rawEvent = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);
            separatorIndex = buffer.indexOf("\n\n");

            const dataLine = rawEvent
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            const json = dataLine.slice(5).trim();
            if (!json) continue;

            try {
              handleEvent(JSON.parse(json) as StreamEvent);
            } catch {
              // skip malformed line
            }
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setPage({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Lost connection to the plan-generation stream.",
        });
      }
    })();

    function handleEvent(event: StreamEvent) {
      switch (event.kind) {
        case "timeline":
          setAgents(
            event.steps.map((entry) => ({
              step: entry.step,
              title: entry.title,
              status: "waiting" as AgentStatus,
            })),
          );
          break;
        case "step_started":
          setAgents((current) =>
            current.map((row) =>
              row.step === event.step ? { ...row, status: "running" } : row,
            ),
          );
          break;
        case "step_completed":
          setAgents((current) =>
            current.map((row) =>
              row.step === event.step
                ? {
                    ...row,
                    status: "done",
                    provider: event.provider,
                    model: event.model,
                    durationMs: event.durationMs,
                  }
                : row,
            ),
          );
          break;
        case "step_failed":
          setAgents((current) =>
            current.map((row) =>
              row.step === event.step
                ? {
                    ...row,
                    status: "failed",
                    error: event.error,
                    durationMs: event.durationMs,
                  }
                : row,
            ),
          );
          break;
        case "plan_ready":
          setPage({ kind: "ready", planId: event.planId });
          break;
        case "plan_text_fallback":
          setPage({
            kind: "text_fallback",
            planId: event.planId,
            reason: event.reason,
            planText: event.planText,
          });
          break;
        case "error":
          setPage({
            kind: "error",
            message: event.details?.message
              ? `${event.message} (${event.details.name ?? "Error"})`
              : event.message,
          });
          break;
        case "intake_loaded":
        case "done":
          break;
      }
    }

    return () => controller.abort();
  }, [submissionId, userId]);

  const totalDurationMs = useMemo(
    () =>
      agents.reduce((sum, row) => sum + (row.durationMs ?? 0), 0),
    [agents],
  );

  async function handleDownloadPdf(planId: string) {
    setPdf({ kind: "downloading" });
    try {
      const response = await fetch("/api/coaching/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId ?? "anonymous-intake",
          planId,
          includeAppendix: true,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string; details?: { name?: string; message?: string } };
        } | null;
        const detail = body?.error?.details?.message
          ? ` (${body.error.details.name ?? "Error"}: ${body.error.details.message})`
          : "";
        setPdf({
          kind: "error",
          message: `${body?.error?.message ?? "PDF generation failed."}${detail}`,
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      link.download = filenameMatch?.[1] ?? `coaching-plan-${planId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPdf({ kind: "idle" });
    } catch (error) {
      setPdf({
        kind: "error",
        message: error instanceof Error ? error.message : "PDF generation failed.",
      });
    }
  }

  return (
    <>
      <section className="card stack">
        <h2>
          {page.kind === "generating"
            ? "Coaching panel in session…"
            : page.kind === "ready"
              ? "Coaching panel complete"
              : page.kind === "text_fallback"
                ? "Plan ready (text fallback)"
                : "We hit a snag"}
        </h2>
        <p className="muted-copy">
          {page.kind === "generating"
            ? "Each specialist reviews your intake in turn. Token usage stays low — only progress is streamed here."
            : page.kind === "ready"
              ? `Panel finished in ${(totalDurationMs / 1000).toFixed(1)}s. Your plan is ready below.`
              : page.kind === "text_fallback"
                ? "The AI provider pipeline was unavailable, so we assembled a deterministic plan directly from your intake."
                : "Plan generation stopped before completing."}
        </p>

        {agents.length === 0 && page.kind === "generating" ? (
          <p aria-busy="true">Connecting to the panel…</p>
        ) : null}

        <ul
          aria-live="polite"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: "6px",
          }}
        >
          {agents.map((row) => (
            <li
              key={row.step}
              style={{
                display: "grid",
                gridTemplateColumns: "20px 1fr auto",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "8px",
                background:
                  row.status === "running"
                    ? "rgba(31, 111, 235, 0.08)"
                    : row.status === "failed"
                      ? "rgba(207, 34, 46, 0.08)"
                      : "rgba(0,0,0,0.025)",
              }}
            >
              <span style={{ color: statusColor(row.status), fontWeight: 600 }}>
                {statusIcon(row.status)}
              </span>
              <span>{row.title}</span>
              <small style={{ color: statusColor(row.status) }}>{statusLabel(row)}</small>
            </li>
          ))}
        </ul>

        {page.kind === "error" ? <p className="error-text">{page.message}</p> : null}
      </section>

      {page.kind === "ready" ? (
        <section className="card stack">
          <h2>Download your coaching plan</h2>
          <p className="muted-copy">Plan ID: {page.planId}</p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => handleDownloadPdf(page.planId)}
              disabled={pdf.kind === "downloading"}
            >
              {pdf.kind === "downloading" ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
          {pdf.kind === "error" ? <p className="error-text">{pdf.message}</p> : null}
        </section>
      ) : null}

      {page.kind === "text_fallback" ? (
        <section className="card stack">
          <h2>Plan summary (text)</h2>
          <p className="muted-copy">Reason: {page.reason}</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "rgba(0,0,0,0.04)",
              padding: "16px",
              borderRadius: "8px",
              fontFamily: "inherit",
              fontSize: "0.95em",
            }}
          >
            {page.planText}
          </pre>
        </section>
      ) : null}
    </>
  );
}
