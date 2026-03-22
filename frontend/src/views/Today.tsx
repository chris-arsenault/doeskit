import { useStore, type Supplement } from "../data/store";
import { Check, X, Moon, Zap, Dumbbell, Pill, Clock } from "lucide-react";

const ENERGY_PERIODS = ["morning", "afternoon", "evening"] as const;

const TIMING_ORDER = ["morning", "pre_workout", "intra_workout", "post_workout", "evening"];
const TIMING_LABELS: Record<string, string> = {
  morning: "Morning",
  pre_workout: "Pre-Workout",
  intra_workout: "Intra-Workout",
  post_workout: "Post-Workout",
  evening: "Evening",
};

function ScoreSelector({ value, onSelect, max = 10 }: { value: number | null; onSelect: (n: number) => void; max?: number }) {
  return (
    <div className="score-row">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} className={`score-btn ${value === n ? "active" : ""}`} onClick={() => onSelect(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

type SupplementEntry = { supplement: Supplement; taken: boolean };

function groupByTiming(supplements: SupplementEntry[], isTrainingDay: boolean, workoutSkipped: boolean) {
  const visible = supplements.filter(({ supplement: s }) => {
    if (s.training_day_only && (!isTrainingDay || workoutSkipped)) return false;
    return true;
  });

  const groups: Record<string, SupplementEntry[]> = {};
  for (const entry of visible) {
    let timing = entry.supplement.timing || "morning";
    // On rest days, move workout-window supplements to morning
    if (!isTrainingDay || workoutSkipped) {
      if (timing === "pre_workout" || timing === "intra_workout" || timing === "post_workout") {
        timing = "morning";
      }
    }
    if (!groups[timing]) groups[timing] = [];
    groups[timing].push(entry);
  }

  return TIMING_ORDER.filter((t) => groups[t]?.length).map((t) => ({ timing: t, items: groups[t] }));
}

export default function Today() {
  const today = useStore((s) => s.today);
  const logEntry = useStore((s) => s.logEntry);

  if (!today) return null;

  const workoutSkipped = today.workout.done === false;
  const timingGroups = groupByTiming(today.supplements, today.is_training_day, workoutSkipped);

  return (
    <div className="view today-view">
      <h1 className="view-date">
        {formatDate(today.date)}
        {today.is_training_day && <span className="training-badge">Training Day</span>}
      </h1>

      <section className="card">
        <h2 className="card-title">
          <Moon size={18} /> Sleep
        </h2>
        <ScoreSelector value={today.sleep} onSelect={(n) => logEntry("sleep", "score", n)} />
      </section>

      <section className="card">
        <h2 className="card-title">
          <Zap size={18} /> Energy
        </h2>
        {ENERGY_PERIODS.map((period) => (
          <div key={period} className="energy-period">
            <span className="period-label">{period}</span>
            <ScoreSelector value={today.energy[period]} onSelect={(n) => logEntry("energy", period, n)} />
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title">
          <Dumbbell size={18} /> Workout
        </h2>
        <div className="workout-toggle">
          <button
            className={`toggle-btn ${today.workout.done === true ? "active yes" : ""}`}
            onClick={() => logEntry("workout", "done", true)}
          >
            <Check size={16} /> Yes
          </button>
          <button
            className={`toggle-btn ${today.workout.done === false ? "active no" : ""}`}
            onClick={() => logEntry("workout", "done", false)}
          >
            <X size={16} /> {today.is_training_day ? "Skip" : "No"}
          </button>
        </div>
        {today.workout.done && (
          <div className="motivation-section">
            <span className="period-label">motivation</span>
            <ScoreSelector value={today.workout.motivation} onSelect={(n) => logEntry("workout", "motivation", n)} />
          </div>
        )}
      </section>

      {timingGroups.length === 0 ? (
        <section className="card">
          <h2 className="card-title"><Pill size={18} /> Supplements</h2>
          <p className="empty-text">No supplements configured yet.</p>
        </section>
      ) : (
        timingGroups.map(({ timing, items }) => (
          <section key={timing} className="card">
            <h2 className="card-title">
              <Clock size={18} /> {TIMING_LABELS[timing] ?? timing}
            </h2>
            <ul className="supplement-checklist">
              {items.map(({ supplement, taken }) => (
                <li key={supplement.id} className="supplement-item">
                  <button
                    className={`check-btn ${taken ? "checked" : ""}`}
                    onClick={() => logEntry("supplement", supplement.id, !taken)}
                  >
                    {taken && <Check size={16} />}
                  </button>
                  <div className="supplement-info">
                    <span className="supplement-name">{supplement.name}</span>
                    <span className="supplement-dose">
                      {supplement.dose} {supplement.unit}
                    </span>
                    {supplement.notes && <span className="supplement-notes">{supplement.notes}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
