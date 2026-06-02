import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiRouteError } from "../api/routeUtils";
import { getFirebaseAuth } from "../db/firebaseAdmin";

export const ADMIN_SESSION_COOKIE = "__session";
// Firebase requires session cookies to last at most 14 days; 12 keeps headroom.
export const SESSION_EXPIRES_IN_MS = 12 * 24 * 60 * 60 * 1000;

// Mario is the default (and only) admin. Override with a comma-separated ADMIN_EMAILS.
const DEFAULT_ADMIN_EMAILS = ["ms.sorgente@gmail.com"];

export function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS;
  const list =
    raw && raw.trim().length > 0
      ? raw
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean)
      : DEFAULT_ADMIN_EMAILS;
  return new Set(list);
}

export function isEmailAdmin(email: string | undefined | null): boolean {
  return Boolean(email) && getAdminEmails().has(email!.toLowerCase());
}

// Local-only escape hatch so the admin area is usable without Firebase Auth during
// development. Never bypasses in production.
export function isAdminAuthDisabled(): boolean {
  return process.env.ADMIN_AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
}

export type AdminIdentity = { email: string; name?: string };

/** Returns the signed-in admin, or null if the session is missing/invalid/unauthorized. */
export async function verifyAdminSession(): Promise<AdminIdentity | null> {
  if (isAdminAuthDisabled()) {
    return { email: "dev@local", name: "Dev (auth disabled)" };
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await getFirebaseAuth().verifySessionCookie(session, false);
    if (!decoded.email_verified || !isEmailAdmin(decoded.email)) {
      return null;
    }
    return { email: decoded.email as string, name: decoded.name as string | undefined };
  } catch {
    return null;
  }
}

/** Server-component guard: redirect to the login page when not an authorized admin. */
export async function requireAdminPage(fromPath: string): Promise<AdminIdentity> {
  const admin = await verifyAdminSession();
  if (!admin) {
    redirect(`/admin/login?from=${encodeURIComponent(fromPath)}`);
  }
  return admin;
}

/** API-route guard: throw 401 when not an authorized admin. */
export async function requireAdminApi(): Promise<AdminIdentity> {
  const admin = await verifyAdminSession();
  if (!admin) {
    throw new ApiRouteError("UNAUTHORIZED", "Admin authentication is required.", 401);
  }
  return admin;
}
