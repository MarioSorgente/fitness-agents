import { createRequire } from "node:module";

import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";

type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const nodeRequire = createRequire(import.meta.url);

let firestore: Firestore | undefined;

function fromServiceAccountJson(): FirebaseServiceAccount | undefined {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!rawServiceAccount) {
    return undefined;
  }

  const parsed = JSON.parse(rawServiceAccount) as {
    project_id?: string;
    projectId?: string;
    client_email?: string;
    clientEmail?: string;
    private_key?: string;
    privateKey?: string;
  };

  const projectId = parsed.project_id ?? parsed.projectId;
  const clientEmail = parsed.client_email ?? parsed.clientEmail;
  const privateKey = parsed.private_key ?? parsed.privateKey;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY must include project_id, client_email, and private_key.",
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
    throw new Error(
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be set together.",
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

  return firestore;
}
