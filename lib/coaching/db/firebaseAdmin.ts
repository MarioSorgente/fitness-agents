import { createRequire } from "node:module";

import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

import { FirebaseConfigError } from "../api/routeUtils";

type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const REMEDIATION_HINT =
  "Fix the env var, unset it, or set COACHING_REPOSITORY=local to use the in-memory store.";

const nodeRequire = createRequire(import.meta.url);

let firestore: Firestore | undefined;
let auth: Auth | undefined;

function fromServiceAccountJson(): FirebaseServiceAccount | undefined {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!rawServiceAccount) {
    return undefined;
  }

  let parsed: {
    project_id?: string;
    projectId?: string;
    client_email?: string;
    clientEmail?: string;
    private_key?: string;
    privateKey?: string;
  };
  try {
    parsed = JSON.parse(rawServiceAccount);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new FirebaseConfigError(
      `FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON (${reason}). ${REMEDIATION_HINT}`,
    );
  }

  const projectId = parsed.project_id ?? parsed.projectId;
  const clientEmail = parsed.client_email ?? parsed.clientEmail;
  const privateKey = parsed.private_key ?? parsed.privateKey;

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseConfigError(
      `FIREBASE_SERVICE_ACCOUNT_KEY must include project_id, client_email, and private_key. ${REMEDIATION_HINT}`,
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

function fromIndividualEnvVars(): FirebaseServiceAccount | undefined {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId && !clientEmail && !privateKey) {
    return undefined;
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseConfigError(
      `FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be set together. ${REMEDIATION_HINT}`,
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

export function getFirebaseAdminApp(): App {
  const { applicationDefault, cert, getApps, initializeApp } = nodeRequire(
    "firebase-admin/app",
  ) as typeof import("firebase-admin/app");
  const [existingApp] = getApps();

  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = fromServiceAccountJson() ?? fromIndividualEnvVars();

  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export function getFirebaseFirestore(): Firestore {
  if (firestore) {
    return firestore;
  }

  const { getFirestore } = nodeRequire(
    "firebase-admin/firestore",
  ) as typeof import("firebase-admin/firestore");
  firestore = getFirestore(getFirebaseAdminApp());

  // Intake payloads contain optional fields that parse to `undefined`; Firestore
  // rejects `undefined` values unless we opt to ignore them (local JSON drops them).
  try {
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if Firestore was already used; safe to ignore on re-entry.
  }

  return firestore;
}

export function getFirebaseAuth(): Auth {
  if (auth) {
    return auth;
  }

  const { getAuth } = nodeRequire("firebase-admin/auth") as typeof import("firebase-admin/auth");
  auth = getAuth(getFirebaseAdminApp());

  return auth;
}
