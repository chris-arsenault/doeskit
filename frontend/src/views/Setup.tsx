import { useEffect, useState, type FormEvent } from "react";
import { useStore, type SupplementType, type SupplementBrand, type Cycle } from "../data/store";
import { apiPost, apiDelete } from "../data/api";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import shared from "../styles/shared.module.css";
import styles from "./Setup.module.css";

const DAY_OPTIONS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function Setup() {
  const types = useStore((s) => s.allTypes);
  const brands = useStore((s) => s.allBrands);
  const cycles = useStore((s) => s.cycles);
  const schedule = useStore((s) => s.schedule);
  const loadTypes = useStore((s) => s.loadTypes);
  const loadBrands = useStore((s) => s.loadBrands);
  const loadCycles = useStore((s) => s.loadCycles);
  const loadSchedule = useStore((s) => s.loadSchedule);

  useEffect(() => {
    loadTypes();
    loadBrands();
    loadCycles();
    loadSchedule();
  }, [loadTypes, loadBrands, loadCycles, loadSchedule]);

  return (
    <div>
      <h1 className={styles.title}>Setup</h1>
      <ScheduleSection schedule={schedule} onChanged={loadSchedule} />
      <CyclesSection cycles={cycles} onChanged={loadCycles} />
      <TypesSection types={types} brands={brands} cycles={cycles} />
    </div>
  );
}

function ScheduleSection({ schedule, onChanged }: { schedule: { days: string[] }; onChanged: () => void }) {
  const toggleDay = async (day: string) => {
    const days = schedule.days.includes(day)
      ? schedule.days.filter((d) => d !== day)
      : [...schedule.days, day];
    await apiPost("/schedule", { days });
    onChanged();
  };

  return (
    <section className={shared.card}>
      <h2 className={shared.cardTitle}>Training Schedule</h2>
      <div className={styles.dayPicker}>
        {DAY_OPTIONS.map((day) => (
          <button
            key={day}
            className={`${styles.dayBtn} ${schedule.days.includes(day) ? styles.dayActive : ""}`}
            onClick={() => toggleDay(day)}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>
    </section>
  );
}

function TypesSection({
  types,
  brands,
  cycles,
}: {
  types: SupplementType[];
  brands: SupplementBrand[];
  cycles: Cycle[];
}) {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const setActiveBrand = useStore((s) => s.setActiveBrand);
  const doses = useStore((s) => s.doses);

  return (
    <section className={shared.card}>
      <h2 className={shared.cardTitle}>Supplements</h2>
      {types.length === 0 ? (
        <p className={shared.emptyText}>No supplement types configured.</p>
      ) : (
        <ul className={styles.list}>
          {types.map((t) => {
            const typeBrands = brands.filter((b) => b.type_id === t.id);
            const activeDose = doses.find((d) => d.supplement_type.id === t.id);
            const activeBrand = activeDose?.brand ?? typeBrands[0];
            const expanded = expandedType === t.id;
            const cycle = cycles.find((c) => c.id === t.cycle_id);

            return (
              <li key={t.id} className={styles.typeItem}>
                <button
                  className={styles.typeHeader}
                  onClick={() => setExpandedType(expanded ? null : t.id)}
                >
                  <div>
                    <strong>{t.name}</strong>
                    <span className={shared.muted}>
                      {t.target_dose} {t.target_unit} &middot; {t.timing.replace("_", "-")}
                      {t.training_day_only ? " (training)" : ""}
                      {cycle ? ` (${cycle.name})` : ""}
                    </span>
                    {activeBrand && (
                      <span className={shared.muted}>
                        Active: {activeBrand.brand} {activeBrand.product_name}
                      </span>
                    )}
                  </div>
                  {typeBrands.length > 1 && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                </button>
                {expanded && typeBrands.length > 1 && (
                  <div className={styles.brandList}>
                    {typeBrands.map((b) => (
                      <button
                        key={b.id}
                        className={`${styles.brandBtn} ${activeBrand && b.id === activeBrand.id ? styles.brandActive : ""}`}
                        onClick={() => setActiveBrand(t.id, b.id)}
                      >
                        <span className={styles.brandName}>{b.brand} {b.product_name}</span>
                        <span className={shared.muted}>{b.serving_size} = {b.serving_dose} {b.serving_unit}</span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CyclesSection({ cycles, onChanged }: { cycles: Cycle[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await apiPost("/cycles", {
      name: fd.get("name"),
      weeks_on: Number(fd.get("weeks_on")),
      weeks_off: Number(fd.get("weeks_off")),
      start_date: fd.get("start_date"),
    });
    setAdding(false);
    onChanged();
  };

  const handleDelete = async (id: string) => {
    await apiDelete(`/cycles/${id}`);
    onChanged();
  };

  return (
    <section className={shared.card}>
      <div className={shared.cardHeader}>
        <h2 className={shared.cardTitle}>Cycles</h2>
        <button className={shared.iconBtn} onClick={() => setAdding(!adding)}>
          <Plus size={18} />
        </button>
      </div>
      {adding && (
        <form className={shared.inlineForm} onSubmit={handleAdd}>
          <input name="name" placeholder="Cycle name" required />
          <input name="weeks_on" type="number" placeholder="Weeks on" min="1" required />
          <input name="weeks_off" type="number" placeholder="Weeks off" min="1" required />
          <input name="start_date" type="date" required />
          <button type="submit" className={`${shared.btnPrimary} ${shared.btnSm}`}>Add</button>
        </form>
      )}
      {cycles.length === 0 ? (
        <p className={shared.emptyText}>No cycles configured.</p>
      ) : (
        <ul className={styles.list}>
          {cycles.map((c) => (
            <li key={c.id} className={styles.item}>
              <div>
                <strong>{c.name}</strong>
                <span className={shared.muted}>
                  {c.weeks_on}w on / {c.weeks_off}w off &middot; started {c.start_date}
                </span>
              </div>
              <button className={`${shared.iconBtn} ${shared.iconBtnDanger}`} onClick={() => handleDelete(c.id)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
