import { describe, it, expect } from "vitest";
import { buildTimingGroups } from "./timingGroups";
import type { DailyDose, SupplementType, SupplementBrand } from "./store";

function makeDose(overrides: Partial<SupplementType> & { id: string }): DailyDose {
  const type_: SupplementType = {
    name: overrides.id,
    timing: "morning",
    training_day_only: false,
    active: true,
    target_dose: 1,
    target_unit: "serving",
    sort_order: 0,
    ...overrides,
  };
  const brand: SupplementBrand = {
    id: `${overrides.id}-brand`,
    type_id: overrides.id,
    brand_id: "test",
    brand_name: "Test",
    product_name: "Test Product",
    serving_dose: 1,
    serving_unit: "serving",
    units_per_serving: 1,
    unit_name: "serving",
    form: "pill",
    in_stock: true,
  };
  return { supplement_type: type_, brand, servings_needed: 1, dose_label: "1 serving" };
}

describe("buildTimingGroups: grouping", () => {
  it("groups daily supplements by timing", () => {
    const doses = [
      makeDose({ id: "a", timing: "morning" }),
      makeDose({ id: "b", timing: "evening" }),
      makeDose({ id: "c", timing: "morning" }),
    ];
    const groups = buildTimingGroups(doses, false, false);
    expect(groups).toHaveLength(2);
    expect(groups[0].timing).toBe("morning");
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].timing).toBe("evening");
  });

  it("preserves timing order", () => {
    const doses = [
      makeDose({ id: "a", timing: "evening" }),
      makeDose({ id: "b", timing: "morning" }),
      makeDose({ id: "c", timing: "pre_workout" }),
    ];
    const groups = buildTimingGroups(doses, true, false);
    expect(groups.map((g) => g.timing)).toEqual(["morning", "pre_workout", "evening"]);
  });

  it("returns empty for empty doses", () => {
    expect(buildTimingGroups([], true, false)).toEqual([]);
  });
});

describe("buildTimingGroups: training day filtering", () => {
  it("hides training-day-only supplements on rest days", () => {
    const doses = [
      makeDose({ id: "daily", timing: "morning", training_day_only: false }),
      makeDose({ id: "training", timing: "pre_workout", training_day_only: true }),
    ];
    const groups = buildTimingGroups(doses, false, false);
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].supplement_type.id).toBe("daily");
  });

  it("shows training-day-only supplements on training days", () => {
    const doses = [
      makeDose({ id: "daily", timing: "morning", training_day_only: false }),
      makeDose({ id: "training", timing: "pre_workout", training_day_only: true }),
    ];
    expect(buildTimingGroups(doses, true, false)).toHaveLength(2);
  });

  it("hides training-day-only supplements when workout skipped", () => {
    const doses = [
      makeDose({ id: "daily", timing: "morning", training_day_only: false }),
      makeDose({ id: "training", timing: "pre_workout", training_day_only: true }),
    ];
    const groups = buildTimingGroups(doses, true, true);
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].supplement_type.id).toBe("daily");
  });
});

describe("buildTimingGroups: timing collapse", () => {
  it("moves workout-window supplements to morning on rest days", () => {
    const doses = [
      makeDose({ id: "creatine", timing: "post_workout", training_day_only: false }),
      makeDose({ id: "collagen", timing: "pre_workout", training_day_only: false }),
    ];
    const groups = buildTimingGroups(doses, false, false);
    expect(groups).toHaveLength(1);
    expect(groups[0].timing).toBe("morning");
    expect(groups[0].items).toHaveLength(2);
  });

  it("keeps workout-window timing on training days", () => {
    const doses = [
      makeDose({ id: "creatine", timing: "post_workout", training_day_only: false }),
      makeDose({ id: "collagen", timing: "pre_workout", training_day_only: false }),
    ];
    const groups = buildTimingGroups(doses, true, false);
    expect(groups).toHaveLength(2);
    expect(groups[0].timing).toBe("pre_workout");
    expect(groups[1].timing).toBe("post_workout");
  });

  it("moves workout-window to morning when workout skipped", () => {
    const doses = [makeDose({ id: "collagen", timing: "pre_workout", training_day_only: false })];
    const groups = buildTimingGroups(doses, true, true);
    expect(groups).toHaveLength(1);
    expect(groups[0].timing).toBe("morning");
  });
});
