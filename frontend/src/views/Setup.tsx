import { useEffect, useState, type FormEvent } from "react";
import { useStore, type Supplement, type Cycle } from "../data/store";
import { apiPost, apiDelete } from "../data/api";
import { Plus, Trash2 } from "lucide-react";

export default function Setup() {
  const supplements = useStore((s) => s.supplements);
  const cycles = useStore((s) => s.cycles);
  const loadSupplements = useStore((s) => s.loadSupplements);
  const loadCycles = useStore((s) => s.loadCycles);

  useEffect(() => {
    loadSupplements();
    loadCycles();
  }, [loadSupplements, loadCycles]);

  return (
    <div className="view setup-view">
      <h1>Setup</h1>
      <CyclesSection cycles={cycles} onChanged={loadCycles} />
      <SupplementsSection supplements={supplements} cycles={cycles} onChanged={loadSupplements} />
    </div>
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
          <select name="cycle_id">
            <option value="">No cycle (daily)</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
                  {s.dose} {s.unit}
                  {s.cycle_id ? ` (${cycles.find((c) => c.id === s.cycle_id)?.name ?? "cycle"})` : " (daily)"}
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
