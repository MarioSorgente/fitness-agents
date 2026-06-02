import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiRouteError,
  handleRouteError,
  parseJsonBody,
} from "@/lib/coaching/api/routeUtils";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_EXPIRES_IN_MS,
  isEmailAdmin,
} from "@/lib/coaching/auth/adminAuth";
import { getFirebaseAuth } from "@/lib/coaching/db/firebaseAdmin";

export const runtime = "nodejs";

const bodySchema = z.object({ idToken: z.string().min(10).max(8192) });

function cookieOptions(maxAge: number) {
  return {
    name: ADMIN_SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// POST: verify a freshly-issued Google ID token, confirm the email is an allowed admin,
// then mint a long-lived HttpOnly session cookie.
export async function POST(request: Request) {
  try {
    const { idToken } = bodySchema.parse(await parseJsonBody(request));
    const auth = getFirebaseAuth();

    const decoded = await auth.verifyIdToken(idToken, true);
    if (!decoded.email_verified || !isEmailAdmin(decoded.email)) {
      throw new ApiRouteError(
        "FORBIDDEN",
        "This Google account is not authorized for admin access.",
        403,
      );
    }

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ data: { email: decoded.email } });
    response.cookies.set({
      ...cookieOptions(Math.floor(SESSION_EXPIRES_IN_MS / 1000)),
      value: sessionCookie,
    });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

// DELETE: clear the session cookie (sign out).
export async function DELETE() {
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set({ ...cookieOptions(0), value: "" });
  return response;
}
