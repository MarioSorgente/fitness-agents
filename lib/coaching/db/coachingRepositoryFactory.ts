import type { Firestore } from "firebase-admin/firestore";

import type { CoachingRepository } from "./coachingRepository";
import { createFirebaseCoachingRepository } from "./firebaseCoachingRepository";
import { LocalFileCoachingRepository } from "./localCoachingRepository";

function hasFirebaseServiceAccount(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

function hasFirebaseIndividualCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function hasFirebaseApplicationDefaultCredentials(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIRESTORE_EMULATOR_HOST);
}

function shouldUseFirebase(): boolean {
  if (process.env.COACHING_REPOSITORY === "firebase") {
    return true;
  }

  if (process.env.COACHING_REPOSITORY === "local") {
    return false;
  }

  return (
    hasFirebaseServiceAccount() ||
    hasFirebaseIndividualCredentials() ||
    hasFirebaseApplicationDefaultCredentials()
  );
}

export function createCoachingRepository(db?: Firestore): CoachingRepository {
  if (db || shouldUseFirebase()) {
    return createFirebaseCoachingRepository(db);
  }

  return new LocalFileCoachingRepository();
}
