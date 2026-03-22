import { useEffect, useState } from "react";
import { apiGet } from "../data/api";
import { Check, X, Moon, Zap, Dumbbell } from "lucide-react";

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

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;

  return (
    <div className="view history-view">
      <h1>History</h1>
      {days.length === 0 ? (
        <p className="empty-text">No logged days yet.</p>
      ) : (
        <ul className="history-list">
          {days.map((day) => (
            <li key={day.date} className="history-day card">
              <div className="history-date">{formatShortDate(day.date)}</div>
              <div className="history-stats">
                <Stat icon={<Moon size={14} />} value={day.sleep} />
                <Stat icon={<Zap size={14} />} value={day.energy_avg != null ? Math.round(day.energy_avg) : null} />
                <span className="stat">
                  <Dumbbell size={14} />
                  {day.workout === true ? <Check size={14} className="yes" /> : day.workout === false ? <X size={14} className="no" /> : <span className="muted">-</span>}
                </span>
                <span className="stat supplement-stat">
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
    <span className="stat">
      {icon}
      {value != null ? value : <span className="muted">-</span>}
    </span>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
