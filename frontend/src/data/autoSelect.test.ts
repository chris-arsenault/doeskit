import { describe, it, expect } from "vitest";
import { findMissingAutoSelections } from "./store";
import type { SupplementType, SupplementBrand } from "./store";

function makeType(overrides: Partial<SupplementType> & { id: string }): SupplementType {
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

function makeBrand(typeId: string, brandId: string): SupplementBrand {
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
    const types = [makeType({ id: "l-theanine" })];
    const brands = [makeBrand("l-theanine", "theanine-nutricost")];
    const selections: Record<string, string> = {};

    const result = findMissingAutoSelections(types, brands, selections);
    expect(result).toEqual([{ typeId: "l-theanine", brandId: "theanine-nutricost" }]);
  });

  it("skips types that already have a selection", () => {
    const types = [makeType({ id: "creatine" })];
    const brands = [makeBrand("creatine", "creatine-thorne")];
    const selections = { creatine: "creatine-thorne" };

    expect(findMissingAutoSelections(types, brands, selections)).toEqual([]);
  });

  it("skips inactive types", () => {
    const types = [makeType({ id: "l-theanine", active: false })];
    const brands = [makeBrand("l-theanine", "theanine-nutricost")];

    expect(findMissingAutoSelections(types, brands, {})).toEqual([]);
  });

  it("skips types with multiple brands (user must choose)", () => {
    const types = [makeType({ id: "creatine" })];
    const brands = [
      makeBrand("creatine", "creatine-thorne"),
      makeBrand("creatine", "creatine-thorne-agpc"),
    ];

    expect(findMissingAutoSelections(types, brands, {})).toEqual([]);
  });

  it("skips types with zero brands", () => {
    const types = [makeType({ id: "orphan" })];
    expect(findMissingAutoSelections(types, [], {})).toEqual([]);
  });

  it("handles multiple types, returning only those needing auto-select", () => {
    const types = [
      makeType({ id: "l-theanine" }),
      makeType({ id: "creatine" }),
      makeType({ id: "zinc", active: false }),
    ];
    const brands = [
      makeBrand("l-theanine", "theanine-nutricost"),
      makeBrand("creatine", "creatine-thorne"),
      makeBrand("creatine", "creatine-thorne-agpc"),
      makeBrand("zinc", "zinc-nutricost"),
    ];
    const selections = {};

    const result = findMissingAutoSelections(types, brands, selections);
    expect(result).toEqual([{ typeId: "l-theanine", brandId: "theanine-nutricost" }]);
  });
});
