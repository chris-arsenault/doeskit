import { useStore } from "../data/store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./TodayHeader.module.css";

export default function TodayHeader() {
  const date = useStore((s) => s.date);
  const selectedDate = useStore((s) => s.selectedDate);
  const isTrainingDay = useStore((s) => s.isTrainingDay);
  const navigateDay = useStore((s) => s.navigateDay);
  const goToToday = useStore((s) => s.goToToday);

  const isToday = date === selectedDate && isEffectiveToday(date);

  return (
    <div className={styles.header}>
      <button className={styles.navBtn} onClick={() => navigateDay(-1)} aria-label="Previous day">
        <ChevronLeft size={20} />
      </button>
      <div className={styles.center}>
        <span className={styles.date}>{formatDate(date)}</span>
        {isTrainingDay && <span className={styles.badge}>Training</span>}
      </div>
      <button
        className={`${styles.navBtn} ${isToday ? styles.navDisabled : ""}`}
        onClick={() => navigateDay(1)}
        disabled={isToday}
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>
      {!isToday && (
        <button className={styles.todayBtn} onClick={goToToday}>
          Today
        </button>
      )}
    </div>
  );
}

function isEffectiveToday(dateStr: string): boolean {
  const now = new Date();
  const effective = new Date();
  if (now.getHours() < 3) effective.setDate(effective.getDate() - 1);
  return dateStr === effective.toLocaleDateString("en-CA");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getTime() === now.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
