-- ═══════════════════════════════════════════════════════════
-- Normalize brand identity, add research + pricing + stock
-- ═══════════════════════════════════════════════════════════

-- 1. Create brands table
CREATE TABLE brands (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 2. Backfill brands from existing supplement_brands.brand
INSERT INTO brands (id, name)
  SELECT DISTINCT
    lower(replace(replace(brand, ' ', '-'), '''', '')),
    brand
  FROM supplement_brands
ON CONFLICT (id) DO NOTHING;

-- 3. Add brand_id FK to supplement_brands
ALTER TABLE supplement_brands ADD COLUMN brand_id TEXT;

UPDATE supplement_brands SET brand_id = (
  SELECT b.id FROM brands b WHERE b.name = supplement_brands.brand
);

ALTER TABLE supplement_brands ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE supplement_brands ADD CONSTRAINT fk_supplement_brands_brand
  FOREIGN KEY (brand_id) REFERENCES brands(id);

-- 4. Drop old text column
ALTER TABLE supplement_brands DROP COLUMN brand;

-- 5. Add pricing and stock columns
ALTER TABLE supplement_brands ADD COLUMN url TEXT;
ALTER TABLE supplement_brands ADD COLUMN price_per_serving NUMERIC;
ALTER TABLE supplement_brands ADD COLUMN subscription_discount NUMERIC;
ALTER TABLE supplement_brands ADD COLUMN in_stock BOOLEAN NOT NULL DEFAULT true;

-- 6. Create brand_research table
CREATE TABLE brand_research (
  type_id         TEXT NOT NULL REFERENCES supplement_types(id) ON DELETE CASCADE,
  brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  not_found       BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  last_researched DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (type_id, brand_id)
);

-- 7. Add Alpha GPC supplement type
INSERT INTO supplement_types (id, name, timing, training_day_only, active, cycle_id, target_dose, target_unit, instructions, sort_order)
VALUES ('alpha-gpc', 'Alpha GPC', 'morning', false, true, NULL, 600, 'mg', 'Cognitive support. Often paired with creatine.', 25)
ON CONFLICT (id) DO NOTHING;
