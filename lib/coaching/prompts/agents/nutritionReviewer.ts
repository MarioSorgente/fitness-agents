/**
 * Agent: Nutrition reviewer (step `nutrition_reviewer`).
 *
 * Role: produce the concrete nutrition direction (calorie/macro targets, meal structure,
 * restrictions to honor, suitable eating approaches) that the nutrition plan writer later expands
 * into a full meal plan. Shares the panel-expert system wrapper and JSON output contract from
 * `../shared/expertSystemTemplate`.
 */
import type { ExpertStep } from "../shared/expertSystemTemplate";

export const nutritionReviewer: ExpertStep = {
  id: "nutrition_reviewer",
  title: "Nutrition reviewer",
  instruction:
    "Give concrete nutrition direction: estimate a daily calorie and macro (protein/carbs/fat) target range for the goal and bodyweight; recommend a meal count and structure; list every allergy, intolerance, and dietary restriction to honor plus the liked foods to build around; and assess which eating approaches (e.g. intermittent fasting, meal frequency, carb cycling) suit or do not suit this client and why. Do not prescribe medical nutrition therapy or unsafe restriction.",
};
