"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  getFirebaseClientAuth,
  isFirebaseClientConfigured,
} from "@/lib/coaching/auth/firebaseClient";

export function AdminHeader({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      if (isFirebaseClientConfigured()) {
        await getFirebaseClientAuth()
          .signOut()
          .catch(() => {});
      }
    } catch {
      // Best effort — clearing the cookie above is what actually ends the session.
    }
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-bar">
      <span className="muted-copy">
        Signed in as <strong>{email}</strong>
      </span>
      <nav className="admin-nav" aria-label="Admin navigation">
        <Link href="/admin/clients">Clients CRM</Link>
        <Link href="/admin/submissions">Intake queue</Link>
      </nav>
      <button type="button" className="text-button" onClick={signOut} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
