import { Zap } from "lucide-react";
import EnergyPeriod from "./EnergyPeriod";
import shared from "../styles/shared.module.css";

export default function EnergyCard() {
  return (
    <section className={shared.card}>
      <h2 className={shared.cardTitle}>
        <Zap size={18} /> Energy
      </h2>
      <EnergyPeriod period="morning" />
      <EnergyPeriod period="afternoon" />
      <EnergyPeriod period="evening" />
    </section>
  );
}
