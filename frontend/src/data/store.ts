import { create } from "zustand";
import { apiGet, apiPost, apiPut } from "./api";

// ── Types ───────────────────────────────────────────────────

export type SupplementType = {
  id: string;
  name: string;
  timing: string;
  training_day_only: boolean;
  cycle_id?: string;
  target_dose: number;
  target_unit: string;
  instructions?: string;
  sort_order: number;
};

export type SupplementBrand = {
  id: string;
  type_id: string;
  brand: string;
  product_name: string;
  serving_dose: number;
  serving_unit: string;
  serving_size: string;
  form: string;
  instructions?: string;
};

export type DailyDose = {
  supplement_type: SupplementType;
  brand: SupplementBrand;
  servings_needed: number;
  dose_label: string;
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

type TodayResponse = {
  date: string;
  is_training_day: boolean;
  doses: Array<{ dose: DailyDose; taken: boolean }>;
  sleep: number | null;
  energy: { morning: number | null; afternoon: number | null; evening: number | null };
  workout: { done: boolean | null; motivation: number | null };
};

// ── Store ───────────────────────────────────────────────────

type DosekitStore = {
  initialLoading: boolean;
  error: string | null;

  // Today — flat slices
  date: string;
  isTrainingDay: boolean;
  sleep: number | null;
  energy: { morning: number | null; afternoon: number | null; evening: number | null };
  workoutDone: boolean | null;
  workoutMotivation: number | null;
  doses: DailyDose[];
  taken: Record<string, boolean>; // keyed by type ID

  // Setup
  allTypes: SupplementType[];
  allBrands: SupplementBrand[];
  cycles: Cycle[];
  schedule: TrainingSchedule;

  // Init
  _setToken: (token: string) => void;
  refresh: () => Promise<void>;

  // Granular log actions
  logSleep: (score: number) => void;
  logEnergy: (period: string, score: number) => void;
  logWorkout: (done: boolean) => void;
  logMotivation: (score: number) => void;
  toggleSupplement: (typeId: string) => void;

  // Setup actions
  loadTypes: () => Promise<void>;
  loadBrands: () => Promise<void>;
  loadCycles: () => Promise<void>;
  loadSchedule: () => Promise<void>;
  setActiveBrand: (typeId: string, brandId: string) => Promise<void>;
};

function localDate() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export const useStore = create<DosekitStore>((set, get) => ({
  initialLoading: true,
  error: null,

  date: "",
  isTrainingDay: false,
  sleep: null,
  energy: { morning: null, afternoon: null, evening: null },
  workoutDone: null,
  workoutMotivation: null,
  doses: [],
  taken: {},

  allTypes: [],
  allBrands: [],
  cycles: [],
  schedule: { days: [] },

  _setToken: () => {
    get().refresh();
  },

  refresh: async () => {
    const isInitial = get().date === "";
    if (isInitial) set({ initialLoading: true, error: null });
    try {
      const resp = await apiGet<TodayResponse>(`/today?date=${localDate()}`);
      const taken: Record<string, boolean> = {};
      for (const d of resp.doses) {
        taken[d.dose.supplement_type.id] = d.taken;
      }
      set({
        date: resp.date,
        isTrainingDay: resp.is_training_day,
        sleep: resp.sleep,
        energy: resp.energy,
        workoutDone: resp.workout.done,
        workoutMotivation: resp.workout.motivation,
        doses: resp.doses.map((d) => d.dose),
        taken,
        initialLoading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, initialLoading: false });
    }
  },

  logSleep: (score) => {
    set({ sleep: score });
    apiPost(`/log?date=${localDate()}`, { type: "sleep", id: "score", value: score }).catch(() => get().refresh());
  },

  logEnergy: (period, score) => {
    set((s) => ({ energy: { ...s.energy, [period]: score } }));
    apiPost(`/log?date=${localDate()}`, { type: "energy", id: period, value: score }).catch(() => get().refresh());
  },

  logWorkout: (done) => {
    set({ workoutDone: done });
    apiPost(`/log?date=${localDate()}`, { type: "workout", id: "done", value: done }).catch(() => get().refresh());
  },

  logMotivation: (score) => {
    set({ workoutMotivation: score });
    apiPost(`/log?date=${localDate()}`, { type: "workout", id: "motivation", value: score }).catch(() => get().refresh());
  },

  toggleSupplement: (typeId) => {
    const newVal = !get().taken[typeId];
    set((s) => ({ taken: { ...s.taken, [typeId]: newVal } }));
    apiPost(`/log?date=${localDate()}`, { type: "supplement", id: typeId, value: newVal }).catch(() => get().refresh());
  },

  loadTypes: async () => {
    const allTypes = await apiGet<SupplementType[]>("/types");
    set({ allTypes });
  },

  loadBrands: async () => {
    const allBrands = await apiGet<SupplementBrand[]>("/brands");
    set({ allBrands });
  },

  loadCycles: async () => {
    const cycles = await apiGet<Cycle[]>("/cycles");
    set({ cycles });
  },

  loadSchedule: async () => {
    const schedule = await apiGet<TrainingSchedule>("/schedule");
    set({ schedule });
  },

  setActiveBrand: async (typeId, brandId) => {
    await apiPut(`/brands/${typeId}/active/${brandId}`);
    get().loadBrands();
    get().refresh();
  },
}));
