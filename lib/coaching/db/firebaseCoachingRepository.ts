import type { CollectionReference, DocumentData, Firestore, Query } from "firebase-admin/firestore";

import {
  type ClientProfile,
  type CoachingExport,
  type CoachingPlan,
  type CoachingRepository,
  type CreateCoachingExportInput,
  type CreateCoachingPlanInput,
  type CreateIntakeSubmissionInput,
  type CreateClientProfileInput,
  type IntakeSubmission,
  type ListByUserOptions,
  type ReviewState,
  type UpdateClientProfileInput,
  type UpsertReviewStateInput,
} from "./coachingRepository";
import { getFirebaseFirestore } from "./firebaseAdmin";

const COLLECTIONS = {
  intakeSubmissions: "coaching_intake_submissions",
  clientProfiles: "coaching_client_profiles",
  plans: "coaching_plans",
  reviewStates: "coaching_review_states",
  exports: "coaching_exports",
} as const;

type FirestoreDate = Date | { toDate(): Date };

type StoredDocument = DocumentData & {
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

type StoredIntakeSubmission = StoredDocument &
  Omit<IntakeSubmission, "createdAt" | "submittedAt" | "updatedAt"> & {
    submittedAt?: FirestoreDate;
  };

type StoredClientProfile = StoredDocument &
  Omit<
    ClientProfile,
    | "createdAt"
    | "lastCheckInDate"
    | "lastPlanUpdateDate"
    | "nextCheckInDate"
    | "nextFollowUpDate"
    | "renewalDate"
    | "startDate"
    | "updatedAt"
  > & {
    lastCheckInDate?: FirestoreDate;
    lastPlanUpdateDate?: FirestoreDate;
    nextCheckInDate?: FirestoreDate;
    nextFollowUpDate?: FirestoreDate;
    renewalDate?: FirestoreDate;
    startDate?: FirestoreDate;
  };

type StoredCoachingPlan = StoredDocument &
  Omit<CoachingPlan, "createdAt" | "publishedAt" | "updatedAt"> & {
    publishedAt?: FirestoreDate;
  };

type StoredReviewState = StoredDocument & Omit<ReviewState, "createdAt" | "updatedAt">;

type StoredCoachingExport = StoredDocument &
  Omit<CoachingExport, "createdAt" | "expiresAt" | "updatedAt"> & {
    expiresAt?: FirestoreDate;
  };

function toFirestoreDate(date: Date | undefined): Date | undefined {
  return date;
}

function toDate(value: FirestoreDate | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : value.toDate();
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function hydrateClientAsset(asset: unknown): import("./coachingRepository").ClientAsset {
  const value = asset && typeof asset === "object" ? (asset as Record<string, unknown>) : {};
  return {
    id: String(value.id ?? ""),
    url: String(value.url ?? ""),
    storagePath: String(value.storagePath ?? ""),
    label: String(value.label ?? "Client image"),
    uploadedAt: toDate(value.uploadedAt as FirestoreDate | undefined) ?? new Date(0),
  };
}

function mapIntakeSubmission(data: StoredIntakeSubmission): IntakeSubmission {
  return {
    ...data,
    createdAt: toDate(data.createdAt) ?? new Date(0),
    updatedAt: toDate(data.updatedAt) ?? new Date(0),
    submittedAt: toDate(data.submittedAt),
  };
}

function mapClientProfile(data: StoredClientProfile): ClientProfile {
  return {
    ...data,
    internalTags: data.internalTags ?? [],
    planImageUrls: data.planImageUrls ?? [],
    progressPhotoUrls: data.progressPhotoUrls ?? [],
    planImages: Array.isArray(data.planImages) ? data.planImages.map(hydrateClientAsset) : [],
    progressPhotos: Array.isArray(data.progressPhotos)
      ? data.progressPhotos.map(hydrateClientAsset)
      : [],
    createdAt: toDate(data.createdAt) ?? new Date(0),
    updatedAt: toDate(data.updatedAt) ?? new Date(0),
    startDate: toDate(data.startDate),
    nextFollowUpDate: toDate(data.nextFollowUpDate),
    preferredTrainingDays: data.preferredTrainingDays ?? [],
    lastCheckInDate: toDate(data.lastCheckInDate),
    nextCheckInDate: toDate(data.nextCheckInDate),
    lastPlanUpdateDate: toDate(data.lastPlanUpdateDate),
    renewalDate: toDate(data.renewalDate),
  } as ClientProfile;
}

function mapCoachingPlan(data: StoredCoachingPlan): CoachingPlan {
  return {
    ...data,
    createdAt: toDate(data.createdAt) ?? new Date(0),
    updatedAt: toDate(data.updatedAt) ?? new Date(0),
    publishedAt: toDate(data.publishedAt),
  } as CoachingPlan;
}

function mapReviewState(data: StoredReviewState): ReviewState {
  return {
    ...data,
    createdAt: toDate(data.createdAt) ?? new Date(0),
    updatedAt: toDate(data.updatedAt) ?? new Date(0),
  };
}

function mapCoachingExport(data: StoredCoachingExport): CoachingExport {
  return {
    ...data,
    createdAt: toDate(data.createdAt) ?? new Date(0),
    updatedAt: toDate(data.updatedAt) ?? new Date(0),
    expiresAt: toDate(data.expiresAt),
  };
}

async function listDocuments<T>(
  query: Query<DocumentData>,
  mapper: (data: DocumentData) => T,
): Promise<T[]> {
  const snapshot = await query.get();

  return snapshot.docs.map((doc: { data(): DocumentData }) => mapper(doc.data()));
}

export class FirebaseCoachingRepository implements CoachingRepository {
  constructor(private readonly db: Firestore = getFirebaseFirestore()) {}

  async createIntakeSubmission(input: CreateIntakeSubmissionInput): Promise<IntakeSubmission> {
    const now = new Date();
    const ref = this.documentRef(this.intakeSubmissions(), input.id);
    const data = stripUndefined({
      id: ref.id,
      userId: input.userId,
      status: input.status ?? "draft",
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
      submittedAt: toFirestoreDate(input.submittedAt),
    });

    await ref.set(data);

    return mapIntakeSubmission(data as StoredIntakeSubmission);
  }

  async getIntakeSubmission(id: string): Promise<IntakeSubmission | null> {
    const snapshot = await this.intakeSubmissions().doc(id).get();

    return snapshot.exists ? mapIntakeSubmission(snapshot.data() as StoredIntakeSubmission) : null;
  }

  async listIntakeSubmissions(options: ListByUserOptions): Promise<IntakeSubmission[]> {
    return listDocuments(this.byUser(this.intakeSubmissions(), options), (data) =>
      mapIntakeSubmission(data as StoredIntakeSubmission),
    );
  }

  async listAllIntakeSubmissions(limit?: number): Promise<IntakeSubmission[]> {
    let query: Query<DocumentData> = this.intakeSubmissions().orderBy("createdAt", "desc");
    if (limit) {
      query = query.limit(limit);
    }

    return listDocuments(query, (data) => mapIntakeSubmission(data as StoredIntakeSubmission));
  }

  async updateIntakeSubmission(
    id: string,
    updates: Parameters<CoachingRepository["updateIntakeSubmission"]>[1],
  ): Promise<IntakeSubmission> {
    const ref = this.intakeSubmissions().doc(id);
    await ref.update(
      stripUndefined({
        ...updates,
        submittedAt: toFirestoreDate(updates.submittedAt),
        updatedAt: new Date(),
      }),
    );

    return this.requireIntakeSubmission(id);
  }

  async createClientProfile(input: CreateClientProfileInput): Promise<ClientProfile> {
    const existing = await this.getClientProfileBySubmissionId(input.intakeSubmissionId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const ref = this.documentRef(this.clientProfiles(), input.id);
    const data = stripUndefined({
      id: ref.id,
      userId: input.userId,
      intakeSubmissionId: input.intakeSubmissionId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      status: input.status ?? "lead",
      startDate: toFirestoreDate(input.startDate),
      nextFollowUpDate: toFirestoreDate(input.nextFollowUpDate),
      checkInCadence: input.checkInCadence,
      coachNotes: input.coachNotes,
      internalTags: input.internalTags ?? [],
      priority: input.priority ?? "normal",
      planImageUrls: input.planImageUrls ?? [],
      progressPhotoUrls: input.progressPhotoUrls ?? [],
      planImages: input.planImages ?? [],
      progressPhotos: input.progressPhotos ?? [],
      currentPlanPhase: input.currentPlanPhase,
      measurementsSummary: input.measurementsSummary,
      currentWeight: input.currentWeight,
      targetWeight: input.targetWeight,
      height: input.height,
      measurementNotes: input.measurementNotes,
      trainingDaysPerWeek: input.trainingDaysPerWeek,
      preferredTrainingDays: input.preferredTrainingDays ?? [],
      sessionLengthMinutes: input.sessionLengthMinutes,
      nutritionFocus: input.nutritionFocus,
      sleepFocus: input.sleepFocus,
      stressLevel: input.stressLevel,
      injuryFlags: input.injuryFlags,
      medicationFlags: input.medicationFlags,
      motivationStyle: input.motivationStyle,
      accountabilityPreference: input.accountabilityPreference,
      lastCheckInDate: toFirestoreDate(input.lastCheckInDate),
      nextCheckInDate: toFirestoreDate(input.nextCheckInDate),
      lastPlanUpdateDate: toFirestoreDate(input.lastPlanUpdateDate),
      renewalDate: toFirestoreDate(input.renewalDate),
      paymentStatus: input.paymentStatus,
      createdAt: now,
      updatedAt: now,
    });

    await ref.set(data);

    return mapClientProfile(data as StoredClientProfile);
  }

  async getClientProfile(id: string): Promise<ClientProfile | null> {
    const snapshot = await this.clientProfiles().doc(id).get();

    return snapshot.exists ? mapClientProfile(snapshot.data() as StoredClientProfile) : null;
  }

  async getClientProfileBySubmissionId(intakeSubmissionId: string): Promise<ClientProfile | null> {
    const snapshot = await this.clientProfiles()
      .where("intakeSubmissionId", "==", intakeSubmissionId)
      .limit(1)
      .get();
    const [profile] = snapshot.docs;

    return profile ? mapClientProfile(profile.data() as StoredClientProfile) : null;
  }

  async listClientProfiles(options: ListByUserOptions): Promise<ClientProfile[]> {
    return listDocuments(this.byUser(this.clientProfiles(), options), (data) =>
      mapClientProfile(data as StoredClientProfile),
    );
  }

  async listAllClientProfiles(limit?: number): Promise<ClientProfile[]> {
    let query: Query<DocumentData> = this.clientProfiles().orderBy("createdAt", "desc");
    if (limit) {
      query = query.limit(limit);
    }

    return listDocuments(query, (data) => mapClientProfile(data as StoredClientProfile));
  }

  async updateClientProfile(id: string, updates: UpdateClientProfileInput): Promise<ClientProfile> {
    const ref = this.clientProfiles().doc(id);
    await ref.update(
      stripUndefined({
        ...updates,
        startDate: toFirestoreDate(updates.startDate),
        nextFollowUpDate: toFirestoreDate(updates.nextFollowUpDate),
        lastCheckInDate: toFirestoreDate(updates.lastCheckInDate),
        nextCheckInDate: toFirestoreDate(updates.nextCheckInDate),
        lastPlanUpdateDate: toFirestoreDate(updates.lastPlanUpdateDate),
        renewalDate: toFirestoreDate(updates.renewalDate),
        updatedAt: new Date(),
      }),
    );

    return this.requireClientProfile(id);
  }

  async createCoachingPlan(input: CreateCoachingPlanInput): Promise<CoachingPlan> {
    const now = new Date();
    const ref = this.documentRef(this.plans(), input.id);
    const data = stripUndefined({
      id: ref.id,
      userId: input.userId,
      intakeSubmissionId: input.intakeSubmissionId,
      status: input.status ?? "queued",
      plan: input.plan,
      agentOutputs: input.agentOutputs,
      createdAt: now,
      updatedAt: now,
      publishedAt: toFirestoreDate(input.publishedAt),
    });

    await ref.set(data);

    return mapCoachingPlan(data as StoredCoachingPlan);
  }

  async getCoachingPlan(id: string): Promise<CoachingPlan | null> {
    const snapshot = await this.plans().doc(id).get();

    return snapshot.exists ? mapCoachingPlan(snapshot.data() as StoredCoachingPlan) : null;
  }

  async listCoachingPlans(options: ListByUserOptions): Promise<CoachingPlan[]> {
    return listDocuments(this.byUser(this.plans(), options), (data) =>
      mapCoachingPlan(data as StoredCoachingPlan),
    );
  }

  async updateCoachingPlan(
    id: string,
    updates: Parameters<CoachingRepository["updateCoachingPlan"]>[1],
  ): Promise<CoachingPlan> {
    const ref = this.plans().doc(id);
    await ref.update(
      stripUndefined({
        ...updates,
        publishedAt: toFirestoreDate(updates.publishedAt),
        updatedAt: new Date(),
      }),
    );

    return this.requireCoachingPlan(id);
  }

  async getReviewState(planId: string): Promise<ReviewState | null> {
    const snapshot = await this.reviewStates().where("planId", "==", planId).limit(1).get();
    const [reviewState] = snapshot.docs;

    return reviewState ? mapReviewState(reviewState.data() as StoredReviewState) : null;
  }

  async upsertReviewState(input: UpsertReviewStateInput): Promise<ReviewState> {
    const existing = await this.getReviewState(input.planId);
    const now = new Date();
    const ref = this.documentRef(this.reviewStates(), input.id ?? existing?.id);
    const data = stripUndefined({
      id: ref.id,
      userId: input.userId,
      planId: input.planId,
      status: input.status,
      notes: input.notes,
      reviewerId: input.reviewerId,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    });

    await ref.set(data, { merge: true });

    return mapReviewState(data as StoredReviewState);
  }

  async createCoachingExport(input: CreateCoachingExportInput): Promise<CoachingExport> {
    const now = new Date();
    const ref = this.documentRef(this.exports(), input.id);
    const data = stripUndefined({
      id: ref.id,
      userId: input.userId,
      planId: input.planId,
      type: input.type,
      status: input.status ?? "queued",
      storagePath: input.storagePath,
      downloadUrl: input.downloadUrl,
      createdAt: now,
      updatedAt: now,
      expiresAt: toFirestoreDate(input.expiresAt),
    });

    await ref.set(data);

    return mapCoachingExport(data as StoredCoachingExport);
  }

  async getCoachingExport(id: string): Promise<CoachingExport | null> {
    const snapshot = await this.exports().doc(id).get();

    return snapshot.exists ? mapCoachingExport(snapshot.data() as StoredCoachingExport) : null;
  }

  async listCoachingExports(options: ListByUserOptions): Promise<CoachingExport[]> {
    return listDocuments(this.byUser(this.exports(), options), (data) =>
      mapCoachingExport(data as StoredCoachingExport),
    );
  }

  async updateCoachingExport(
    id: string,
    updates: Parameters<CoachingRepository["updateCoachingExport"]>[1],
  ): Promise<CoachingExport> {
    const ref = this.exports().doc(id);
    await ref.update(
      stripUndefined({
        ...updates,
        expiresAt: toFirestoreDate(updates.expiresAt),
        updatedAt: new Date(),
      }),
    );

    return this.requireCoachingExport(id);
  }

  private intakeSubmissions(): CollectionReference<DocumentData> {
    return this.db.collection(COLLECTIONS.intakeSubmissions);
  }

  private clientProfiles(): CollectionReference<DocumentData> {
    return this.db.collection(COLLECTIONS.clientProfiles);
  }

  private plans(): CollectionReference<DocumentData> {
    return this.db.collection(COLLECTIONS.plans);
  }

  private reviewStates(): CollectionReference<DocumentData> {
    return this.db.collection(COLLECTIONS.reviewStates);
  }

  private exports(): CollectionReference<DocumentData> {
    return this.db.collection(COLLECTIONS.exports);
  }

  private documentRef(collection: CollectionReference<DocumentData>, id?: string) {
    return id ? collection.doc(id) : collection.doc();
  }

  private byUser(
    collection: CollectionReference<DocumentData>,
    options: ListByUserOptions,
  ): Query<DocumentData> {
    let query = collection.where("userId", "==", options.userId).orderBy("createdAt", "desc");

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  private async requireIntakeSubmission(id: string): Promise<IntakeSubmission> {
    const record = await this.getIntakeSubmission(id);

    if (!record) {
      throw new Error(`Intake submission ${id} does not exist.`);
    }

    return record;
  }

  private async requireClientProfile(id: string): Promise<ClientProfile> {
    const record = await this.getClientProfile(id);

    if (!record) {
      throw new Error(`Client profile ${id} does not exist.`);
    }

    return record;
  }

  private async requireCoachingPlan(id: string): Promise<CoachingPlan> {
    const record = await this.getCoachingPlan(id);

    if (!record) {
      throw new Error(`Coaching plan ${id} does not exist.`);
    }

    return record;
  }

  private async requireCoachingExport(id: string): Promise<CoachingExport> {
    const record = await this.getCoachingExport(id);

    if (!record) {
      throw new Error(`Coaching export ${id} does not exist.`);
    }

    return record;
  }
}

export function createFirebaseCoachingRepository(db?: Firestore): CoachingRepository {
  return new FirebaseCoachingRepository(db);
}
