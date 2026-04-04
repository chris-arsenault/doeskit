import { describe, it, expect } from "vitest";
import { displayName, getBrandColumns, buildPayload } from "./helpers";

// ── displayName ────────────────────────────────────────────

describe("displayName", () => {
  it("prefers name when present", () => {
    expect(displayName({ name: "Alice", email: "a@b.com", "cognito:username": "u" })).toBe("Alice");
  });

  it("falls back to email when name is missing", () => {
    expect(displayName({ email: "a@b.com", "cognito:username": "u" })).toBe("a@b.com");
  });

  it("falls back to cognito:username", () => {
    expect(displayName({ "cognito:username": "alice123" })).toBe("alice123");
  });

  it("returns empty string when all fields are missing", () => {
    expect(displayName({})).toBe("");
  });

  it("skips empty name string", () => {
    expect(displayName({ name: "", email: "a@b.com" })).toBe("a@b.com");
  });

  it("skips non-string values", () => {
    expect(displayName({ name: 42, email: null, "cognito:username": "u" })).toBe("u");
  });
});

// ── getBrandColumns ────────────────────────────────────────

const r = (brand_id: string, brand_name: string) => ({
  type_id: "t",
  brand_id,
  brand_name,
  not_found: false,
  notes: null,
  last_researched: "",
});

describe("getBrandColumns", () => {
  it("extracts unique brands preserving insertion order", () => {
    expect(getBrandColumns([r("thorne", "Thorne"), r("nutricost", "Nutricost")])).toEqual([
      { id: "thorne", name: "Thorne" },
      { id: "nutricost", name: "Nutricost" },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(getBrandColumns([])).toEqual([]);
  });

  it("deduplicates by brand_id, keeps first name", () => {
    expect(getBrandColumns([r("x", "First"), r("x", "Second")])).toEqual([
      { id: "x", name: "First" },
    ]);
  });
});

// ── buildPayload ───────────────────────────────────────────

const full = (overrides: Record<string, string> = {}) => ({
  product_name: "Test",
  serving_dose: "5",
  serving_unit: "g",
  units_per_serving: "1",
  unit_name: "scoop",
  form: "scoop",
  instructions: "",
  url: "",
  price_per_serving: "",
  subscription_discount: "",
  ...overrides,
});

describe("buildPayload: type coercion", () => {
  it("converts numeric strings to numbers", () => {
    const p = buildPayload(full({ serving_dose: "5", price_per_serving: "0.50" }));
    expect(p.serving_dose).toBe(5);
    expect(p.price_per_serving).toBe(0.5);
  });

  it("keeps string fields as strings", () => {
    const p = buildPayload(full({ product_name: "Creatine", serving_unit: "g" }));
    expect(p.product_name).toBe("Creatine");
    expect(p.serving_unit).toBe("g");
  });

  it("handles decimal values", () => {
    const p = buildPayload(full({ price_per_serving: "0.08" }));
    expect(p.price_per_serving).toBeCloseTo(0.08);
  });
});

describe("buildPayload: null handling", () => {
  it("converts empty strings to null", () => {
    const p = buildPayload(full({ product_name: "", serving_dose: "" }));
    expect(p.product_name).toBeNull();
    expect(p.serving_dose).toBeNull();
  });

  it("preserves zero as a number, not null", () => {
    const p = buildPayload(full({ serving_dose: "0", price_per_serving: "0" }));
    expect(p.serving_dose).toBe(0);
    expect(p.price_per_serving).toBe(0);
  });
});
