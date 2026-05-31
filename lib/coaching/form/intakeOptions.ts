export type IntakeOption = {
  value: string;
  label: string;
};

function option(value: string, label?: string): IntakeOption {
  return {
    value,
    label:
      label ??
      value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
  };
}

export const sexOptions = [
  option("male", "Male"),
  option("female", "Female"),
  option("other", "Other"),
  option("prefer_not_to_say", "Prefer not to say"),
] as const;

export const yesNoOptions = [option("yes", "Yes"), option("no", "No")] as const;

export const mainGoalOptions = [
  option("muscle_gain"),
  option("fat_loss"),
  option("strength"),
  option("mobility"),
  option("pain_free_movement", "Pain-free movement"),
  option("general_fitness"),
  option("posture"),
  option("return_to_training"),
  option("mental_consistency"),
  option("lifestyle_energy"),
  option("other"),
] as const;

export const secondaryGoalOptions = [
  ...mainGoalOptions,
  option("confidence"),
  option("energy"),
  option("stress_reduction"),
] as const;

export const goalPriorityOptions = [
  option("aesthetic_transformation"),
  option("performance"),
  option("pain_reduction"),
  option("mobility"),
  option("confidence"),
  option("consistency"),
  option("health"),
  option("energy"),
  option("other"),
] as const;

export const coachingStyleOptions = [
  option("gentle"),
  option("direct"),
  option("structured"),
  option("motivational"),
  option("educational"),
  option("accountability_focused"),
  option("flexible"),
  option("other"),
] as const;

export const trainingLevelOptions = [
  option("beginner"),
  option("intermediate"),
  option("advanced"),
  option("returning_after_long_break"),
  option("returning_after_injury"),
] as const;

export const daysPerWeekOptions = ["1", "2", "3", "4", "5", "6", "7"].map((day) =>
  option(day, day),
);

export const trainingDayOptions = [
  option("monday", "Monday"),
  option("tuesday", "Tuesday"),
  option("wednesday", "Wednesday"),
  option("thursday", "Thursday"),
  option("friday", "Friday"),
  option("saturday", "Saturday"),
  option("sunday", "Sunday"),
] as const;

export const sessionDurationOptions = ["20", "30", "45", "60", "75", "90"]
  .map((minutes) => option(minutes, `${minutes} minutes`))
  .concat(option("other"));

export const trainingLocationOptions = [
  option("gym"),
  option("home"),
  option("outdoor"),
  option("mixed"),
] as const;

export const equipmentOptions = [
  option("full_gym"),
  option("dumbbells"),
  option("barbell"),
  option("machines"),
  option("resistance_bands"),
  option("kettlebells"),
  option("pull_up_bar", "Pull-up bar"),
  option("cardio_machine"),
  option("bodyweight_only"),
  option("yoga_mat"),
  option("foam_roller"),
  option("other"),
] as const;

export const painAreaOptions = [
  option("head_neck"),
  option("upper_back"),
  option("shoulder_clavicle"),
  option("arm_elbow"),
  option("wrist_hand"),
  option("lower_back"),
  option("hip_pelvis"),
  option("thigh_knee"),
  option("ankle_foot"),
  option("arthritis"),
  option("hernia"),
  option("surgeries"),
  option("other"),
] as const;

export const smokingOptions = [
  option("no", "No"),
  option("former_user", "Former user"),
  option("one_or_fewer_per_day", "1 or fewer per day"),
  option("two_to_five_per_day", "2 to 5 per day"),
  option("six_to_ten_per_day", "6 to 10 per day"),
  option("more_than_ten_per_day", "More than 10 per day"),
] as const;

export const frequencyOptions = [
  option("never"),
  option("several_times_a_day"),
  option("once_per_day"),
  option("few_times_per_week"),
  option("few_times_per_month"),
] as const;

export const sleepHoursOptions = [
  option("more_than_10", "More than 10 hours"),
  option("eight_to_ten", "8 to 10 hours"),
  option("five_to_seven", "5 to 7 hours"),
  option("less_than_5", "Less than 5 hours"),
] as const;

export const sleepQualityOptions = [
  option("poor"),
  option("average"),
  option("good"),
  option("excellent"),
] as const;

export const energyLevelOptions = [
  option("high"),
  option("moderate"),
  option("low"),
  option("very_low"),
] as const;

export const workActivityLevelOptions = [
  option("intense_occupational_and_recreational_effort"),
  option("moderate_occupational_and_recreational_effort"),
  option("sedentary_occupational_and_intense_recreational_effort"),
  option("sedentary_occupational_and_moderate_recreational_effort"),
  option("sedentary_occupational_and_light_recreational_effort"),
  option("complete_lack_of_activity"),
] as const;

export const stressOptions = [
  option("minimal"),
  option("moderate"),
  option("average"),
  option("extreme"),
] as const;

export const consistencyChallengeOptions = [
  option("lack_of_time"),
  option("low_motivation"),
  option("pain_or_fear_of_injury"),
  option("low_energy"),
  option("stress"),
  option("confusion_about_what_to_do"),
  option("embarrassment_in_gym"),
  option("emotional_eating"),
  option("travel"),
  option("work_schedule"),
  option("past_failure"),
  option("other"),
] as const;

export const accountabilityPreferenceOptions = [
  option("gentle_check_ins"),
  option("direct_feedback"),
  option("detailed_plan"),
  option("flexible_guidance"),
  option("progress_tracking"),
  option("motivational_messages"),
  option("education_explanations"),
  option("other"),
] as const;

export const appetiteLevelOptions = [
  option("low"),
  option("normal"),
  option("high"),
  option("variable"),
] as const;

export const mealTypeOptions = [
  option("breakfast"),
  option("lunch"),
  option("dinner"),
  option("snack"),
  option("drink"),
  option("other"),
] as const;

export const foodUnitOptions = [
  option("grams"),
  option("ml", "mL"),
  option("tablespoons"),
  option("teaspoons"),
  option("cups"),
  option("pieces"),
  option("servings"),
  option("ounces"),
  option("other"),
] as const;

export const foodLogNoteOptions = [
  option("in_a_hurry"),
  option("ate_out"),
  option("homemade"),
  option("cravings"),
  option("emotional_eating"),
  option("training_day"),
  option("rest_day"),
  option("special_event"),
  option("digestive_symptoms"),
  option("other"),
] as const;
