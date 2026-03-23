import { useStore } from "../data/store";
import { Check, X, Dumbbell } from "lucide-react";
import ScoreSelector from "./ScoreSelector";
import shared from "../styles/shared.module.css";
import styles from "./WorkoutCard.module.css";

export default function WorkoutCard() {
  const done = useStore((s) => s.workoutDone);
  const motivation = useStore((s) => s.workoutMotivation);
  const isTrainingDay = useStore((s) => s.isTrainingDay);
  const logWorkout = useStore((s) => s.logWorkout);
  const logMotivation = useStore((s) => s.logMotivation);

  return (
    <section className={shared.card}>
      <h2 className={shared.cardTitle}>
        <Dumbbell size={18} /> Workout
      </h2>
      <div className={styles.toggle}>
        <button
          className={`${styles.toggleBtn} ${done === true ? styles.yes : ""}`}
          onClick={() => logWorkout(true)}
        >
          <Check size={16} /> Yes
        </button>
        <button
          className={`${styles.toggleBtn} ${done === false ? styles.no : ""}`}
          onClick={() => logWorkout(false)}
        >
          <X size={16} /> {isTrainingDay ? "Skip" : "No"}
        </button>
      </div>
      {done && (
        <div className={styles.motivation}>
          <span className={shared.periodLabel}>motivation</span>
          <ScoreSelector value={motivation} onSelect={logMotivation} />
        </div>
      )}
    </section>
  );
}
