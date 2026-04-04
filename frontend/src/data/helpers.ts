/** Extract display name from JWT payload with fallback chain. */
export function displayName(payload: Record<string, unknown>): string {
  return (
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload["cognito:username"] === "string" && payload["cognito:username"]) ||
    ""
  );
}

type Brand = { id: string; name: string };
type Research = {
  type_id: string;
  brand_id: string;
  brand_name: string;
  not_found: boolean;
  notes: string | null;
  last_researched: string;
};

/** Extract unique brands from research array, preserving insertion order. */
export function getBrandColumns(research: Research[]): Brand[] {
  const seen = new Map<string, string>();
  for (const r of research) {
    if (!seen.has(r.brand_id)) seen.set(r.brand_id, r.brand_name);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

/** Transform form data to API payload, converting empty strings to null and numeric strings to numbers. */
export function buildPayload(f: Record<string, string>) {
  const optStr = (v: string) => v || null;
  const optNum = (v: string) => (v ? parseFloat(v) : null);
  return {
    product_name: optStr(f.product_name),
    serving_dose: optNum(f.serving_dose),
    serving_unit: optStr(f.serving_unit),
    units_per_serving: optNum(f.units_per_serving),
    unit_name: optStr(f.unit_name),
    form: optStr(f.form),
    instructions: optStr(f.instructions),
    url: optStr(f.url),
    price_per_serving: optNum(f.price_per_serving),
    subscription_discount: optNum(f.subscription_discount),
  };
}
