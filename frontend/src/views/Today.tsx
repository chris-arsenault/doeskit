import { useStore } from "../data/store";
import { Check, X, Moon, Zap, Dumbbell } from "lucide-react";

const ENERGY_PERIODS = ["morning", "afternoon", "evening"] as const;

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

export default function Today() {
  const today = useStore((s) => s.today);
  const logEntry = useStore((s) => s.logEntry);

  if (!today) return null;

  return (
    <div className="view today-view">
      <h1 className="view-date">{formatDate(today.date)}</h1>

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
            <X size={16} /> No
          </button>
        </div>
        {today.workout.done && (
          <div className="motivation-section">
            <span className="period-label">motivation</span>
            <ScoreSelector value={today.workout.motivation} onSelect={(n) => logEntry("workout", "motivation", n)} />
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Supplements</h2>
        {today.supplements.length === 0 ? (
          <p className="empty-text">No supplements configured yet.</p>
        ) : (
          <ul className="supplement-checklist">
            {today.supplements.map(({ supplement, taken }) => (
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
