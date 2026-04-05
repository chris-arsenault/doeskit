import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useStore, type SupplementType, type SupplementBrand, type Cycle } from "../data/store";
import { apiPost, apiDelete } from "../data/api";
import {
  getNotificationSettings,
  updateNotificationSettings,
  requestNotificationPermission,
  type NotificationSettings,
} from "../data/notifications";
import TypeRow from "../components/TypeRow";
import { Plus, Trash2, Download } from "lucide-react";
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

  const exportStack = useCallback(() => {
    const activeSelections = useStore.getState().activeSelections;
    const data = types.map((t) => ({
      id: t.id,
      name: t.name,
      timing: t.timing,
      training_day_only: t.training_day_only,
      active: t.active,
      target_dose: t.target_dose,
      target_unit: t.target_unit,
      instructions: t.instructions,
      cycle: cycles.find((c) => c.id === t.cycle_id) ?? null,
      active_brand_id: activeSelections[t.id] ?? null,
      brands: brands
        .filter((b) => b.type_id === t.id)
        .map((b) => ({ ...b, is_active: b.id === activeSelections[t.id] })),
    }));
    const json = JSON.stringify({ schedule, supplements: data }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dosekit-stack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [types, brands, cycles, schedule]);

  return (
    <div>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Setup</h1>
        <button className={styles.exportBtn} onClick={exportStack} title="Export stack as JSON">
          <Download size={16} />
        </button>
      </div>
      <NotificationsSection />
      <ScheduleSection schedule={schedule} onChanged={loadSchedule} />
      <CyclesSection cycles={cycles} onChanged={loadCycles} />
      <TypesSection types={types} brands={brands} cycles={cycles} />
    </div>
  );
}

function NotificationsSection() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotificationSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  if (loading || !settings) return null;

  const toggle = async () => {
    if (!settings.enabled) {
      const ok = await requestNotificationPermission();
      if (!ok) return;
    }
    const next = { ...settings, enabled: !settings.enabled };
    await updateNotificationSettings(next);
    setSettings(next);
  };

  const update = async (field: keyof NotificationSettings, value: string) => {
    const next = { ...settings, [field]: value };
    setSettings(next);
    await updateNotificationSettings(next);
  };

  return (
    <section className={shared.card}>
      <div className={shared.cardHeader}>
        <h2 className={shared.cardTitle}>Notifications</h2>
        <button
          className={`${styles.togglePill} ${settings.enabled ? styles.toggleOn : ""}`}
          onClick={toggle}
        >
          {settings.enabled ? "On" : "Off"}
        </button>
      </div>
      {settings.enabled && <NotifTimeGrid settings={settings} onUpdate={update} />}
    </section>
  );
}

const NOTIF_FIELDS: Array<{ label: string; field: keyof NotificationSettings }> = [
  { label: "Morning doses", field: "morning_doses" },
  { label: "Energy (AM)", field: "energy_morning" },
  { label: "Energy (PM)", field: "energy_afternoon" },
  { label: "Energy (Eve)", field: "energy_evening" },
  { label: "Missed dose nudge", field: "missed_dose_nudge" },
  { label: "Evening wrap-up", field: "evening_wrapup" },
];

function NotifTimeGrid({
  settings,
  onUpdate,
}: {
  settings: NotificationSettings;
  onUpdate: (field: keyof NotificationSettings, value: string) => void;
}) {
  return (
    <div className={styles.notifGrid}>
      {NOTIF_FIELDS.map(({ label, field }) => (
        <TimeRow
          key={field}
          label={label}
          value={settings[field] as string}
          onChange={(v) => onUpdate(field, v)}
        />
      ))}
    </div>
  );
}

function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.controlRow}>
      <span className={styles.controlLabel}>{label}</span>
      <input
        type="time"
        className={styles.timingSelect}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ScheduleSection({
  schedule,
  onChanged,
}: {
  schedule: { days: string[] };
  onChanged: () => void;
}) {
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
  const activeSelections = useStore((s) => s.activeSelections);

  return (
    <section className={shared.card}>
      <h2 className={shared.cardTitle}>Supplements</h2>
      {types.length === 0 ? (
        <p className={shared.emptyText}>No supplement types configured.</p>
      ) : (
        <ul className={styles.list}>
          {types.map((t) => {
            const typeBrands = brands.filter((b) => b.type_id === t.id);
            const abId = activeSelections[t.id];
            const activeBrand = typeBrands.find((b) => b.id === abId) ?? typeBrands[0];
            return (
              <TypeRow
                key={t.id}
                type_={t}
                brands={typeBrands}
                activeBrand={activeBrand}
                cycle={cycles.find((c) => c.id === t.cycle_id)}
                expanded={expandedType === t.id}
                onToggle={() => setExpandedType(expandedType === t.id ? null : t.id)}
              />
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
          <button type="submit" className={`${shared.btnPrimary} ${shared.btnSm}`}>
            Add
          </button>
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
              <button
                className={`${shared.iconBtn} ${shared.iconBtnDanger}`}
                onClick={() => handleDelete(c.id)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
