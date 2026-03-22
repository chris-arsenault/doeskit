import { create } from "zustand";
import { apiGet, apiPost } from "./api";

// ── Types ───────────────────────────────────────────────────

export type Supplement = {
  id: string;
  name: string;
  dose: string;
  unit: string;
  active: boolean;
  cycle_id?: string;
  timing: string;
  training_day_only: boolean;
  notes?: string;
};

export type Cycle = {
  id: string;
  name: string;
  weeks_on: number;
  weeks_off: number;
  start_date: string;
};

export type TrainingSchedule = {
  days: string[];
};

export type LogEntry = {
  type: "supplement" | "sleep" | "energy" | "workout";
  id: string;
  value: unknown;
  timestamp: string;
};

export type TodayState = {
  date: string;
  is_training_day: boolean;
  supplements: Array<{ supplement: Supplement; taken: boolean }>;
  sleep: number | null;
  energy: { morning: number | null; afternoon: number | null; evening: number | null };
  workout: { done: boolean | null; motivation: number | null };
};

// ── Store ───────────────────────────────────────────────────

type DosekitStore = {
  token: string;
  loading: boolean;
  error: string | null;
  today: TodayState | null;
  supplements: Supplement[];
  cycles: Cycle[];
  schedule: TrainingSchedule;

  _setToken: (token: string) => void;
  refresh: () => Promise<void>;
  loadSupplements: () => Promise<void>;
  loadCycles: () => Promise<void>;
  loadSchedule: () => Promise<void>;
  logEntry: (type: string, id: string, value: unknown) => Promise<void>;
};

export const useStore = create<DosekitStore>((set, get) => ({
  token: "",
  loading: true,
  error: null,
  today: null,
  supplements: [],
  cycles: [],
  schedule: { days: [] },

  _setToken: (token: string) => {
    set({ token });
    get().refresh();
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const today = await apiGet<TodayState>("/today");
      set({ today, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadSupplements: async () => {
    const supplements = await apiGet<Supplement[]>("/supplements");
    set({ supplements });
  },

  loadCycles: async () => {
    const cycles = await apiGet<Cycle[]>("/cycles");
    set({ cycles });
  },

  loadSchedule: async () => {
    const schedule = await apiGet<TrainingSchedule>("/schedule");
    set({ schedule });
  },

  logEntry: async (type: string, id: string, value: unknown) => {
    await apiPost("/log", { type, id, value });
    get().refresh();
  },
}));
