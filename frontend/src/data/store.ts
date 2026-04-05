import { create } from "zustand";
import { apiGet, apiPost, apiPut } from "./api";

// ── Types ───────────────────────────────────────────────────

export type SupplementType = {
  id: string;
  name: string;
  timing: string;
  training_day_only: boolean;
  active: boolean;
  cycle_id?: string;
  target_dose: number;
  target_unit: string;
  instructions?: string;
  sort_order: number;
};

export type SupplementBrand = {
  id: string;
  type_id: string;
  brand_id: string;
  brand_name: string;
  product_name: string;
  serving_dose: number;
  serving_unit: string;
  units_per_serving: number;
  unit_name: string;
  form: string;
  instructions?: string;
  url?: string;
  price_per_serving?: number;
  subscription_discount?: number;
  in_stock: boolean;
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
  selectedDate: string;
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
  activeSelections: Record<string, string>; // type_id -> brand_id
  cycles: Cycle[];
  schedule: TrainingSchedule;

  _setToken: (token: string) => void;
  refresh: () => Promise<void>;
  navigateDay: (offset: number) => void;
  goToToday: () => void;
  logSleep: (score: number) => void;
  logEnergy: (period: string, score: number) => void;
  logWorkout: (done: boolean) => void;
  logMotivation: (score: number) => void;
  toggleSupplement: (typeId: string, brandId?: string) => void;
  loadTypes: () => Promise<void>;
  loadBrands: () => Promise<void>;
  loadCycles: () => Promise<void>;
  loadSchedule: () => Promise<void>;
  setActiveBrand: (typeId: string, brandId: string) => Promise<void>;
  updateType: (
    id: string,
    timing: string,
    trainingDayOnly: boolean,
    active: boolean
  ) => Promise<void>;
};

const LATE_NIGHT_CUTOFF_HOUR = 3;

function effectiveDate(): string {
  const now = new Date();
  if (now.getHours() < LATE_NIGHT_CUTOFF_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  return now.toLocaleDateString("en-CA");
}

export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function postLog(path: string, date: string, body: unknown, refresh: () => Promise<void>) {
  apiPost(`${path}?date=${date}`, body).catch(() => refresh());
}

function navigateTo(current: string, offset: number): string | null {
  const today = effectiveDate();
  const next = offsetDate(current, offset);
  return next > today ? null : next;
}

export function flattenResponse(resp: TodayResponse) {
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

const INITIAL_STATE = {
  initialLoading: true,
  error: null,
  date: "",
  isTrainingDay: false,
  sleep: null as number | null,
  energy: {
    morning: null as number | null,
    afternoon: null as number | null,
    evening: null as number | null,
  },
  workoutDone: null as boolean | null,
  workoutMotivation: null as number | null,
  doses: [] as DailyDose[],
  taken: {} as Record<string, boolean>,
  allTypes: [] as SupplementType[],
  allBrands: [] as SupplementBrand[],
  activeSelections: {} as Record<string, string>,
  cycles: [] as Cycle[],
  schedule: { days: [] } as TrainingSchedule,
};

export const useStore = create<DosekitStore>((set, get) => ({
  ...INITIAL_STATE,
  selectedDate: effectiveDate(),
  _setToken: () => get().refresh(),

  refresh: async () => {
    const { selectedDate } = get();
    if (get().date === "") set({ initialLoading: true, error: null });
    try {
      const resp = await apiGet<TodayResponse>(`/today?date=${selectedDate}`);
      set(flattenResponse(resp));
      if (get().allBrands.length === 0) get().loadBrands();
    } catch (e) {
      set({ error: (e as Error).message, initialLoading: false });
    }
  },

  navigateDay: (offset) => {
    const next = navigateTo(get().selectedDate, offset);
    if (next) {
      set({ selectedDate: next });
      get().refresh();
    }
  },
  goToToday: () => {
    set({ selectedDate: effectiveDate() });
    get().refresh();
  },

  logSleep: (score) => {
    set({ sleep: score });
    postLog("/log/sleep", get().selectedDate, { value: score }, get().refresh);
  },
  logEnergy: (period, score) => {
    set((s) => ({ energy: { ...s.energy, [period]: score } }));
    postLog("/log/energy", get().selectedDate, { period, value: score }, get().refresh);
  },
  logWorkout: (done) => {
    set({ workoutDone: done });
    postLog("/log/workout", get().selectedDate, { done }, get().refresh);
  },
  logMotivation: (score) => {
    set({ workoutMotivation: score });
    postLog("/log/workout", get().selectedDate, { motivation: score }, get().refresh);
  },
  toggleSupplement: (typeId, overrideBrandId) => {
    const newVal = !get().taken[typeId];
    set((s) => ({ taken: { ...s.taken, [typeId]: newVal } }));
    const dose = get().doses.find((d) => d.supplement_type.id === typeId);
    const brandId = overrideBrandId ?? dose?.brand.id ?? "";
    postLog(
      "/log/supplement",
      get().selectedDate,
      { type_id: typeId, brand_id: brandId, taken: newVal },
      get().refresh
    );
  },

  loadTypes: async () => set({ allTypes: await apiGet("/types") }),
  loadBrands: async () => {
    const [allBrands, activeSelections] = await Promise.all([
      apiGet<SupplementBrand[]>("/brands"),
      apiGet<Record<string, string>>("/selections"),
    ]);
    set({ allBrands, activeSelections });
  },
  loadCycles: async () => set({ cycles: await apiGet("/cycles") }),
  loadSchedule: async () => set({ schedule: await apiGet("/schedule") }),
  setActiveBrand: async (typeId, brandId) => {
    await apiPut(`/brands/${typeId}/active/${brandId}`);
    get().loadBrands();
    get().refresh();
  },
  updateType: async (id, timing, trainingDayOnly, active) => {
    await apiPut(`/types/${id}`, { timing, training_day_only: trainingDayOnly, active });
    get().loadTypes();
    get().refresh();
  },
}));
