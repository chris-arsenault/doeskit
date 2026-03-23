import { useEffect, useState } from "react";
import { apiGet } from "../data/api";
import { Check, X, Moon, Zap, Dumbbell } from "lucide-react";
import shared from "../styles/shared.module.css";
import styles from "./History.module.css";

type DaySummary = {
  date: string;
  sleep: number | null;
  energy_avg: number | null;
  workout: boolean | null;
  supplements_taken: number;
  supplements_total: number;
};

export default function History() {
  const [days, setDays] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DaySummary[]>("/history?days=14")
      .then(setDays)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={shared.loadingState}>
        <div className={shared.spinner} />
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.title}>History</h1>
      {days.length === 0 ? (
        <p className={shared.emptyText}>No logged days yet.</p>
      ) : (
        <ul className={styles.list}>
          {days.map((day) => (
            <li key={day.date} className={`${shared.card} ${styles.day}`}>
              <div className={styles.date}>{formatShortDate(day.date)}</div>
              <div className={styles.stats}>
                <Stat icon={<Moon size={14} />} value={day.sleep} />
                <Stat
                  icon={<Zap size={14} />}
                  value={day.energy_avg != null ? Math.round(day.energy_avg) : null}
                />
                <WorkoutStat workout={day.workout} />
                <span className={`${styles.stat} ${styles.suppStat}`}>
                  {day.supplements_taken}/{day.supplements_total}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number | null }) {
  return (
    <span className={styles.stat}>
      {icon}
      {value != null ? value : <span className={shared.muted}>-</span>}
    </span>
  );
}

function WorkoutStat({ workout }: { workout: boolean | null }) {
  if (workout === true)
    return (
      <span className={styles.stat}>
        <Dumbbell size={14} />
        <Check size={14} className={styles.yes} />
      </span>
    );
  if (workout === false)
    return (
      <span className={styles.stat}>
        <Dumbbell size={14} />
        <X size={14} className={styles.no} />
      </span>
    );
  return (
    <span className={styles.stat}>
      <Dumbbell size={14} />
      <span className={shared.muted}>-</span>
    </span>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
