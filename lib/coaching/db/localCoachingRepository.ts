import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  ClientProfile,
  CoachingExport,
  CoachingPlan,
  CoachingRepository,
  CreateCoachingExportInput,
  CreateCoachingPlanInput,
  CreateIntakeSubmissionInput,
  CreateClientProfileInput,
  IntakeSubmission,
  ListByUserOptions,
  ReviewState,
  UpdateClientProfileInput,
  UpsertReviewStateInput,
} from "./coachingRepository";

const DEFAULT_STORE_DIRECTORY = process.env.VERCEL
  ? os.tmpdir()
  : path.join(process.cwd(), ".data");
const DEFAULT_STORE_PATH = path.join(DEFAULT_STORE_DIRECTORY, "coaching-repository.json");

let memoryFallbackStore: LocalStore | undefined;

type Serialized = Record<string, unknown>;

type LocalStore = {
  intakeSubmissions: Record<string, Serialized>;
  clientProfiles: Record<string, Serialized>;
  coachingPlans: Record<string, Serialized>;
  reviewStates: Record<string, Serialized>;
  coachingExports: Record<string, Serialized>;
};

function isFilePersistenceUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return ["EACCES", "ENOENT", "EPERM", "EROFS"].includes(String(error.code));
}

function cloneStore(store: LocalStore): LocalStore {
  return structuredClone(store) as LocalStore;
}

function emptyStore(): LocalStore {
  return {
    intakeSubmissions: {},
    clientProfiles: {},
    coachingPlans: {},
    reviewStates: {},
    coachingExports: {},
  };
}

function dateFrom(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  return typeof value === "string" ? new Date(value) : undefined;
}

function withOptional<T extends object, K extends string, V>(
  key: K,
  value: V | undefined,
): T | Record<K, V> {
  return value === undefined ? ({} as T) : ({ [key]: value } as Record<K, V>);
}

function serializeDate(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

function serializeIntakeSubmission(submission: IntakeSubmission): Serialized {
  return {
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    ...withOptional("submittedAt", serializeDate(submission.submittedAt)),
  };
}

function hydrateIntakeSubmission(submission: Serialized): IntakeSubmission {
  return {
    ...submission,
    createdAt: dateFrom(submission.createdAt) ?? new Date(0),
    updatedAt: dateFrom(submission.updatedAt) ?? new Date(0),
    submittedAt: dateFrom(submission.submittedAt),
  } as IntakeSubmission;
}

function hydrateClientAsset(asset: unknown): import("./coachingRepository").ClientAsset {
  const value = asset && typeof asset === "object" ? (asset as Record<string, unknown>) : {};
  return {
    id: String(value.id ?? ""),
    url: String(value.url ?? ""),
    storagePath: String(value.storagePath ?? ""),
    label: String(value.label ?? "Client image"),
    uploadedAt: dateFrom(value.uploadedAt) ?? new Date(0),
  };
}

function serializeClientProfile(profile: ClientProfile): Serialized {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    ...withOptional("startDate", serializeDate(profile.startDate)),
    ...withOptional("nextFollowUpDate", serializeDate(profile.nextFollowUpDate)),
  };
}

function hydrateClientProfile(profile: Serialized): ClientProfile {
  return {
    ...profile,
    internalTags: Array.isArray(profile.internalTags) ? profile.internalTags : [],
    planImageUrls: Array.isArray(profile.planImageUrls) ? profile.planImageUrls : [],
    progressPhotoUrls: Array.isArray(profile.progressPhotoUrls) ? profile.progressPhotoUrls : [],
    planImages: Array.isArray(profile.planImages) ? profile.planImages.map(hydrateClientAsset) : [],
    progressPhotos: Array.isArray(profile.progressPhotos)
      ? profile.progressPhotos.map(hydrateClientAsset)
      : [],
    createdAt: dateFrom(profile.createdAt) ?? new Date(0),
    updatedAt: dateFrom(profile.updatedAt) ?? new Date(0),
    startDate: dateFrom(profile.startDate),
    nextFollowUpDate: dateFrom(profile.nextFollowUpDate),
  } as ClientProfile;
}

function serializeCoachingPlan(plan: CoachingPlan): Serialized {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    ...withOptional("publishedAt", serializeDate(plan.publishedAt)),
  };
}

function hydrateCoachingPlan(plan: Serialized): CoachingPlan {
  return {
    ...plan,
    createdAt: dateFrom(plan.createdAt) ?? new Date(0),
    updatedAt: dateFrom(plan.updatedAt) ?? new Date(0),
    publishedAt: dateFrom(plan.publishedAt),
  } as CoachingPlan;
}

function serializeReviewState(reviewState: ReviewState): Serialized {
  return {
    ...reviewState,
    createdAt: reviewState.createdAt.toISOString(),
    updatedAt: reviewState.updatedAt.toISOString(),
  };
}

function hydrateReviewState(reviewState: Serialized): ReviewState {
  return {
    ...reviewState,
    createdAt: dateFrom(reviewState.createdAt) ?? new Date(0),
    updatedAt: dateFrom(reviewState.updatedAt) ?? new Date(0),
  } as ReviewState;
}

function serializeCoachingExport(coachingExport: CoachingExport): Serialized {
  return {
    ...coachingExport,
    createdAt: coachingExport.createdAt.toISOString(),
    updatedAt: coachingExport.updatedAt.toISOString(),
    ...withOptional("expiresAt", serializeDate(coachingExport.expiresAt)),
  };
}

function hydrateCoachingExport(coachingExport: Serialized): CoachingExport {
  return {
    ...coachingExport,
    createdAt: dateFrom(coachingExport.createdAt) ?? new Date(0),
    updatedAt: dateFrom(coachingExport.updatedAt) ?? new Date(0),
    expiresAt: dateFrom(coachingExport.expiresAt),
  } as CoachingExport;
}

function sortByCreatedAtDesc<T extends { createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function limitResults<T>(items: T[], limit: number | undefined): T[] {
  return limit ? items.slice(0, limit) : items;
}

export class LocalFileCoachingRepository implements CoachingRepository {
  constructor(
    private readonly storePath: string = process.env.COACHING_LOCAL_STORE_PATH ??
      DEFAULT_STORE_PATH,
  ) {}

  async createIntakeSubmission(input: CreateIntakeSubmissionInput): Promise<IntakeSubmission> {
    return this.updateStore((store) => {
      const now = new Date();
      const submission: IntakeSubmission = {
        id: input.id ?? randomUUID(),
        userId: input.userId,
        status: input.status ?? "draft",
        payload: input.payload,
        createdAt: now,
        updatedAt: now,
        ...withOptional("submittedAt", input.submittedAt),
      };

      store.intakeSubmissions[submission.id] = serializeIntakeSubmission(submission);
      return submission;
    });
  }

  async getIntakeSubmission(id: string): Promise<IntakeSubmission | null> {
    const store = await this.loadStore();
    const submission = store.intakeSubmissions[id];

    return submission ? hydrateIntakeSubmission(submission) : null;
  }

  async listIntakeSubmissions(options: ListByUserOptions): Promise<IntakeSubmission[]> {
    const store = await this.loadStore();
    const submissions = Object.values(store.intakeSubmissions)
      .map(hydrateIntakeSubmission)
      .filter((submission) => submission.userId === options.userId);

    return limitResults(sortByCreatedAtDesc(submissions), options.limit);
  }

  async listAllIntakeSubmissions(limit?: number): Promise<IntakeSubmission[]> {
    const store = await this.loadStore();
    const submissions = Object.values(store.intakeSubmissions).map(hydrateIntakeSubmission);

    return limitResults(sortByCreatedAtDesc(submissions), limit);
  }

  async updateIntakeSubmission(
    id: string,
    updates: Parameters<CoachingRepository["updateIntakeSubmission"]>[1],
  ): Promise<IntakeSubmission> {
    return this.updateStore((store) => {
      const existing = store.intakeSubmissions[id];
      if (!existing) {
        throw new Error(`Intake submission ${id} does not exist.`);
      }

      const updated = {
        ...hydrateIntakeSubmission(existing),
        ...updates,
        updatedAt: new Date(),
      };
      store.intakeSubmissions[id] = serializeIntakeSubmission(updated);
      return updated;
    });
  }

  async createClientProfile(input: CreateClientProfileInput): Promise<ClientProfile> {
    return this.updateStore((store) => {
      const now = new Date();
      const existing = Object.values(store.clientProfiles)
        .map(hydrateClientProfile)
        .find((profile) => profile.intakeSubmissionId === input.intakeSubmissionId);
      if (existing) {
        return existing;
      }

      const profile: ClientProfile = {
        id: input.id ?? randomUUID(),
        userId: input.userId,
        intakeSubmissionId: input.intakeSubmissionId,
        fullName: input.fullName,
        email: input.email,
        ...withOptional("phone", input.phone),
        status: input.status ?? "lead",
        ...withOptional("startDate", input.startDate),
        ...withOptional("nextFollowUpDate", input.nextFollowUpDate),
        ...withOptional("checkInCadence", input.checkInCadence),
        ...withOptional("coachNotes", input.coachNotes),
        internalTags: input.internalTags ?? [],
        priority: input.priority ?? "normal",
        planImageUrls: input.planImageUrls ?? [],
        progressPhotoUrls: input.progressPhotoUrls ?? [],
        planImages: input.planImages ?? [],
        progressPhotos: input.progressPhotos ?? [],
        ...withOptional("currentPlanPhase", input.currentPlanPhase),
        ...withOptional("measurementsSummary", input.measurementsSummary),
        createdAt: now,
        updatedAt: now,
      };

      store.clientProfiles[profile.id] = serializeClientProfile(profile);
      return profile;
    });
  }

  async getClientProfile(id: string): Promise<ClientProfile | null> {
    const store = await this.loadStore();
    const profile = store.clientProfiles[id];

    return profile ? hydrateClientProfile(profile) : null;
  }

  async getClientProfileBySubmissionId(intakeSubmissionId: string): Promise<ClientProfile | null> {
    const store = await this.loadStore();
    const profile = Object.values(store.clientProfiles)
      .map(hydrateClientProfile)
      .find((candidate) => candidate.intakeSubmissionId === intakeSubmissionId);

    return profile ?? null;
  }

  async listClientProfiles(options: ListByUserOptions): Promise<ClientProfile[]> {
    const store = await this.loadStore();
    const profiles = Object.values(store.clientProfiles)
      .map(hydrateClientProfile)
      .filter((profile) => profile.userId === options.userId);

    return limitResults(sortByCreatedAtDesc(profiles), options.limit);
  }

  async listAllClientProfiles(limit?: number): Promise<ClientProfile[]> {
    const store = await this.loadStore();
    const profiles = Object.values(store.clientProfiles).map(hydrateClientProfile);

    return limitResults(sortByCreatedAtDesc(profiles), limit);
  }

  async updateClientProfile(id: string, updates: UpdateClientProfileInput): Promise<ClientProfile> {
    return this.updateStore((store) => {
      const existing = store.clientProfiles[id];
      if (!existing) {
        throw new Error(`Client profile ${id} does not exist.`);
      }

      const updated = {
        ...hydrateClientProfile(existing),
        ...updates,
        updatedAt: new Date(),
      } as ClientProfile;
      store.clientProfiles[id] = serializeClientProfile(updated);
      return updated;
    });
  }

  async createCoachingPlan(input: CreateCoachingPlanInput): Promise<CoachingPlan> {
    return this.updateStore((store) => {
      const now = new Date();
      const plan = {
        id: input.id ?? randomUUID(),
        userId: input.userId,
        intakeSubmissionId: input.intakeSubmissionId,
        status: input.status ?? "queued",
        plan: input.plan,
        ...(input.agentOutputs ? { agentOutputs: input.agentOutputs } : {}),
        createdAt: now,
        updatedAt: now,
        ...(input.publishedAt ? { publishedAt: input.publishedAt } : {}),
      } as CoachingPlan;

      store.coachingPlans[plan.id] = serializeCoachingPlan(plan);
      return plan;
    });
  }

  async getCoachingPlan(id: string): Promise<CoachingPlan | null> {
    const store = await this.loadStore();
    const plan = store.coachingPlans[id];

    return plan ? hydrateCoachingPlan(plan) : null;
  }

  async listCoachingPlans(options: ListByUserOptions): Promise<CoachingPlan[]> {
    const store = await this.loadStore();
    const plans = Object.values(store.coachingPlans)
      .map(hydrateCoachingPlan)
      .filter((plan) => plan.userId === options.userId);

    return limitResults(sortByCreatedAtDesc(plans), options.limit);
  }

  async updateCoachingPlan(
    id: string,
    updates: Parameters<CoachingRepository["updateCoachingPlan"]>[1],
  ): Promise<CoachingPlan> {
    return this.updateStore((store) => {
      const existing = store.coachingPlans[id];
      if (!existing) {
        throw new Error(`Coaching plan ${id} does not exist.`);
      }

      const updated = {
        ...hydrateCoachingPlan(existing),
        ...updates,
        updatedAt: new Date(),
      } as CoachingPlan;
      store.coachingPlans[id] = serializeCoachingPlan(updated);
      return updated;
    });
  }

  async getReviewState(planId: string): Promise<ReviewState | null> {
    const store = await this.loadStore();
    const reviewState = Object.values(store.reviewStates)
      .map(hydrateReviewState)
      .find((candidate) => candidate.planId === planId);

    return reviewState ?? null;
  }

  async upsertReviewState(input: UpsertReviewStateInput): Promise<ReviewState> {
    return this.updateStore((store) => {
      const existing = Object.values(store.reviewStates)
        .map(hydrateReviewState)
        .find((candidate) => candidate.planId === input.planId);
      const now = new Date();
      const reviewState: ReviewState = {
        id: input.id ?? existing?.id ?? randomUUID(),
        userId: input.userId,
        planId: input.planId,
        status: input.status,
        ...withOptional("notes", input.notes),
        ...withOptional("reviewerId", input.reviewerId),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      store.reviewStates[reviewState.id] = serializeReviewState(reviewState);
      return reviewState;
    });
  }

  async createCoachingExport(input: CreateCoachingExportInput): Promise<CoachingExport> {
    return this.updateStore((store) => {
      const now = new Date();
      const coachingExport: CoachingExport = {
        id: input.id ?? randomUUID(),
        userId: input.userId,
        planId: input.planId,
        type: input.type,
        status: input.status ?? "queued",
        ...(input.storagePath ? { storagePath: input.storagePath } : {}),
        ...(input.downloadUrl ? { downloadUrl: input.downloadUrl } : {}),
        createdAt: now,
        updatedAt: now,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      };

      store.coachingExports[coachingExport.id] = serializeCoachingExport(coachingExport);
      return coachingExport;
    });
  }

  async getCoachingExport(id: string): Promise<CoachingExport | null> {
    const store = await this.loadStore();
    const coachingExport = store.coachingExports[id];

    return coachingExport ? hydrateCoachingExport(coachingExport) : null;
  }

  async listCoachingExports(options: ListByUserOptions): Promise<CoachingExport[]> {
    const store = await this.loadStore();
    const exports = Object.values(store.coachingExports)
      .map(hydrateCoachingExport)
      .filter((coachingExport) => coachingExport.userId === options.userId);

    return limitResults(sortByCreatedAtDesc(exports), options.limit);
  }

  async updateCoachingExport(
    id: string,
    updates: Parameters<CoachingRepository["updateCoachingExport"]>[1],
  ): Promise<CoachingExport> {
    return this.updateStore((store) => {
      const existing = store.coachingExports[id];
      if (!existing) {
        throw new Error(`Coaching export ${id} does not exist.`);
      }

      const updated = {
        ...hydrateCoachingExport(existing),
        ...updates,
        updatedAt: new Date(),
      } as CoachingExport;
      store.coachingExports[id] = serializeCoachingExport(updated);
      return updated;
    });
  }

  private async loadStore(): Promise<LocalStore> {
    if (memoryFallbackStore) {
      return cloneStore(memoryFallbackStore);
    }

    try {
      const rawStore = await readFile(this.storePath, "utf8");
      return { ...emptyStore(), ...(JSON.parse(rawStore) as Partial<LocalStore>) };
    } catch (error) {
      if (isFilePersistenceUnavailable(error)) {
        return emptyStore();
      }

      throw error;
    }
  }

  private async saveStore(store: LocalStore): Promise<void> {
    try {
      await mkdir(path.dirname(this.storePath), { recursive: true });
      const temporaryPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await rename(temporaryPath, this.storePath);
      memoryFallbackStore = undefined;
    } catch (error) {
      if (isFilePersistenceUnavailable(error)) {
        memoryFallbackStore = cloneStore(store);
        return;
      }

      throw error;
    }
  }

  private async updateStore<T>(updater: (store: LocalStore) => T): Promise<T> {
    const store = await this.loadStore();
    const result = updater(store);
    await this.saveStore(store);
    return result;
  }
}
