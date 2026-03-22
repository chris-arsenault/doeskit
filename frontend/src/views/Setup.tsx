import { useEffect, useState, type FormEvent } from "react";
import { useStore, type Supplement, type Cycle } from "../data/store";
import { apiPost, apiDelete } from "../data/api";
import { Plus, Trash2 } from "lucide-react";

const TIMING_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "pre_workout", label: "Pre-Workout" },
  { value: "intra_workout", label: "Intra-Workout" },
  { value: "post_workout", label: "Post-Workout" },
  { value: "evening", label: "Evening" },
];

const DAY_OPTIONS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function Setup() {
  const supplements = useStore((s) => s.supplements);
  const cycles = useStore((s) => s.cycles);
  const schedule = useStore((s) => s.schedule);
  const loadSupplements = useStore((s) => s.loadSupplements);
  const loadCycles = useStore((s) => s.loadCycles);
  const loadSchedule = useStore((s) => s.loadSchedule);

  useEffect(() => {
    loadSupplements();
    loadCycles();
    loadSchedule();
  }, [loadSupplements, loadCycles, loadSchedule]);

  return (
    <div className="view setup-view">
      <h1>Setup</h1>
      <ScheduleSection schedule={schedule} onChanged={loadSchedule} />
      <CyclesSection cycles={cycles} onChanged={loadCycles} />
      <SupplementsSection supplements={supplements} cycles={cycles} onChanged={loadSupplements} />
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
    <section className="card">
      <h2 className="card-title">Training Schedule</h2>
      <div className="day-picker">
        {DAY_OPTIONS.map((day) => (
          <button
            key={day}
            className={`day-btn ${schedule.days.includes(day) ? "active" : ""}`}
            onClick={() => toggleDay(day)}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>
    </section>
  );
}

function SupplementsSection({
  supplements,
  cycles,
  onChanged,
}: {
  supplements: Supplement[];
  cycles: Cycle[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await apiPost("/supplements", {
      name: fd.get("name"),
      dose: fd.get("dose"),
      unit: fd.get("unit"),
      cycle_id: fd.get("cycle_id") || null,
      timing: fd.get("timing"),
      training_day_only: fd.get("training_day_only") === "on",
      notes: fd.get("notes") || null,
    });
    setAdding(false);
    onChanged();
  };

  const handleDelete = async (id: string) => {
    await apiDelete(`/supplements/${id}`);
    onChanged();
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Supplements</h2>
        <button className="icon-btn" onClick={() => setAdding(!adding)}>
          <Plus size={18} />
        </button>
      </div>
      {adding && (
        <form className="inline-form" onSubmit={handleAdd}>
          <input name="name" placeholder="Name" required />
          <input name="dose" placeholder="Dose" required />
          <input name="unit" placeholder="Unit (mg, ml...)" required />
          <select name="timing" defaultValue="morning">
            {TIMING_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select name="cycle_id">
            <option value="">No cycle (daily)</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="checkbox-label">
            <input name="training_day_only" type="checkbox" />
            Training days only
          </label>
          <input name="notes" placeholder="Notes (optional)" />
          <button type="submit" className="btn btn-primary btn-sm">
            Add
          </button>
        </form>
      )}
      {supplements.length === 0 ? (
        <p className="empty-text">No supplements yet. Add your first one above.</p>
      ) : (
        <ul className="setup-list">
          {supplements.map((s) => (
            <li key={s.id} className="setup-item">
              <div>
                <strong>{s.name}</strong>
                <span className="muted">
                  {s.dose} {s.unit} &middot; {s.timing.replace("_", "-")}
                  {s.training_day_only ? " (training only)" : ""}
                  {s.cycle_id ? ` (${cycles.find((c) => c.id === s.cycle_id)?.name ?? "cycle"})` : ""}
                </span>
              </div>
              <button className="icon-btn danger" onClick={() => handleDelete(s.id)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
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
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Cycles</h2>
        <button className="icon-btn" onClick={() => setAdding(!adding)}>
          <Plus size={18} />
        </button>
      </div>
      {adding && (
        <form className="inline-form" onSubmit={handleAdd}>
          <input name="name" placeholder="Cycle name" required />
          <input name="weeks_on" type="number" placeholder="Weeks on" min="1" required />
          <input name="weeks_off" type="number" placeholder="Weeks off" min="1" required />
          <input name="start_date" type="date" required />
          <button type="submit" className="btn btn-primary btn-sm">
            Add
          </button>
        </form>
      )}
      {cycles.length === 0 ? (
        <p className="empty-text">No cycles yet. Create one for on/off supplement schedules.</p>
      ) : (
        <ul className="setup-list">
          {cycles.map((c) => (
            <li key={c.id} className="setup-item">
              <div>
                <strong>{c.name}</strong>
                <span className="muted">
                  {c.weeks_on}w on / {c.weeks_off}w off &middot; started {c.start_date}
                </span>
              </div>
              <button className="icon-btn danger" onClick={() => handleDelete(c.id)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
