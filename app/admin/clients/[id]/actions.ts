"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import type {
  ClientProfilePriority,
  ClientProfileStatus,
  UpdateClientProfileInput,
} from "@/lib/coaching/db/coachingRepository";

export type ClientCrmFormState = {
  ok: boolean;
  message: string;
};

const STATUSES: ClientProfileStatus[] = ["lead", "active", "paused", "completed", "archived"];
const PRIORITIES: ClientProfilePriority[] = ["low", "normal", "high", "urgent"];

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalDate(formData: FormData, key: string): Date | undefined {
  const value = optionalString(formData, key);
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export async function updateClientCrmProfile(
  profileId: string,
  _previousState: ClientCrmFormState,
  formData: FormData,
): Promise<ClientCrmFormState> {
  await requireAdminPage(`/admin/clients/${profileId}`);

  try {
    const status = formData.get("status");
    const priority = formData.get("priority");
    if (!STATUSES.includes(status as ClientProfileStatus)) {
      return { ok: false, message: "Choose a valid client status." };
    }
    if (!PRIORITIES.includes(priority as ClientProfilePriority)) {
      return { ok: false, message: "Choose a valid priority." };
    }

    const updates: UpdateClientProfileInput = {
      status: status as ClientProfileStatus,
      startDate: optionalDate(formData, "startDate"),
      nextFollowUpDate: optionalDate(formData, "nextFollowUpDate"),
      checkInCadence: optionalString(formData, "checkInCadence"),
      coachNotes: optionalString(formData, "coachNotes"),
      internalTags: (optionalString(formData, "internalTags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      priority: priority as ClientProfilePriority,
      currentPlanPhase: optionalString(formData, "currentPlanPhase"),
      measurementsSummary: optionalString(formData, "measurementsSummary"),
    };

    await createCoachingRepository().updateClientProfile(profileId, updates);
    revalidatePath(`/admin/clients/${profileId}`);
    revalidatePath("/admin/clients");
    return { ok: true, message: "Client CRM details saved." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Client CRM details could not be saved.",
    };
  }
}
