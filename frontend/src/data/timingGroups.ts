import type { DailyDose } from "./store";

const TIMING_ORDER = ["morning", "pre_workout", "intra_workout", "post_workout", "evening"];

export const TIMING_LABELS: Record<string, string> = {
  morning: "Morning",
  pre_workout: "Pre-Workout",
  intra_workout: "Intra-Workout",
  post_workout: "Post-Workout",
  evening: "Evening",
};

export type TimingGroup = {
  timing: string;
  items: DailyDose[];
};

export function buildTimingGroups(
  doses: DailyDose[],
  isTrainingDay: boolean,
  workoutSkipped: boolean
): TimingGroup[] {
  const visible = doses.filter(
    (d) => !(d.supplement_type.training_day_only && (!isTrainingDay || workoutSkipped))
  );

  const byTiming: Record<string, DailyDose[]> = {};
  for (const d of visible) {
    let timing = d.supplement_type.timing || "morning";
    if (!isTrainingDay || workoutSkipped) {
      if (timing === "pre_workout" || timing === "intra_workout" || timing === "post_workout") {
        timing = "morning";
      }
    }
    if (!byTiming[timing]) byTiming[timing] = [];
    byTiming[timing].push(d);
  }

  return TIMING_ORDER.filter((t) => byTiming[t]?.length).map((timing) => ({
    timing,
    items: byTiming[timing],
  }));
}
