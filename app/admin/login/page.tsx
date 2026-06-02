import { Suspense } from "react";

import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="page-shell narrow-shell">
      <section className="hero-panel stack">
        <p className="eyebrow">Admin</p>
        <h1>Sign in</h1>
        <p>This area is restricted to the coaching admin. Sign in with your authorized Google account.</p>
      </section>
      <Suspense>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}
