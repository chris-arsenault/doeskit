import { describe, it, expect } from "vitest";
import { offsetDate, flattenResponse, findMissingAutoSelections } from "./store";
import type { SupplementType, SupplementBrand, DailyDose } from "./store";

// ── offsetDate ─────────────────────────────────────────────

describe("offsetDate", () => {
  it("adds days", () => {
    expect(offsetDate("2026-04-01", 3)).toBe("2026-04-04");
  });

  it("subtracts days", () => {
    expect(offsetDate("2026-04-04", -4)).toBe("2026-03-31");
  });

  it("crosses month boundary forward", () => {
    expect(offsetDate("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("crosses year boundary forward", () => {
    expect(offsetDate("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("crosses year boundary backward", () => {
    expect(offsetDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap year Feb 28 -> 29", () => {
    expect(offsetDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("handles non-leap year Feb 28 -> Mar 1", () => {
    expect(offsetDate("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("offset of zero returns same date", () => {
    expect(offsetDate("2026-04-04", 0)).toBe("2026-04-04");
  });
});

// ── flattenResponse ────────────────────────────────────────

function makeType(id: string): SupplementType {
  return {
    id,
    name: id,
    timing: "morning",
    training_day_only: false,
    active: true,
    target_dose: 200,
    target_unit: "mg",
    sort_order: 0,
  };
}

function makeBrand(typeId: string): SupplementBrand {
  return {
    id: `${typeId}-brand`,
    type_id: typeId,
    brand_id: "test",
    brand_name: "Test",
    product_name: "Test Product",
    serving_dose: 200,
    serving_unit: "mg",
    units_per_serving: 1,
    unit_name: "capsule",
    form: "pill",
    in_stock: true,
  };
}

function makeDoseEntry(typeId: string, taken: boolean) {
  return {
    dose: {
      supplement_type: makeType(typeId),
      brand: makeBrand(typeId),
      servings_needed: 1,
      dose_label: "1 capsule",
    } as DailyDose,
    taken,
  };
}

describe("flattenResponse", () => {
  it("extracts taken map keyed by supplement type id", () => {
    const resp = {
      date: "2026-04-04",
      is_training_day: true,
      doses: [makeDoseEntry("creatine", true), makeDoseEntry("zinc", false)],
      sleep: 8,
      energy: { morning: 4, afternoon: 3, evening: null },
      workout: { done: true, motivation: 4 },
    };
    const result = flattenResponse(resp);
    expect(result.taken).toEqual({ creatine: true, zinc: false });
  });

  it("flattens doses to DailyDose array", () => {
    const resp = {
      date: "2026-04-04",
      is_training_day: false,
      doses: [makeDoseEntry("creatine", true)],
      sleep: null,
      energy: { morning: null, afternoon: null, evening: null },
      workout: { done: null, motivation: null },
    };
    const result = flattenResponse(resp);
    expect(result.doses).toHaveLength(1);
    expect(result.doses[0].supplement_type.id).toBe("creatine");
  });

  it("maps all scalar fields correctly", () => {
    const resp = {
      date: "2026-04-04",
      is_training_day: true,
      doses: [],
      sleep: 7,
      energy: { morning: 5, afternoon: 3, evening: 2 },
      workout: { done: false, motivation: 2 },
    };
    const result = flattenResponse(resp);
    expect(result.date).toBe("2026-04-04");
    expect(result.isTrainingDay).toBe(true);
    expect(result.sleep).toBe(7);
    expect(result.energy).toEqual({ morning: 5, afternoon: 3, evening: 2 });
    expect(result.workoutDone).toBe(false);
    expect(result.workoutMotivation).toBe(2);
    expect(result.initialLoading).toBe(false);
  });

  it("handles empty doses", () => {
    const resp = {
      date: "2026-04-04",
      is_training_day: false,
      doses: [],
      sleep: null,
      energy: { morning: null, afternoon: null, evening: null },
      workout: { done: null, motivation: null },
    };
    const result = flattenResponse(resp);
    expect(result.doses).toEqual([]);
    expect(result.taken).toEqual({});
  });

  it("preserves null values for optional fields", () => {
    const resp = {
      date: "2026-04-04",
      is_training_day: false,
      doses: [],
      sleep: null,
      energy: { morning: null, afternoon: null, evening: null },
      workout: { done: null, motivation: null },
    };
    const result = flattenResponse(resp);
    expect(result.sleep).toBeNull();
    expect(result.workoutDone).toBeNull();
    expect(result.workoutMotivation).toBeNull();
  });
});

// ── findMissingAutoSelections (moved from autoSelect.test.ts) ──

function makeAutoType(overrides: Partial<SupplementType> & { id: string }): SupplementType {
  return {
    name: overrides.id,
    timing: "morning",
    training_day_only: false,
    active: true,
    target_dose: 200,
    target_unit: "mg",
    sort_order: 0,
    ...overrides,
  };
}

function makeAutoBrand(typeId: string, brandId: string): SupplementBrand {
  return {
    id: brandId,
    type_id: typeId,
    brand_id: "test",
    brand_name: "Test",
    product_name: "Test Product",
    serving_dose: 200,
    serving_unit: "mg",
    units_per_serving: 1,
    unit_name: "capsule",
    form: "pill",
    in_stock: true,
  };
}

describe("findMissingAutoSelections", () => {
  it("returns the sole brand for an active type with no selection", () => {
    const types = [makeAutoType({ id: "l-theanine" })];
    const brands = [makeAutoBrand("l-theanine", "theanine-nutricost")];
    expect(findMissingAutoSelections(types, brands, {})).toEqual([
      { typeId: "l-theanine", brandId: "theanine-nutricost" },
    ]);
  });

  it("skips types that already have a selection", () => {
    const types = [makeAutoType({ id: "creatine" })];
    const brands = [makeAutoBrand("creatine", "creatine-thorne")];
    expect(findMissingAutoSelections(types, brands, { creatine: "creatine-thorne" })).toEqual([]);
  });

  it("skips inactive types", () => {
    const types = [makeAutoType({ id: "l-theanine", active: false })];
    const brands = [makeAutoBrand("l-theanine", "theanine-nutricost")];
    expect(findMissingAutoSelections(types, brands, {})).toEqual([]);
  });

  it("skips types with multiple brands", () => {
    const types = [makeAutoType({ id: "creatine" })];
    const brands = [
      makeAutoBrand("creatine", "creatine-thorne"),
      makeAutoBrand("creatine", "creatine-thorne-agpc"),
    ];
    expect(findMissingAutoSelections(types, brands, {})).toEqual([]);
  });

  it("skips types with zero brands", () => {
    expect(findMissingAutoSelections([makeAutoType({ id: "orphan" })], [], {})).toEqual([]);
  });

  it("handles mix: returns only single-brand unselected active types", () => {
    const types = [
      makeAutoType({ id: "l-theanine" }),
      makeAutoType({ id: "creatine" }),
      makeAutoType({ id: "zinc", active: false }),
    ];
    const brands = [
      makeAutoBrand("l-theanine", "theanine-nutricost"),
      makeAutoBrand("creatine", "creatine-thorne"),
      makeAutoBrand("creatine", "creatine-thorne-agpc"),
      makeAutoBrand("zinc", "zinc-nutricost"),
    ];
    expect(findMissingAutoSelections(types, brands, {})).toEqual([
      { typeId: "l-theanine", brandId: "theanine-nutricost" },
    ]);
  });
});
