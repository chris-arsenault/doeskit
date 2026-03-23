import { useStore, type DailyDose } from "../data/store";
import { Clock } from "lucide-react";
import SupplementRow from "./SupplementRow";
import shared from "../styles/shared.module.css";
import styles from "./SupplementsSection.module.css";

const TIMING_ORDER = ["morning", "pre_workout", "intra_workout", "post_workout", "evening"];
const TIMING_LABELS: Record<string, string> = {
  morning: "Morning",
  pre_workout: "Pre-Workout",
  intra_workout: "Intra-Workout",
  post_workout: "Post-Workout",
  evening: "Evening",
};

export default function SupplementsSection() {
  const doses = useStore((s) => s.doses);
  const isTrainingDay = useStore((s) => s.isTrainingDay);
  const workoutSkipped = useStore((s) => s.workoutDone === false);

  const groups = buildTimingGroups(doses, isTrainingDay, workoutSkipped);

  return (
    <>
      {groups.map(({ timing, items }) => (
        <section key={timing} className={shared.card}>
          <h2 className={shared.cardTitle}>
            <Clock size={18} /> {TIMING_LABELS[timing] ?? timing}
          </h2>
          <ul className={styles.checklist}>
            {items.map((dose) => (
              <SupplementRow key={dose.supplement_type.id} dose={dose} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function buildTimingGroups(doses: DailyDose[], isTrainingDay: boolean, workoutSkipped: boolean) {
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
