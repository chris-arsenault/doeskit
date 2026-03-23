import { useStore } from "../data/store";
import { buildTimingGroups, TIMING_LABELS } from "../data/timingGroups";
import { Clock } from "lucide-react";
import SupplementRow from "./SupplementRow";
import shared from "../styles/shared.module.css";
import styles from "./SupplementsSection.module.css";

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
