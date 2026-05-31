import { NextResponse } from "next/server";

import { handleRouteError, requireAdminAccess } from "@/lib/coaching/api/routeUtils";
import { generateCoachingPlan } from "@/lib/coaching/orchestration/generateCoachingPlan";
import { coachingIntakeSchema, type CoachingIntake } from "@/lib/coaching/schemas/intakeSchema";

export const runtime = "nodejs";

const ROUTE_NAME = "POST /api/coaching/test-orchestration";

function noAnswer() {
  return { answer: "no", explanation: "" };
}

function createSafeFakeIntake(): CoachingIntake {
  return coachingIntakeSchema.parse({
    fullName: "Internal Test Client",
    name: "Internal Test Client",
    email: "orchestration-test@example.com",
    age: 35,
    sex: "prefer_not_to_say",
    mainGoal: "muscle_gain",
    goals: ["muscle_gain", "strength"],
    specificGoalDescription:
      "Build muscle and consistency with three gym sessions per week while respecting mild non-red-flag shoulder sensitivity.",
    secondaryGoals: ["strength", "energy"],
    desiredOutcome: "A safe starter plan with clear progression and recovery guidance.",
    trainingLevel: "intermediate",
    availableDaysPerWeek: 3,
    sessionDurationMinutes: 60,
    trainingLocation: "gym",
    equipmentAvailable: ["full_gym", "dumbbells", "machines"],
    currentWeeklyActivity: "Two light gym sessions most weeks.",
    exercisesThatCausePain: "Mild shoulder irritation with heavy overhead pressing.",
    diagnosedHeartConditionAndOnlySupervisedActivity: noAnswer(),
    bloodPressureOrHeartMedication: noAnswer(),
    chestPainDuringActivity: noAnswer(),
    dizzinessOrLossOfConsciousnessLast12Months: noAnswer(),
    boneJointSoftTissueProblemAggravatedByActivity: noAnswer(),
    chestPainLast30Days: noAnswer(),
    otherReasonNotToExercise: noAnswer(),
    smoking: "no",
    sleepHours: "five_to_seven",
    sleepQuality: "average",
    energyLevel: "moderate",
    consistencyChallenges: ["lack_of_time", "work_schedule"],
    currentNutritionBehavior: "Generally balanced meals; protein consistency could improve.",
    dietaryRestrictions: "None reported.",
    privacyPolicyAccepted: true,
    termsAndConditionsAccepted: true,
    orchestrationMode: "test",
    safetyStatus: "clear",
    clientProfile: {
      name: "Internal Test Client",
      email: "orchestration-test@example.com",
      age: 35,
      trainingExperience: "intermediate",
      goals: ["muscle_gain", "strength"],
      primaryGoal: "muscle_gain",
      goalDescription:
        "Build muscle and consistency with three gym sessions per week while respecting mild shoulder sensitivity.",
      availability: "3 days per week, 60 minute sessions",
      equipment: ["full_gym", "dumbbells", "machines"],
      constraints: ["Mild shoulder irritation with heavy overhead pressing."],
      safetySignals: [],
      safetyStatus: "clear",
      nutritionSignals: ["Protein consistency could improve."],
      missingInformation: [],
      coachSummary: "Internal orchestration smoke-test fixture only.",
    },
  });
}

export async function POST(request: Request) {
  try {
    requireAdminAccess(request);

    const generated = await generateCoachingPlan({
      intakePayload: createSafeFakeIntake(),
      mode: "test",
    });

    const finalContent = generated.plan.content;
    const intakeCompression = generated.agentOutputs.intakeCompression as
      | { provider?: string; model?: string }
      | undefined;
    const finalModerator = generated.agentOutputs.finalModerator as
      | { provider?: string; model?: string }
      | undefined;
    const completedSteps = [
      intakeCompression ? "intake_compression" : undefined,
      ...(generated.agentOutputs.expertOutputs ?? []).map((output) => output.step),
      generated.agentOutputs.panelBrief ? "panel_brief" : undefined,
      finalModerator ? "final_moderator" : undefined,
    ].filter((step): step is string => Boolean(step));

    const providerModelsUsed = {
      intakeCompression: intakeCompression
        ? {
            provider: intakeCompression.provider,
            model: intakeCompression.model,
          }
        : undefined,
      experts: (generated.agentOutputs.expertOutputs ?? []).map((output) => ({
        step: output.step,
        provider: output.provider,
        model: output.model,
      })),
      finalModerator: generated.plan.finalModerator,
    };

    return NextResponse.json({
      success: true,
      route: generated.agentOutputs.routing,
      providerModelsUsed,
      completedSteps,
      validation: {
        intake: "passed",
        expertOutputs: "passed",
        panelBrief: generated.agentOutputs.panelBrief ? "passed" : "missing",
        finalPlan: "passed",
      },
      finalPlanKeys: Object.keys(finalContent),
      finalModerator: generated.plan.finalModerator,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No AI route succeeded")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_ROUTE_FAILED",
            message: `AI generation failed because no provider route succeeded. ${error.message}`,
          },
          completedSteps: [],
          validation: { finalPlan: "not_run" },
        },
        { status: 500 },
      );
    }

    return handleRouteError(error, {
      route: ROUTE_NAME,
      operation: "test_orchestration",
      metadata: { fixture: "safe_fake_intake", mode: "test" },
    });
  }
}
