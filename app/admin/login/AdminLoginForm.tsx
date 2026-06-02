"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  getFirebaseClientAuth,
  isFirebaseClientConfigured,
} from "@/lib/coaching/auth/firebaseClient";

type Status = "idle" | "signing" | "error";

export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/admin/submissions";
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>();

  async function signIn() {
    if (!isFirebaseClientConfigured()) {
      setStatus("error");
      setMessage(
        "Firebase client config is missing. Set the NEXT_PUBLIC_FIREBASE_* environment variables.",
      );
      return;
    }

    setStatus("signing");
    setMessage(undefined);

    try {
      const auth = getFirebaseClientAuth();
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string; details?: { name?: string; message?: string } };
        } | null;
        const detail = body?.error?.details?.message
          ? ` — ${body.error.details.message}`
          : "";
        setStatus("error");
        setMessage(`${body?.error?.message ?? "Sign-in was rejected."}${detail}`);
        // Drop the client session so a different account can be tried.
        await auth.signOut().catch(() => {});
        return;
      }

      router.push(from);
      router.refresh();
    } catch (error) {
      setStatus("error");
      const code = (error as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setStatus("idle");
        return;
      }
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    }
  }

  return (
    <section className="card stack">
      <h2>Coaching admin access</h2>
      <p className="muted-copy">
        Only authorized accounts can view client intakes and generate documents.
      </p>
      <div className="button-row">
        <button type="button" onClick={signIn} disabled={status === "signing"}>
          {status === "signing" ? "Opening Google…" : "Sign in with Google"}
        </button>
      </div>
      {status === "error" && message ? <p className="error-text">{message}</p> : null}
    </section>
  );
}
