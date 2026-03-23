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
  date: string;
  isTrainingDay: boolean;
  sleep: number | null;
  energy: { morning: number | null; afternoon: number | null; evening: number | null };
  workoutDone: boolean | null;
  workoutMotivation: number | null;
  doses: DailyDose[];
  taken: Record<string, boolean>;
  allTypes: SupplementType[];
  allBrands: SupplementBrand[];
  cycles: Cycle[];
  schedule: TrainingSchedule;

  _setToken: (token: string) => void;
  refresh: () => Promise<void>;
  logSleep: (score: number) => void;
  logEnergy: (period: string, score: number) => void;
  logWorkout: (done: boolean) => void;
  logMotivation: (score: number) => void;
  toggleSupplement: (typeId: string) => void;
  loadTypes: () => Promise<void>;
  loadBrands: () => Promise<void>;
  loadCycles: () => Promise<void>;
  loadSchedule: () => Promise<void>;
  setActiveBrand: (typeId: string, brandId: string) => Promise<void>;
};

function localDate() {
  return new Date().toLocaleDateString("en-CA");
}

function logAndRefresh(type: string, id: string, value: unknown, refresh: () => Promise<void>) {
  apiPost(`/log?date=${localDate()}`, { type, id, value }).catch(() => refresh());
}

function flattenResponse(resp: TodayResponse) {
  const taken: Record<string, boolean> = {};
  for (const d of resp.doses) {
    taken[d.dose.supplement_type.id] = d.taken;
  }
  return {
    date: resp.date,
    isTrainingDay: resp.is_training_day,
    sleep: resp.sleep,
    energy: resp.energy,
    workoutDone: resp.workout.done,
    workoutMotivation: resp.workout.motivation,
    doses: resp.doses.map((d) => d.dose),
    taken,
    initialLoading: false,
  };
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

  _setToken: () => get().refresh(),

  refresh: async () => {
    if (get().date === "") set({ initialLoading: true, error: null });
    try {
      const resp = await apiGet<TodayResponse>(`/today?date=${localDate()}`);
      set(flattenResponse(resp));
    } catch (e) {
      set({ error: (e as Error).message, initialLoading: false });
    }
  },

  logSleep: (score) => {
    set({ sleep: score });
    logAndRefresh("sleep", "score", score, get().refresh);
  },
  logEnergy: (period, score) => {
    set((s) => ({ energy: { ...s.energy, [period]: score } }));
    logAndRefresh("energy", period, score, get().refresh);
  },
  logWorkout: (done) => {
    set({ workoutDone: done });
    logAndRefresh("workout", "done", done, get().refresh);
  },
  logMotivation: (score) => {
    set({ workoutMotivation: score });
    logAndRefresh("workout", "motivation", score, get().refresh);
  },
  toggleSupplement: (typeId) => {
    const newVal = !get().taken[typeId];
    set((s) => ({ taken: { ...s.taken, [typeId]: newVal } }));
    logAndRefresh("supplement", typeId, newVal, get().refresh);
  },

  loadTypes: async () => set({ allTypes: await apiGet("/types") }),
  loadBrands: async () => set({ allBrands: await apiGet("/brands") }),
  loadCycles: async () => set({ cycles: await apiGet("/cycles") }),
  loadSchedule: async () => set({ schedule: await apiGet("/schedule") }),
  setActiveBrand: async (typeId, brandId) => {
    await apiPut(`/brands/${typeId}/active/${brandId}`);
    get().loadBrands();
    get().refresh();
  },
}));
