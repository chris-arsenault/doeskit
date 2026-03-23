import { memo } from "react";
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

  return (
    <div className={styles.period}>
      <span className={shared.periodLabel}>{period}</span>
      <ScoreSelector value={value} onSelect={(n) => logEnergy(period, n)} />
    </div>
  );
});

export default EnergyPeriod;
