import { useStore } from "../data/store";
import { Moon } from "lucide-react";
import ScoreSelector from "./ScoreSelector";
import shared from "../styles/shared.module.css";

export default function SleepCard() {
  const sleep = useStore((s) => s.sleep);
  const logSleep = useStore((s) => s.logSleep);

  return (
    <section className={shared.card}>
      <h2 className={shared.cardTitle}>
        <Moon size={18} /> Sleep
      </h2>
      <ScoreSelector value={sleep} onSelect={logSleep} />
    </section>
  );
}
