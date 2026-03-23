import { useStore } from "../data/store";
import TodayHeader from "../components/TodayHeader";
import SleepCard from "../components/SleepCard";
import EnergyCard from "../components/EnergyCard";
import WorkoutCard from "../components/WorkoutCard";
import SupplementsSection from "../components/SupplementsSection";

export default function Today() {
  const initialLoading = useStore((s) => s.initialLoading);
  if (initialLoading) return null;

  return (
    <div>
      <TodayHeader />
      <SleepCard />
      <EnergyCard />
      <WorkoutCard />
      <SupplementsSection />
    </div>
  );
}
