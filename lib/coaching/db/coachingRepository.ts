export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type CoachingRecordStatus = "draft" | "queued" | "running" | "ready" | "failed" | "archived";

export type IntakeSubmission = {
  id: string;
  userId: string;
  status: CoachingRecordStatus;
  payload: JsonObject;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
};

export type CoachingPlan = {
  id: string;
  userId: string;
  intakeSubmissionId: string;
  status: CoachingRecordStatus;
  plan: JsonObject;
  agentOutputs?: JsonObject;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
};

export type ReviewStatus = "not_started" | "in_review" | "approved" | "changes_requested";

export type ReviewState = {
  id: string;
  userId: string;
  planId: string;
  status: ReviewStatus;
  notes?: string;
  reviewerId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ExportType = "pdf" | "json";
export type ExportStatus = "queued" | "running" | "ready" | "failed" | "expired";

export type CoachingExport = {
  id: string;
  userId: string;
  planId: string;
  type: ExportType;
  status: ExportStatus;
  storagePath?: string;
  downloadUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
};

export type CreateIntakeSubmissionInput = {
  id?: string;
  userId: string;
  status?: CoachingRecordStatus;
  payload: JsonObject;
  submittedAt?: Date;
};

export type CreateCoachingPlanInput = {
  id?: string;
  userId: string;
  intakeSubmissionId: string;
  status?: CoachingRecordStatus;
  plan: JsonObject;
  agentOutputs?: JsonObject;
  publishedAt?: Date;
};

export type UpsertReviewStateInput = {
  id?: string;
  userId: string;
  planId: string;
  status: ReviewStatus;
  notes?: string;
  reviewerId?: string;
};

export type CreateCoachingExportInput = {
  id?: string;
  userId: string;
  planId: string;
  type: ExportType;
  status?: ExportStatus;
  storagePath?: string;
  downloadUrl?: string;
  expiresAt?: Date;
};

export type ListByUserOptions = {
  userId: string;
  limit?: number;
};

export interface CoachingRepository {
  createIntakeSubmission(input: CreateIntakeSubmissionInput): Promise<IntakeSubmission>;
  getIntakeSubmission(id: string): Promise<IntakeSubmission | null>;
  listIntakeSubmissions(options: ListByUserOptions): Promise<IntakeSubmission[]>;
  updateIntakeSubmission(
    id: string,
    updates: Partial<Pick<IntakeSubmission, "payload" | "status" | "submittedAt">>,
  ): Promise<IntakeSubmission>;

  createCoachingPlan(input: CreateCoachingPlanInput): Promise<CoachingPlan>;
  getCoachingPlan(id: string): Promise<CoachingPlan | null>;
  listCoachingPlans(options: ListByUserOptions): Promise<CoachingPlan[]>;
  updateCoachingPlan(
    id: string,
    updates: Partial<Pick<CoachingPlan, "agentOutputs" | "plan" | "publishedAt" | "status">>,
  ): Promise<CoachingPlan>;

  getReviewState(planId: string): Promise<ReviewState | null>;
  upsertReviewState(input: UpsertReviewStateInput): Promise<ReviewState>;

  createCoachingExport(input: CreateCoachingExportInput): Promise<CoachingExport>;
  getCoachingExport(id: string): Promise<CoachingExport | null>;
  listCoachingExports(options: ListByUserOptions): Promise<CoachingExport[]>;
  updateCoachingExport(
    id: string,
    updates: Partial<Pick<CoachingExport, "downloadUrl" | "expiresAt" | "status" | "storagePath">>,
  ): Promise<CoachingExport>;
}
