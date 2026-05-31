const NO_ANSWER = { answer: "no", explanation: "" };

export const sampleIntakeFormData: Record<string, unknown> = {
  orchestrationMode: "test",

  fullName: "Sample Client",
  email: "sample.client@example.com",
  age: "34",
  sex: "female",
  phoneNumber: "",
  height: "168 cm",
  weight: "62 kg",

  mainGoal: "strength",
  specificGoalDescription:
    "Build full-body strength and feel confident lifting again after a long break.",
  secondaryGoals: ["energy"],
  desiredOutcome: "Lift 3 times per week consistently and feel strong day to day.",
  motivation: "Long-term health and energy for family activities.",
  confidenceLevel: "6",
  preferredCoachingStyle: ["gentle", "structured"],

  trainingLevel: "intermediate",
  currentWeeklyActivity: "Walks daily, occasional yoga.",
  availableDaysPerWeek: "3",
  preferredTrainingDays: ["monday", "wednesday", "friday"],
  sessionDurationMinutes: "45",
  trainingLocation: "home",
  equipmentAvailable: ["dumbbells", "resistance_bands", "yoga_mat"],
  likedExercises: "Squats, rows.",
  dislikedExercises: "Burpees.",

  diagnosedHeartConditionAndOnlySupervisedActivity: NO_ANSWER,
  bloodPressureOrHeartMedication: NO_ANSWER,
  chestPainDuringActivity: NO_ANSWER,
  dizzinessOrLossOfConsciousnessLast12Months: NO_ANSWER,
  boneJointSoftTissueProblemAggravatedByActivity: NO_ANSWER,
  chestPainLast30Days: NO_ANSWER,
  otherReasonNotToExercise: NO_ANSWER,

  medications: [],
  diagnosedConditions: [],
  painAreas: [],
  surgeries: [],

  sleepHours: "7-8",
  sleepQuality: "good",
  energyLevel: "moderate",
  stressWork: "moderate",
  stressHome: "low",

  currentNutritionBehavior: "Three meals plus a snack; mostly home-cooked.",
  dietaryRestrictions: "None.",
  mealsPerDay: "3",
  waterIntake: "About 2L per day.",

  threeDayFoodLog: [],

  privacyPolicyAccepted: true,
  termsAndConditionsAccepted: true,
};
