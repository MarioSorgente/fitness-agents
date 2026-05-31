import type { Firestore } from "firebase-admin/firestore";

import type { CoachingRepository } from "./coachingRepository";
import { createFirebaseCoachingRepository } from "./firebaseCoachingRepository";
import { LocalFileCoachingRepository } from "./localCoachingRepository";

export class CoachingRepositoryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoachingRepositoryConfigError";
  }
}

const FIREBASE_INCOMPLETE_MESSAGE =
  "Firebase repository selected but Firebase Admin credentials are incomplete. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.";

function hasFirebaseServiceAccount(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

function hasPartialFirebaseServiceAccount(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim());
}

function hasFirebaseIndividualCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function hasPartialFirebaseIndividualCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_CLIENT_EMAIL ||
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function hasFirebaseApplicationDefaultCredentials(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIRESTORE_EMULATOR_HOST);
}

function hasCompleteFirebaseCredentials(): boolean {
  return (
    hasFirebaseServiceAccount() ||
    hasFirebaseIndividualCredentials() ||
    hasFirebaseApplicationDefaultCredentials()
  );
}

function hasPartialFirebaseCredentials(): boolean {
  return hasPartialFirebaseServiceAccount() || hasPartialFirebaseIndividualCredentials();
}

function isProductionVercel(): boolean {
  return Boolean(
    process.env.VERCEL &&
      (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"),
  );
}

function shouldUseFirebase(): boolean {
  const repositoryMode = process.env.COACHING_REPOSITORY?.trim().toLowerCase();

  if (repositoryMode === "firebase") {
    if (!hasCompleteFirebaseCredentials()) {
      throw new CoachingRepositoryConfigError(FIREBASE_INCOMPLETE_MESSAGE);
    }
    return true;
  }

  if (repositoryMode === "local") {
    return false;
  }

  if (hasCompleteFirebaseCredentials()) {
    return true;
  }

  if (hasPartialFirebaseCredentials() || isProductionVercel()) {
    throw new CoachingRepositoryConfigError(FIREBASE_INCOMPLETE_MESSAGE);
  }

  return false;
}

export function createCoachingRepository(db?: Firestore): CoachingRepository {
  if (db || shouldUseFirebase()) {
    return createFirebaseCoachingRepository(db);
  }

  return new LocalFileCoachingRepository();
}
