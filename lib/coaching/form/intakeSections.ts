import {
  aboutYouFields,
  consentFields,
  foodLogFields,
  goalFields,
  healthSafetyFields,
  lifestyleMindsetFields,
  medicalHistoryFields,
  nutritionSupplementFields,
  painInjuryFields,
  trainingBackgroundFields,
  type IntakeField,
} from "./intakeFields";

export type IntakeSection = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  fields: IntakeField[];
  optional?: boolean;
  collapsible?: boolean;
};

export const intakeIntroCopy =
  "This intake helps us understand your goals, body, lifestyle, and safety considerations so your plan can be tailored to you. This is not a medical diagnosis. If anything raises a red flag, your coach may recommend medical clearance before progressing.";

export const intakeSections: IntakeSection[] = [
  {
    id: "about-you",
    eyebrow: "Step 1",
    title: "About You",
    description: "Start with the basics so we can identify you and tailor coaching context.",
    fields: aboutYouFields,
  },
  {
    id: "your-goal",
    eyebrow: "Step 2",
    title: "Your Goal",
    description:
      "Your primary goal is a core input for the AI coaching panel, so describe it clearly and honestly.",
    fields: goalFields,
  },
  {
    id: "training-background",
    eyebrow: "Step 3",
    title: "Training Background",
    description: "Tell us what training currently looks like and what resources you can use.",
    fields: trainingBackgroundFields,
  },
  {
    id: "health-safety",
    eyebrow: "Step 4",
    title: "Health and Safety",
    description:
      "These PAR-Q style questions help your coach decide whether extra caution or medical clearance may be appropriate.",
    fields: healthSafetyFields,
  },
  {
    id: "medical-history",
    eyebrow: "Step 5",
    title: "Medical History",
    description:
      "Add health details that may affect coaching decisions. You can skip anything that does not apply.",
    fields: medicalHistoryFields,
  },
  {
    id: "pain-injuries",
    eyebrow: "Step 6",
    title: "Pain and Injuries",
    description:
      "Share pain, injury, and movement limitations so programming can be conservative and realistic.",
    fields: painInjuryFields,
  },
  {
    id: "lifestyle-mindset",
    eyebrow: "Step 7",
    title: "Lifestyle and Mindset",
    description:
      "Coaching works best when it fits your sleep, stress, schedule, and motivation patterns.",
    fields: lifestyleMindsetFields,
  },
  {
    id: "nutrition-supplements",
    eyebrow: "Step 8",
    title: "Nutrition and Supplements",
    description:
      "Capture nutrition habits, dietary factors, and supplement context without making this feel like a diet audit.",
    fields: nutritionSupplementFields,
  },
  {
    id: "food-log",
    eyebrow: "Step 9",
    title: "Optional 3-Day Food Log",
    description: "This can help your coach spot patterns, but it is optional and skippable.",
    fields: foodLogFields,
    optional: true,
    collapsible: true,
  },
  {
    id: "consent-confirmation",
    eyebrow: "Step 10",
    title: "Consent and Confirmation",
    description:
      "Please confirm the details are accurate and that you understand coaching is guidance, not medical care.",
    fields: consentFields,
  },
];
