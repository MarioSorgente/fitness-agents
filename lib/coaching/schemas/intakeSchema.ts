import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(10_000).optional(),
);
const requiredString = z.string().trim().min(1).max(10_000);
const optionalDateString = optionalString;
const yesNoSchema = z.enum(["yes", "no"]);
const optionalYesNoSchema = yesNoSchema.optional();
const yesNoWithExplanationSchema = z.object({
  answer: yesNoSchema.optional(),
  explanation: optionalString,
});
const requiredYesNoWithExplanationSchema = z.object({
  answer: yesNoSchema,
  explanation: optionalString,
});
const familyHistorySchema = z.object({
  hasFamilyHistory: optionalYesNoSchema,
  familyMember: optionalString,
  notes: optionalString,
});
const cardiovascularHistorySchema = z.object({
  answer: yesNoSchema.optional(),
  explanation: optionalString,
  dateOfDiagnosis: optionalDateString,
});
const medicationSchema = z.object({
  medicationName: optionalString,
  dosage: optionalString,
  frequency: optionalString,
  conditionOrReason: optionalString,
});
const diagnosedConditionSchema = z.object({
  conditionName: optionalString,
  dateOfDiagnosis: optionalDateString,
  notes: optionalString,
});
const painAreaSchema = z.object({
  area: optionalString,
  currentlyHasPain: optionalYesNoSchema,
  hadPainPreviously: optionalYesNoSchema,
  severity: z.coerce.number().min(0).max(10).optional(),
  description: optionalString,
  triggers: optionalString,
  movementsThatMakeItWorse: optionalString,
  movementsThatMakeItBetter: optionalString,
  painDuringExercise: optionalString,
  diagnosisIfAny: optionalString,
  currentlyTreatingIt: optionalYesNoSchema,
  treatmentDetails: optionalString,
});
const surgerySchema = z.object({
  surgeryType: optionalString,
  bodyArea: optionalString,
  date: optionalDateString,
  currentLimitations: optionalString,
  notes: optionalString,
});
const supplementSchema = z.object({
  supplementName: optionalString,
  dosage: optionalString,
  frequency: optionalString,
  reasonForTaking: optionalString,
  recommendedBy: optionalString,
  sideEffects: optionalString,
});
const foodLogMealSchema = z.object({
  mealType: optionalString,
  foodItem: optionalString,
  brandName: optionalString,
  quantity: optionalString,
  unit: optionalString,
  timeOfDay: optionalString,
  additionalNotes: z.array(z.string()).default([]),
});
const foodLogDaySchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(3).optional(),
  date: optionalDateString,
  meals: z.array(foodLogMealSchema).default([]),
});

export const safetyStatusSchema = z.enum(["clear", "caution", "medical_clearance_recommended"]);
export type SafetyStatus = z.infer<typeof safetyStatusSchema>;

export const compactClientProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional(),
    email: z.string().trim().email().max(320).optional(),
    age: z.number().int().min(13).max(120).optional(),
    trainingExperience: z.string().trim().max(500).optional(),
    goals: z.array(z.string().trim().min(1).max(500)).default([]),
    primaryGoal: z.string().trim().max(500).optional(),
    goalDescription: z.string().trim().max(5_000).optional(),
    availability: z.string().trim().max(1_000).optional(),
    equipment: z.array(z.string().trim().min(1).max(500)).default([]),
    constraints: z.array(z.string().trim().min(1).max(1_000)).default([]),
    safetySignals: z.array(z.string().trim().min(1).max(1_000)).default([]),
    safetyStatus: safetyStatusSchema.optional(),
    nutritionSignals: z.array(z.string().trim().min(1).max(1_000)).default([]),
    missingInformation: z.array(z.string().trim().min(1).max(1_000)).default([]),
    coachSummary: z.string().trim().max(5_000).optional(),
  })
  .catchall(jsonValueSchema);

const coachingIntakeBaseSchema = z
  .object({
    // Legacy aliases remain optional for older submissions; new UI writes the canonical fields below.
    name: optionalString,
    goals: z.union([z.string(), z.array(z.string())]).optional(),
    experience: optionalString,
    daysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
    equipment: optionalString,
    limitations: optionalString,
    successCriteria: optionalString,

    fullName: requiredString,
    dateOfBirth: optionalDateString,
    age: z.coerce.number().int().min(13).max(120),
    sex: requiredString,
    email: z.string().trim().email().max(320),
    phoneNumber: optionalString,
    address: optionalString,
    city: optionalString,
    stateProvince: optionalString,
    postalCode: optionalString,
    country: optionalString,
    timezone: optionalString,
    height: optionalString,
    weight: optionalString,
    employer: optionalString,
    occupation: optionalString,
    emergencyContactName: optionalString,
    emergencyContactRelationship: optionalString,
    emergencyContactPhone: optionalString,
    emergencyContactAddress: optionalString,

    mainGoal: requiredString,
    specificGoalDescription: requiredString,
    secondaryGoals: z.array(z.string()).default([]),
    goalPriority: optionalString,
    desiredOutcome: optionalString,
    motivation: optionalString,
    biggestStruggle: optionalString,
    confidenceLevel: z.coerce.number().int().min(1).max(10).optional(),
    mentalStateAroundTraining: optionalString,
    preferredCoachingStyle: z.array(z.string()).default([]),

    trainingLevel: requiredString,
    currentWeeklyActivity: optionalString,
    usedToVigorousExercise: yesNoWithExplanationSchema.optional(),
    availableDaysPerWeek: z.coerce.number().int().min(1).max(7),
    preferredTrainingDays: z.array(z.string()).default([]),
    sessionDurationMinutes: z.union([z.coerce.number().int().min(1).max(240), z.literal("other")]),
    trainingLocation: optionalString,
    equipmentAvailable: z.array(z.string()).default([]),
    currentProgram: optionalString,
    previousCoachingExperience: optionalString,
    likedExercises: optionalString,
    dislikedExercises: optionalString,
    exercisesThatCausePain: optionalString,
    movementsThatFeelGood: optionalString,

    diagnosedHeartConditionAndOnlySupervisedActivity: requiredYesNoWithExplanationSchema,
    bloodPressureOrHeartMedication: requiredYesNoWithExplanationSchema,
    chestPainDuringActivity: requiredYesNoWithExplanationSchema,
    dizzinessOrLossOfConsciousnessLast12Months: requiredYesNoWithExplanationSchema,
    boneJointSoftTissueProblemAggravatedByActivity: requiredYesNoWithExplanationSchema,
    chestPainLast30Days: requiredYesNoWithExplanationSchema,
    otherReasonNotToExercise: requiredYesNoWithExplanationSchema,
    currentlyFeelingUnwell: yesNoWithExplanationSchema.optional(),
    pregnancyOrPossiblePregnancy: yesNoWithExplanationSchema.optional(),
    recentHealthChange: yesNoWithExplanationSchema.optional(),

    currentPhysicianName: optionalString,
    currentPhysicianPhone: optionalString,
    underCareOfHealthProfessional: yesNoWithExplanationSchema.optional(),
    medications: z.array(medicationSchema).default([]),
    allergies: optionalString,
    diagnosedHighBloodPressure: yesNoWithExplanationSchema.optional(),
    diagnosedBoneOrJointProblem: yesNoWithExplanationSchema.optional(),
    over65: optionalYesNoSchema,
    experiencedChestPainExerciseOrStress: yesNoWithExplanationSchema.optional(),
    experiencedShortnessOfBreath: yesNoWithExplanationSchema.optional(),
    experiencedFaintingOrLightheadedness: yesNoWithExplanationSchema.optional(),
    recentHospitalization: yesNoWithExplanationSchema.optional(),
    orthopedicConditions: yesNoWithExplanationSchema.optional(),
    rapidHeartbeatOrPalpitations: yesNoWithExplanationSchema.optional(),
    reasonNotToFollowRegularProgram: yesNoWithExplanationSchema.optional(),
    diagnosedConditions: z.array(diagnosedConditionSchema).default([]),

    familyHistoryAsthma: familyHistorySchema.optional(),
    familyHistoryRespiratoryPulmonaryConditions: familyHistorySchema.optional(),
    familyHistoryDiabetesType1: familyHistorySchema.optional(),
    familyHistoryDiabetesType2: familyHistorySchema.optional(),
    familyHistoryEpilepsy: familyHistorySchema.optional(),
    familyHistoryOsteoporosis: familyHistorySchema.optional(),
    familyHistoryCoronaryArteryDisease: familyHistorySchema.optional(),
    familyHistoryHeartAttack: familyHistorySchema.optional(),
    familyHistoryHypertension: familyHistorySchema.optional(),
    familyHistoryHighBloodPressure: familyHistorySchema.optional(),
    familyHistoryStroke: familyHistorySchema.optional(),

    highBloodPressure: cardiovascularHistorySchema.optional(),
    hypertension: cardiovascularHistorySchema.optional(),
    highCholesterol: cardiovascularHistorySchema.optional(),
    hyperlipidemia: cardiovascularHistorySchema.optional(),
    heartDisease: cardiovascularHistorySchema.optional(),
    skippedHeartbeat: cardiovascularHistorySchema.optional(),
    heartAttack: cardiovascularHistorySchema.optional(),
    stroke: cardiovascularHistorySchema.optional(),
    bypassOrCardiacSurgery: cardiovascularHistorySchema.optional(),
    angina: cardiovascularHistorySchema.optional(),
    gout: cardiovascularHistorySchema.optional(),
    phlebitisOrEmbolism: cardiovascularHistorySchema.optional(),
    otherCardiovascularCondition: cardiovascularHistorySchema.optional(),
    otherDiagnosedConditions: optionalString,

    painAreas: z.array(painAreaSchema).default([]),
    physicalLimitationsAggravatedByExercise: yesNoWithExplanationSchema.optional(),
    movementsExercisesPositionsAvoided: optionalString,
    toldToAvoidActivities: yesNoWithExplanationSchema.optional(),
    surgeries: z.array(surgerySchema).default([]),
    currentPhysioOrDoctorCare: yesNoWithExplanationSchema.optional(),
    knownDiagnoses: optionalString,

    smoking: optionalString,
    smokingDateQuit: optionalDateString,
    caffeine: optionalString,
    caffeineBeverages: optionalString,
    alcohol: optionalString,
    sleepHours: optionalString,
    sleepQuality: optionalString,
    energyLevel: optionalString,
    workActivityLevel: optionalString,
    stressWork: optionalString,
    stressHome: optionalString,
    worksMoreThan40Hours: optionalYesNoSchema,
    consistencyChallenges: z.array(z.string()).default([]),
    currentMoodAroundFitness: optionalString,
    bodyConfidence: optionalString,
    accountabilityPreference: z.array(z.string()).default([]),
    realisticPlanRequirements: optionalString,
    anythingElseForCoach: optionalString,

    anemia: yesNoWithExplanationSchema.optional(),
    gastrointestinalDisorder: yesNoWithExplanationSchema.optional(),
    hypoglycemia: yesNoWithExplanationSchema.optional(),
    thyroidDisorder: yesNoWithExplanationSchema.optional(),
    prePostnatal: yesNoWithExplanationSchema.optional(),

    specificDietPlan: yesNoWithExplanationSchema.optional(),
    dietPlanDetails: optionalString,
    dietPlanPrescribedBy: optionalString,
    foodAllergies: optionalString,
    foodIntolerances: optionalString,
    foodsAvoided: optionalString,
    foodsLoved: optionalString,
    foodsDisliked: optionalString,
    mealsPerDay: z.coerce.number().int().min(0).max(12).optional(),
    typicalBreakfast: optionalString,
    typicalLunch: optionalString,
    typicalDinner: optionalString,
    typicalSnacks: optionalString,
    waterIntake: optionalString,
    currentNutritionBehavior: optionalString,
    weightFluctuation: yesNoWithExplanationSchema.optional(),
    recentWeightChange: yesNoWithExplanationSchema.optional(),
    recentWeightChangeAmount: optionalString,
    recentWeightChangeTimeframe: optionalString,
    appetiteLevel: optionalString,
    dietaryRestrictions: optionalString,
    cookingAbility: optionalString,
    eatingOutFrequency: optionalString,
    nutritionBudgetLimitations: optionalString,
    otherNutritionIssues: optionalString,

    takesSupplements: optionalYesNoSchema,
    supplements: z.array(supplementSchema).default([]),
    possibleMedicationSupplementInteraction: yesNoWithExplanationSchema.optional(),

    threeDayFoodLog: z.array(foodLogDaySchema).max(3).default([]),

    accuracyConfirmed: z.literal(true),
    understandsNotMedicalAdvice: z.literal(true),
    agreesToMedicalClearanceWhenNeeded: z.literal(true),
    agreesToInformCoachOfChanges: z.literal(true),
    understandsExerciseRisk: z.literal(true),
    understandsStopRules: z.literal(true),
    dataProcessingConsent: z.literal(true),
    liabilityWaiverAccepted: z.literal(true),
    marketingConsent: z.boolean().default(false),
    printedName: requiredString,
    typedSignature: requiredString,
    dateSigned: requiredString,
    isUnder18: optionalYesNoSchema,
    parentGuardianName: optionalString,
    parentGuardianSignature: optionalString,

    orchestrationMode: z.enum(["test", "production"]).optional(),
    safetyStatus: safetyStatusSchema.optional(),
    clientProfile: compactClientProfileSchema.optional(),
  })
  .catchall(jsonValueSchema)
  .superRefine((input, context) => {
    if (input.isUnder18 === "yes") {
      if (!input.parentGuardianName) {
        context.addIssue({
          code: "custom",
          path: ["parentGuardianName"],
          message: "Parent or guardian name is required when the client is under 18.",
        });
      }
      if (!input.parentGuardianSignature) {
        context.addIssue({
          code: "custom",
          path: ["parentGuardianSignature"],
          message: "Parent or guardian signature is required when the client is under 18.",
        });
      }
    }
    if (input.recentWeightChange?.answer === "yes") {
      if (!input.recentWeightChangeAmount) {
        context.addIssue({
          code: "custom",
          path: ["recentWeightChangeAmount"],
          message: "Please add the amount of recent weight change.",
        });
      }
      if (!input.recentWeightChangeTimeframe) {
        context.addIssue({
          code: "custom",
          path: ["recentWeightChangeTimeframe"],
          message: "Please add the timeframe for recent weight change.",
        });
      }
    }
    if (input.specificDietPlan?.answer === "yes") {
      if (!input.dietPlanDetails) {
        context.addIssue({
          code: "custom",
          path: ["dietPlanDetails"],
          message: "Please list the diet plan.",
        });
      }
      if (!input.dietPlanPrescribedBy) {
        context.addIssue({
          code: "custom",
          path: ["dietPlanPrescribedBy"],
          message: "Please add who recommended the diet plan.",
        });
      }
    }
  });

export type CoachingIntakeInput = Record<string, unknown>;

function answerIsYes(value: unknown): boolean {
  return (
    value === "yes" ||
    (typeof value === "object" &&
      value !== null &&
      "answer" in value &&
      (value as { answer?: unknown }).answer === "yes")
  );
}

export function deriveSafetyStatus(input: Record<string, unknown>): SafetyStatus {
  const medicalClearanceFields = [
    "diagnosedHeartConditionAndOnlySupervisedActivity",
    "bloodPressureOrHeartMedication",
    "chestPainDuringActivity",
    "dizzinessOrLossOfConsciousnessLast12Months",
    "chestPainLast30Days",
    "experiencedChestPainExerciseOrStress",
    "experiencedShortnessOfBreath",
    "experiencedFaintingOrLightheadedness",
    "rapidHeartbeatOrPalpitations",
    "heartDisease",
    "heartAttack",
    "stroke",
    "bypassOrCardiacSurgery",
    "angina",
    "recentHospitalization",
    "pregnancyOrPossiblePregnancy",
    "recentHealthChange",
  ];

  if (medicalClearanceFields.some((field) => answerIsYes(input[field]))) {
    return "medical_clearance_recommended";
  }

  const cautionFields = [
    "boneJointSoftTissueProblemAggravatedByActivity",
    "diagnosedBoneOrJointProblem",
    "orthopedicConditions",
    "physicalLimitationsAggravatedByExercise",
    "toldToAvoidActivities",
    "currentPhysioOrDoctorCare",
    "recentSurgery",
    "underCareOfHealthProfessional",
  ];
  const hasSeverePain = Array.isArray(input.painAreas)
    ? input.painAreas.some(
        (painArea) =>
          typeof painArea === "object" &&
          painArea !== null &&
          Number((painArea as { severity?: unknown }).severity ?? 0) >= 7,
      )
    : false;
  const hasRecentSurgery = Array.isArray(input.surgeries) && input.surgeries.length > 0;

  return cautionFields.some((field) => answerIsYes(input[field])) ||
    hasSeverePain ||
    hasRecentSurgery
    ? "caution"
    : "clear";
}

export const coachingIntakeSchema = coachingIntakeBaseSchema.transform((input) => {
  const safetyStatus = deriveSafetyStatus(input);
  const successCriteria = input.desiredOutcome ?? input.specificGoalDescription;
  const clientProfile = {
    ...(input.clientProfile ?? {}),
    name: input.fullName,
    email: input.email,
    age: input.age,
    trainingExperience: input.trainingLevel,
    goals: [input.mainGoal, ...input.secondaryGoals].filter(Boolean),
    primaryGoal: input.mainGoal,
    goalDescription: input.specificGoalDescription,
    availability: `${input.availableDaysPerWeek} days per week, ${input.sessionDurationMinutes} minute sessions`,
    equipment: input.equipmentAvailable,
    constraints: [
      input.exercisesThatCausePain,
      input.movementsExercisesPositionsAvoided,
      input.knownDiagnoses,
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
    safetyStatus,
    nutritionSignals: [
      input.currentNutritionBehavior,
      input.dietaryRestrictions,
      input.otherNutritionIssues,
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
    coachSummary: input.desiredOutcome ?? input.specificGoalDescription,
  };

  return {
    ...input,
    name: input.fullName,
    goals: [input.mainGoal, ...input.secondaryGoals],
    experience: input.trainingLevel,
    daysPerWeek: input.availableDaysPerWeek,
    equipment: input.equipmentAvailable.join(", "),
    limitations: [
      input.exercisesThatCausePain,
      input.movementsExercisesPositionsAvoided,
      input.knownDiagnoses,
    ]
      .filter(Boolean)
      .join("; "),
    successCriteria,
    safetyStatus,
    clientProfile,
  };
});

export type CompactClientProfile = z.infer<typeof compactClientProfileSchema>;
export type CoachingIntake = z.infer<typeof coachingIntakeSchema>;
