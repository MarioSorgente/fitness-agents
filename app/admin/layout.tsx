import type { ReactNode } from "react";

import { verifyAdminSession } from "@/lib/coaching/auth/adminAuth";

import { AdminHeader } from "./AdminHeader";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await verifyAdminSession();

  return (
    <>
      {admin ? <AdminHeader email={admin.email} /> : null}
      {children}
    </>
  );
}
