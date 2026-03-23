import { memo, useCallback } from "react";
import { useStore } from "../data/store";
import ScoreSelector from "./ScoreSelector";
import shared from "../styles/shared.module.css";
import styles from "./EnergyPeriod.module.css";

type Props = {
  period: "morning" | "afternoon" | "evening";
};

const EnergyPeriod = memo(function EnergyPeriod({ period }: Props) {
  const value = useStore((s) => s.energy[period]);
  const logEnergy = useStore((s) => s.logEnergy);
  const handleSelect = useCallback((n: number) => logEnergy(period, n), [logEnergy, period]);

  return (
    <div className={styles.period}>
      <span className={shared.periodLabel}>{period}</span>
      <ScoreSelector value={value} onSelect={handleSelect} />
    </div>
  );
});

export default EnergyPeriod;
