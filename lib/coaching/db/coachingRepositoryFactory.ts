import type { Firestore } from "firebase-admin/firestore";

import { FirebaseConfigError } from "../api/routeUtils";
import type { CoachingRepository } from "./coachingRepository";
import { createFirebaseCoachingRepository } from "./firebaseCoachingRepository";
import { LocalFileCoachingRepository } from "./localCoachingRepository";

type RepositoryChoice = {
  kind: "firebase" | "local";
  reason: string;
  explicit: boolean;
};

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

function chooseRepository(): RepositoryChoice {
  if (process.env.COACHING_REPOSITORY === "firebase") {
    return { kind: "firebase", reason: "COACHING_REPOSITORY=firebase", explicit: true };
  }

  if (process.env.COACHING_REPOSITORY === "local") {
    return { kind: "local", reason: "COACHING_REPOSITORY=local", explicit: true };
  }

  if (hasFirebaseServiceAccount()) {
    return {
      kind: "firebase",
      reason: "FIREBASE_SERVICE_ACCOUNT_KEY detected",
      explicit: false,
    };
  }
  if (hasFirebaseIndividualCredentials()) {
    return {
      kind: "firebase",
      reason: "FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY detected",
      explicit: false,
    };
  }
  if (hasFirebaseApplicationDefaultCredentials()) {
    return {
      kind: "firebase",
      reason: "Firebase application default credentials detected",
      explicit: false,
    };
  }

  return { kind: "local", reason: "no Firebase env vars detected", explicit: false };
}

export function createCoachingRepository(db?: Firestore): CoachingRepository {
  if (db) {
    console.info("[coaching repo] using FirebaseCoachingRepository (explicit Firestore instance)");
    return createFirebaseCoachingRepository(db);
  }

  const choice = chooseRepository();

  if (choice.kind === "firebase") {
    try {
      const repo = createFirebaseCoachingRepository();
      console.info(`[coaching repo] using FirebaseCoachingRepository (${choice.reason})`);
      return repo;
    } catch (error) {
      if (choice.explicit) {
        // User explicitly asked for Firebase — surface the real error.
        throw error;
      }

      const reason =
        error instanceof FirebaseConfigError
          ? `config error: ${error.message}`
          : error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
      console.warn(
        `[coaching repo] Firebase auto-detect failed (${reason}); falling back to LocalFileCoachingRepository. Set COACHING_REPOSITORY=local to silence this warning.`,
      );
      return new LocalFileCoachingRepository();
    }
  }

  console.info(`[coaching repo] using LocalFileCoachingRepository (${choice.reason})`);
  return new LocalFileCoachingRepository();
}
