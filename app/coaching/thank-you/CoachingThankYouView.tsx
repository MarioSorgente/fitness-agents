"use client";

import { useEffect, useRef, useState } from "react";

type GeneratePlanResponse =
  | {
      data: {
        mode: "ready";
        plan: { id: string };
      };
    }
  | {
      data: {
        mode: "text_fallback";
        reason: string;
        planText: string;
        plan: { id: string };
      };
    };

type ApiErrorBody = {
  error?: {
    message?: string;
    code?: string;
    details?: { name?: string; message?: string };
  };
};

type ViewState =
  | { status: "generating" }
  | { status: "ready"; planId: string }
  | { status: "text_fallback"; planId: string; planText: string; reason: string }
  | { status: "error"; message: string };

type PdfState =
  | { status: "idle" }
  | { status: "downloading" }
  | { status: "error"; message: string };

export function CoachingThankYouView({
  submissionId,
  userId,
}: {
  submissionId: string;
  userId?: string;
}) {
  const [state, setState] = useState<ViewState>({ status: "generating" });
  const [pdfState, setPdfState] = useState<PdfState>({ status: "idle" });
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

        const body = (await response.json().catch(() => null)) as
          | (GeneratePlanResponse & ApiErrorBody)
          | null;

        if (!response.ok || !body || !("data" in body)) {
          const err = (body as ApiErrorBody | null)?.error;
          const detail = err?.details?.message
            ? ` (${err.details.name ?? "Error"}: ${err.details.message})`
            : "";
          setState({
            status: "error",
            message: `${err?.message ?? "Failed to generate plan."}${detail}`,
          });
          return;
        }

        if (body.data.mode === "text_fallback") {
          setState({
            status: "text_fallback",
            planId: body.data.plan.id,
            planText: body.data.planText,
            reason: body.data.reason,
          });
        } else {
          setState({ status: "ready", planId: body.data.plan.id });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to generate plan.",
        });
      }
    })();

    return () => controller.abort();
  }, [submissionId, userId]);

  async function handleDownloadPdf(planId: string) {
    setPdfState({ status: "downloading" });
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
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        const detail = body?.error?.details?.message
          ? ` (${body.error.details.name ?? "Error"}: ${body.error.details.message})`
          : "";
        setPdfState({
          status: "error",
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
      setPdfState({ status: "idle" });
    } catch (error) {
      setPdfState({
        status: "error",
        message: error instanceof Error ? error.message : "PDF generation failed.",
      });
    }
  }

  if (state.status === "generating") {
    return (
      <section className="card stack" aria-busy="true">
        <h2>Generating your plan…</h2>
        <p>The medical, fitness, mobility, and nutrition agents are reviewing your intake.</p>
        <p className="muted-copy">This usually takes 10–30 seconds. Please keep this tab open.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="card stack">
        <h2>We hit a snag generating your plan</h2>
        <p className="error-text">{state.message}</p>
        <p className="muted-copy">
          The intake is saved. Once the issue is fixed, you can re-run plan generation.
        </p>
      </section>
    );
  }

  if (state.status === "text_fallback") {
    return (
      <section className="card stack">
        <h2>Plan ready (text fallback)</h2>
        <p className="muted-copy">
          The AI provider pipeline was unavailable ({state.reason}), so this plan was assembled
          directly from your intake. PDF export is disabled for fallback plans — re-run plan
          generation once providers are configured to get the full multi-agent plan and PDF.
        </p>
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
          {state.planText}
        </pre>
      </section>
    );
  }

  return (
    <section className="card stack">
      <h2>Your coaching plan is ready</h2>
      <p>The agents have drafted a plan. You can download it as a PDF below.</p>
      <div className="button-row">
        <button
          type="button"
          onClick={() => handleDownloadPdf(state.planId)}
          disabled={pdfState.status === "downloading"}
        >
          {pdfState.status === "downloading" ? "Preparing PDF…" : "Download PDF"}
        </button>
      </div>
      {pdfState.status === "error" ? (
        <p className="error-text">{pdfState.message}</p>
      ) : null}
      <p className="muted-copy">Plan ID: {state.planId}</p>
    </section>
  );
}
