import {
  accountabilityPreferenceOptions,
  appetiteLevelOptions,
  coachingStyleOptions,
  consistencyChallengeOptions,
  cookingAbilityOptions,
  daysPerWeekOptions,
  eatingOutFrequencyOptions,
  energyLevelOptions,
  equipmentOptions,
  foodLogNoteOptions,
  foodUnitOptions,
  frequencyOptions,
  goalPriorityOptions,
  mainGoalOptions,
  mealTypeOptions,
  painAreaOptions,
  secondaryGoalOptions,
  sessionDurationOptions,
  sexOptions,
  sleepHoursOptions,
  sleepQualityOptions,
  smokingOptions,
  stressOptions,
  trainingDayOptions,
  trainingLevelOptions,
  trainingLocationOptions,
  workActivityLevelOptions,
  yesNoOptions,
  type IntakeOption,
} from "./intakeOptions";

export type IntakeFieldType =
  | "text"
  | "email"
  | "date"
  | "number"
  | "textarea"
  | "select"
  | "multi-select"
  | "checkbox"
  | "yes_no"
  | "yes_no_with_explanation"
  | "field_group"
  | "repeatable_group";

export type IntakeField = {
  name: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  requiredWhen?: { field: string; equals: string };
  placeholder?: string;
  helperText?: string;
  options?: readonly IntakeOption[];
  min?: number;
  max?: number;
  collapsible?: boolean;
  maxItems?: number;
  fields?: IntakeField[];
};

export const familyHistoryFields = [
  "familyHistoryAsthma",
  "familyHistoryRespiratoryPulmonaryConditions",
  "familyHistoryDiabetesType1",
  "familyHistoryDiabetesType2",
  "familyHistoryEpilepsy",
  "familyHistoryOsteoporosis",
  "familyHistoryCoronaryArteryDisease",
  "familyHistoryHeartAttack",
  "familyHistoryHypertension",
  "familyHistoryHighBloodPressure",
  "familyHistoryStroke",
] as const;

export const cardiovascularHistoryFields = [
  "highBloodPressure",
  "hypertension",
  "highCholesterol",
  "hyperlipidemia",
  "heartDisease",
  "skippedHeartbeat",
  "heartAttack",
  "stroke",
  "bypassOrCardiacSurgery",
  "angina",
  "gout",
  "phlebitisOrEmbolism",
  "otherCardiovascularCondition",
] as const;

export const dietaryMetabolicFields = [
  "anemia",
  "gastrointestinalDisorder",
  "hypoglycemia",
  "thyroidDisorder",
  "prePostnatal",
] as const;

function humanizeFieldName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function yesNoWithExplanation(name: string, label: string, required = false): IntakeField {
  return { name, label, type: "yes_no_with_explanation", required, options: yesNoOptions };
}

function yesNo(name: string, label: string, required = false): IntakeField {
  return { name, label, type: "yes_no", required, options: yesNoOptions };
}

export const aboutYouFields: IntakeField[] = [
  { name: "fullName", label: "Full name", type: "text", required: true },
  { name: "dateOfBirth", label: "Date of birth", type: "date" },
  { name: "age", label: "Age", type: "number", required: true, min: 13, max: 120 },
  { name: "sex", label: "Sex", type: "select", required: true, options: sexOptions },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phoneNumber", label: "Phone number", type: "text" },
  { name: "address", label: "Address", type: "text" },
  { name: "city", label: "City", type: "text" },
  { name: "stateProvince", label: "State / Province", type: "text" },
  { name: "postalCode", label: "ZIP / Postal code", type: "text" },
  { name: "country", label: "Country", type: "text" },
  { name: "timezone", label: "Timezone", type: "text", placeholder: "Example: America/New_York" },
  {
    name: "height",
    label: "Height",
    type: "text",
    helperText: "Use your preferred unit, such as 175 cm or 5'9\".",
  },
  {
    name: "weight",
    label: "Weight",
    type: "text",
    helperText: "Use your preferred unit, such as 75 kg or 165 lb.",
  },
  { name: "employer", label: "Employer", type: "text" },
  { name: "occupation", label: "Occupation", type: "text" },
  { name: "emergencyContactName", label: "Emergency contact full name", type: "text" },
  { name: "emergencyContactRelationship", label: "Emergency contact relationship", type: "text" },
  { name: "emergencyContactPhone", label: "Emergency contact phone number", type: "text" },
  { name: "emergencyContactAddress", label: "Emergency contact address", type: "text" },
];

export const goalFields: IntakeField[] = [
  {
    name: "mainGoal",
    label: "What is your main goal?",
    type: "select",
    required: true,
    options: mainGoalOptions,
    helperText: "This is a primary AI planning input and is reviewed by every coaching agent.",
  },
  {
    name: "specificGoalDescription",
    label: "Describe your goal in your own words",
    type: "textarea",
    required: true,
    placeholder:
      "Example: I want to build muscle without irritating my shoulder, train 3x/week, and feel more confident in my body.",
  },
  {
    name: "secondaryGoals",
    label: "Secondary goals",
    type: "multi-select",
    options: secondaryGoalOptions,
  },
  {
    name: "goalPriority",
    label: "What matters most right now?",
    type: "select",
    options: goalPriorityOptions,
  },
  {
    name: "desiredOutcome",
    label: "What would make this coaching plan successful for you?",
    type: "textarea",
  },
  { name: "motivation", label: "Why do you want to start now?", type: "textarea" },
  { name: "biggestStruggle", label: "What is your biggest struggle right now?", type: "textarea" },
  {
    name: "confidenceLevel",
    label: "How confident do you feel about starting?",
    type: "number",
    min: 1,
    max: 10,
  },
  {
    name: "mentalStateAroundTraining",
    label: "How do you currently feel about training and your body?",
    type: "textarea",
  },
  {
    name: "preferredCoachingStyle",
    label: "What coaching style works best for you?",
    type: "multi-select",
    options: coachingStyleOptions,
  },
];

export const trainingBackgroundFields: IntakeField[] = [
  {
    name: "trainingLevel",
    label: "Training level",
    type: "select",
    required: true,
    options: trainingLevelOptions,
  },
  {
    name: "currentWeeklyActivity",
    label: "What does your current weekly activity look like?",
    type: "textarea",
  },
  yesNoWithExplanation("usedToVigorousExercise", "Are you used to vigorous exercise?"),
  {
    name: "availableDaysPerWeek",
    label: "How many days per week can you train?",
    type: "select",
    required: true,
    options: daysPerWeekOptions,
  },
  {
    name: "preferredTrainingDays",
    label: "Preferred training days",
    type: "multi-select",
    options: trainingDayOptions,
  },
  {
    name: "sessionDurationMinutes",
    label: "How much time do you have per session?",
    type: "select",
    required: true,
    options: sessionDurationOptions,
  },
  {
    name: "trainingLocation",
    label: "Where will you train?",
    type: "select",
    options: trainingLocationOptions,
  },
  {
    name: "equipmentAvailable",
    label: "What equipment do you have access to?",
    type: "multi-select",
    options: equipmentOptions,
  },
  { name: "currentProgram", label: "Are you currently following a program?", type: "textarea" },
  {
    name: "previousCoachingExperience",
    label: "Have you worked with a coach before?",
    type: "textarea",
  },
  { name: "likedExercises", label: "Exercises you like", type: "textarea" },
  { name: "dislikedExercises", label: "Exercises you dislike", type: "textarea" },
  {
    name: "exercisesThatCausePain",
    label: "Exercises that currently cause pain or discomfort",
    type: "textarea",
  },
  {
    name: "movementsThatFeelGood",
    label: "Movements that usually feel good for your body",
    type: "textarea",
  },
];

export const healthSafetyFields: IntakeField[] = [
  yesNoWithExplanation(
    "diagnosedHeartConditionAndOnlySupervisedActivity",
    "Has your doctor ever diagnosed you with a heart condition and told you to only do physical activity supervised by a doctor?",
    true,
  ),
  yesNoWithExplanation(
    "bloodPressureOrHeartMedication",
    "Does your doctor currently prescribe you medication for blood pressure or a heart condition?",
    true,
  ),
  yesNoWithExplanation(
    "chestPainDuringActivity",
    "Do you feel chest pain during physical activity?",
    true,
  ),
  yesNoWithExplanation(
    "dizzinessOrLossOfConsciousnessLast12Months",
    "Do you lose your balance because of dizziness, or have you lost consciousness in the last 12 months?",
    true,
  ),
  yesNoWithExplanation(
    "boneJointSoftTissueProblemAggravatedByActivity",
    "Do you have a bone, joint, or soft tissue problem that may be irritated or worsened by physical activity?",
    true,
  ),
  yesNoWithExplanation(
    "chestPainLast30Days",
    "In the past 30 days, have you had chest pain at any point?",
    true,
  ),
  yesNoWithExplanation(
    "otherReasonNotToExercise",
    "Do you have any other reason why you should not do physical activity?",
    true,
  ),
  yesNoWithExplanation("currentlyFeelingUnwell", "Are you currently feeling unwell?"),
  yesNoWithExplanation("pregnancyOrPossiblePregnancy", "Are you pregnant or possibly pregnant?"),
  yesNoWithExplanation("recentHealthChange", "Has your health suddenly changed recently?"),
];

export const medicalHistoryFields: IntakeField[] = [
  { name: "currentPhysicianName", label: "Current physician name", type: "text" },
  { name: "currentPhysicianPhone", label: "Current physician phone number", type: "text" },
  yesNoWithExplanation(
    "underCareOfHealthProfessional",
    "Are you currently under the care of a physician, chiropractor, physiotherapist, or other health professional?",
  ),
  {
    name: "medications",
    label: "Medications",
    type: "repeatable_group",
    fields: [
      { name: "medicationName", label: "Medication name", type: "text" },
      { name: "dosage", label: "Dosage", type: "text" },
      { name: "frequency", label: "Frequency", type: "text" },
      { name: "conditionOrReason", label: "Condition or reason", type: "text" },
    ],
  },
  { name: "allergies", label: "List all allergies", type: "textarea" },
  yesNoWithExplanation(
    "diagnosedHighBloodPressure",
    "Has your doctor ever diagnosed you with high blood pressure?",
  ),
  yesNoWithExplanation(
    "diagnosedBoneOrJointProblem",
    "Has your doctor ever diagnosed you with a bone or joint problem that has been or could be made worse by exercise?",
  ),
  yesNo("over65", "Are you over 65 years of age?"),
  yesNoWithExplanation(
    "experiencedChestPainExerciseOrStress",
    "Have you experienced chest pain associated with exercise or stress?",
  ),
  yesNoWithExplanation(
    "experiencedShortnessOfBreath",
    "Have you experienced shortness of breath with or without exercise?",
  ),
  yesNoWithExplanation(
    "experiencedFaintingOrLightheadedness",
    "Have you experienced fainting or light-headedness?",
  ),
  yesNoWithExplanation(
    "recentHospitalization",
    "Have you had a recent hospitalization for any cause?",
  ),
  yesNoWithExplanation(
    "orthopedicConditions",
    "Do you have any orthopedic conditions, including arthritis?",
  ),
  yesNoWithExplanation(
    "rapidHeartbeatOrPalpitations",
    "Have you ever experienced rapid heartbeat or palpitations?",
  ),
  yesNoWithExplanation(
    "reasonNotToFollowRegularProgram",
    "Is there any reason why you should not follow a regular exercise program?",
  ),
  {
    name: "diagnosedConditions",
    label: "Other diagnosed conditions",
    type: "repeatable_group",
    fields: [
      { name: "conditionName", label: "Condition name", type: "text" },
      { name: "dateOfDiagnosis", label: "Date of diagnosis", type: "date" },
      { name: "notes", label: "Notes", type: "text" },
    ],
  },
  ...familyHistoryFields.map(
    (name): IntakeField => ({
      name,
      label: humanizeFieldName(name),
      type: "field_group",
      fields: [
        yesNo("hasFamilyHistory", "Family history?"),
        { name: "familyMember", label: "Family member", type: "text" },
        { name: "notes", label: "Notes", type: "text" },
      ],
    }),
  ),
  ...cardiovascularHistoryFields.map(
    (name): IntakeField => yesNoWithExplanation(name, humanizeFieldName(name)),
  ),
  {
    name: "otherDiagnosedConditions",
    label: "Please list any other diagnosed conditions and date of diagnosis",
    type: "textarea",
  },
];

export const painInjuryFields: IntakeField[] = [
  {
    name: "painAreas",
    label: "Pain areas",
    type: "repeatable_group",
    fields: [
      { name: "area", label: "Area", type: "select", options: painAreaOptions },
      yesNo("currentlyHasPain", "Currently has pain?"),
      yesNo("hadPainPreviously", "Had pain previously?"),
      { name: "severity", label: "Severity (0-10)", type: "number", min: 0, max: 10 },
      { name: "description", label: "Description", type: "textarea" },
      { name: "triggers", label: "Triggers", type: "textarea" },
      { name: "movementsThatMakeItWorse", label: "Movements that make it worse", type: "textarea" },
      {
        name: "movementsThatMakeItBetter",
        label: "Movements that make it better",
        type: "textarea",
      },
      { name: "painDuringExercise", label: "Pain during exercise", type: "textarea" },
      { name: "diagnosisIfAny", label: "Diagnosis, if any", type: "text" },
      yesNo("currentlyTreatingIt", "Currently treating it?"),
      { name: "treatmentDetails", label: "Treatment details", type: "textarea" },
    ],
  },
  yesNoWithExplanation(
    "physicalLimitationsAggravatedByExercise",
    "Do you have any physical limitations that could be aggravated by exercise?",
  ),
  {
    name: "movementsExercisesPositionsAvoided",
    label: "Are there any movements, exercises, or positions you currently avoid?",
    type: "textarea",
  },
  yesNoWithExplanation(
    "toldToAvoidActivities",
    "Have you been told by a doctor, physiotherapist, or trainer to avoid any specific activity?",
  ),
  {
    name: "surgeries",
    label: "Surgeries",
    type: "repeatable_group",
    fields: [
      { name: "surgeryType", label: "Surgery type", type: "text" },
      { name: "bodyArea", label: "Body area", type: "text" },
      { name: "date", label: "Date", type: "date" },
      { name: "currentLimitations", label: "Current limitations", type: "textarea" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  yesNoWithExplanation(
    "currentPhysioOrDoctorCare",
    "Are you currently receiving care for pain, injury, or movement limitations?",
  ),
  { name: "knownDiagnoses", label: "Known injury or pain diagnoses", type: "textarea" },
];

export const lifestyleMindsetFields: IntakeField[] = [
  { name: "smoking", label: "Do you smoke?", type: "select", options: smokingOptions },
  { name: "smokingDateQuit", label: "If former user, date quit", type: "date" },
  { name: "caffeine", label: "Do you drink caffeine?", type: "select", options: frequencyOptions },
  { name: "caffeineBeverages", label: "What caffeine drinks do you consume?", type: "textarea" },
  { name: "alcohol", label: "Do you drink alcohol?", type: "select", options: frequencyOptions },
  {
    name: "sleepHours",
    label: "On average, how many hours of sleep do you get each night?",
    type: "select",
    options: sleepHoursOptions,
  },
  {
    name: "sleepQuality",
    label: "How would you rate your sleep quality?",
    type: "select",
    options: sleepQualityOptions,
  },
  {
    name: "energyLevel",
    label: "On average, what is your energy level like each day?",
    type: "select",
    options: energyLevelOptions,
  },
  {
    name: "workActivityLevel",
    label: "Which best describes your work and exercise habits?",
    type: "select",
    options: workActivityLevelOptions,
  },
  {
    name: "stressWork",
    label: "How stressful is your work environment?",
    type: "select",
    options: stressOptions,
  },
  {
    name: "stressHome",
    label: "How stressful is your home environment?",
    type: "select",
    options: stressOptions,
  },
  yesNo("worksMoreThan40Hours", "Do you work more than 40 hours per week?"),
  {
    name: "consistencyChallenges",
    label: "What usually stops you from being consistent?",
    type: "multi-select",
    options: consistencyChallengeOptions,
  },
  {
    name: "currentMoodAroundFitness",
    label: "How do you currently feel about fitness?",
    type: "textarea",
  },
  { name: "bodyConfidence", label: "How do you feel about your body right now?", type: "textarea" },
  {
    name: "accountabilityPreference",
    label: "What kind of accountability helps you most?",
    type: "multi-select",
    options: accountabilityPreferenceOptions,
  },
  {
    name: "realisticPlanRequirements",
    label: "What would make this plan feel realistic for you?",
    type: "textarea",
  },
  {
    name: "anythingElseForCoach",
    label: "Anything else you would like your coach to know?",
    type: "textarea",
  },
];

export const nutritionSupplementFields: IntakeField[] = [
  ...dietaryMetabolicFields.map(
    (name): IntakeField => yesNoWithExplanation(name, humanizeFieldName(name)),
  ),
  yesNoWithExplanation("specificDietPlan", "Are you currently on a specific food or diet plan?"),
  {
    name: "dietPlanDetails",
    label: "If yes, please list the diet plan",
    type: "textarea",
    requiredWhen: { field: "specificDietPlan", equals: "yes" },
  },
  {
    name: "dietPlanPrescribedBy",
    label: "Who prescribed or recommended it?",
    type: "text",
    requiredWhen: { field: "specificDietPlan", equals: "yes" },
  },
  { name: "foodAllergies", label: "Food allergies", type: "textarea" },
  { name: "foodIntolerances", label: "Food intolerances", type: "textarea" },
  { name: "foodsAvoided", label: "Foods you avoid", type: "textarea" },
  { name: "foodsLoved", label: "Foods you love", type: "textarea" },
  { name: "foodsDisliked", label: "Foods you dislike", type: "textarea" },
  {
    name: "mealsPerDay",
    label: "How many meals do you usually eat per day?",
    type: "number",
    min: 0,
    max: 12,
  },
  { name: "typicalBreakfast", label: "Typical breakfast", type: "textarea" },
  { name: "typicalLunch", label: "Typical lunch", type: "textarea" },
  { name: "typicalDinner", label: "Typical dinner", type: "textarea" },
  { name: "typicalSnacks", label: "Typical snacks", type: "textarea" },
  { name: "waterIntake", label: "Approximate daily water intake", type: "text" },
  {
    name: "currentNutritionBehavior",
    label: "How would you describe your current nutritional behaviors?",
    type: "textarea",
  },
  yesNoWithExplanation("weightFluctuation", "Do you notice your weight fluctuating?"),
  yesNoWithExplanation(
    "recentWeightChange",
    "Have you experienced recent weight gain or weight loss?",
  ),
  {
    name: "recentWeightChangeAmount",
    label: "If yes, how much?",
    type: "text",
    requiredWhen: { field: "recentWeightChange", equals: "yes" },
  },
  {
    name: "recentWeightChangeTimeframe",
    label: "Over what amount of time?",
    type: "text",
    requiredWhen: { field: "recentWeightChange", equals: "yes" },
  },
  {
    name: "appetiteLevel",
    label: "How is your appetite?",
    type: "select",
    options: appetiteLevelOptions,
  },
  { name: "dietaryRestrictions", label: "Dietary restrictions", type: "textarea" },
  {
    name: "cookingAbility",
    label: "Cooking ability",
    type: "select",
    options: cookingAbilityOptions,
  },
  {
    name: "eatingOutFrequency",
    label: "How often do you eat out or order food?",
    type: "select",
    options: eatingOutFrequencyOptions,
  },
  {
    name: "nutritionBudgetLimitations",
    label: "Any budget limitations around food?",
    type: "textarea",
  },
  {
    name: "otherNutritionIssues",
    label: "Other food or nutrition issues you want to include",
    type: "textarea",
  },
  yesNo("takesSupplements", "Do you currently take dietary supplements?"),
  {
    name: "supplements",
    label: "Current supplements",
    type: "repeatable_group",
    fields: [
      { name: "supplementName", label: "Supplement name", type: "text" },
      { name: "dosage", label: "Dosage", type: "text" },
      { name: "frequency", label: "Frequency", type: "text" },
      { name: "reasonForTaking", label: "Reason for taking", type: "text" },
      { name: "recommendedBy", label: "Recommended by", type: "text" },
      { name: "sideEffects", label: "Side effects", type: "text" },
    ],
  },
  yesNoWithExplanation(
    "possibleMedicationSupplementInteraction",
    "Are you taking medication or do you have any condition that may interact with supplements?",
  ),
];

export const foodLogFields: IntakeField[] = [
  {
    name: "threeDayFoodLog",
    label: "Optional 3-day food log",
    type: "repeatable_group",
    collapsible: true,
    maxItems: 3,
    helperText: "Skip this if you prefer. You can add up to three days now or complete it later.",
    fields: [
      { name: "dayNumber", label: "Day number", type: "number", min: 1, max: 3 },
      { name: "date", label: "Date", type: "date" },
      {
        name: "meals",
        label: "Meals",
        type: "repeatable_group",
        fields: [
          { name: "mealType", label: "Meal type", type: "select", options: mealTypeOptions },
          { name: "foodItem", label: "Food item", type: "text" },
          { name: "brandName", label: "Brand name", type: "text" },
          { name: "quantity", label: "Quantity", type: "text" },
          { name: "unit", label: "Unit", type: "select", options: foodUnitOptions },
          { name: "timeOfDay", label: "Time of day", type: "text" },
          {
            name: "additionalNotes",
            label: "Additional notes",
            type: "multi-select",
            options: foodLogNoteOptions,
          },
        ],
      },
    ],
  },
];

export const consentFields: IntakeField[] = [
  {
    name: "accuracyConfirmed",
    label: "I confirm that the information I provided is accurate and complete.",
    type: "checkbox",
    required: true,
  },
  {
    name: "understandsNotMedicalAdvice",
    label:
      "I understand that this coaching service provides fitness, mobility, nutrition, and wellness guidance, not medical diagnosis or treatment.",
    type: "checkbox",
    required: true,
  },
  {
    name: "agreesToMedicalClearanceWhenNeeded",
    label:
      "I understand that I am responsible for consulting a physician or qualified health professional before starting exercise if I have medical concerns, symptoms, or red flags.",
    type: "checkbox",
    required: true,
  },
  {
    name: "agreesToInformCoachOfChanges",
    label:
      "I agree to inform my coach of any physical limitations, pain, medical conditions, injuries, or health changes before and during the program.",
    type: "checkbox",
    required: true,
  },
  {
    name: "understandsExerciseRisk",
    label: "I understand that exercise involves risk and I agree to follow instructions carefully.",
    type: "checkbox",
    required: true,
  },
  {
    name: "understandsStopRules",
    label:
      "I understand that if I experience chest pain, fainting, severe shortness of breath, severe pain, neurological symptoms, or unusual symptoms, I should stop exercising and seek medical help.",
    type: "checkbox",
    required: true,
  },
  {
    name: "dataProcessingConsent",
    label:
      "I consent to my information being stored and reviewed by the coaching team for the purpose of creating my plan.",
    type: "checkbox",
    required: true,
  },
  {
    name: "liabilityWaiverAccepted",
    label: "I agree to the coaching terms and liability waiver.",
    type: "checkbox",
    required: true,
  },
  {
    name: "marketingConsent",
    label: "I agree to receive optional updates, offers, or coaching content.",
    type: "checkbox",
  },
  { name: "printedName", label: "Printed name", type: "text", required: true },
  { name: "typedSignature", label: "Typed signature", type: "text", required: true },
  { name: "dateSigned", label: "Date signed", type: "date", required: true },
  yesNo("isUnder18", "Are you under 18?"),
  {
    name: "parentGuardianName",
    label: "Parent or guardian name, if under 18",
    type: "text",
    requiredWhen: { field: "isUnder18", equals: "yes" },
  },
  {
    name: "parentGuardianSignature",
    label: "Parent or guardian typed signature, if under 18",
    type: "text",
    requiredWhen: { field: "isUnder18", equals: "yes" },
  },
];

export const intakeFields = [
  ...aboutYouFields,
  ...goalFields,
  ...trainingBackgroundFields,
  ...healthSafetyFields,
  ...medicalHistoryFields,
  ...painInjuryFields,
  ...lifestyleMindsetFields,
  ...nutritionSupplementFields,
  ...foodLogFields,
  ...consentFields,
] as const;

export const requiredIntakeFieldNames = intakeFields
  .filter((field) => field.required)
  .map((field) => field.name);
