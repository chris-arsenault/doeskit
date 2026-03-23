import { useStore } from "../data/store";
import styles from "./TodayHeader.module.css";

export default function TodayHeader() {
  const date = useStore((s) => s.date);
  const isTrainingDay = useStore((s) => s.isTrainingDay);

  return (
    <h1 className={styles.date}>
      {formatDate(date)}
      {isTrainingDay && <span className={styles.badge}>Training Day</span>}
    </h1>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
