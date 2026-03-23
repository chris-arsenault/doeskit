import { memo } from "react";
import styles from "./ScoreSelector.module.css";

type Props = {
  value: number | null;
  onSelect: (n: number) => void;
  max?: number;
};

const ScoreSelector = memo(function ScoreSelector({ value, onSelect, max = 10 }: Props) {
  return (
    <div className={styles.row}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={`${styles.btn} ${value === n ? styles.active : ""}`}
          onClick={() => onSelect(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
});

export default ScoreSelector;
