-- Replace flat supplements table with type/brand model

DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS supplements;

-- Supplement types (what you take)
CREATE TABLE supplement_types (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  timing            TEXT NOT NULL DEFAULT 'morning',
  training_day_only BOOLEAN NOT NULL DEFAULT false,
  cycle_id          TEXT REFERENCES cycles(id) ON DELETE SET NULL,
  target_dose       NUMERIC NOT NULL DEFAULT 1,
  target_unit       TEXT NOT NULL DEFAULT 'serving',
  instructions      TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplement brands/formulations (catalog — no user state here)
CREATE TABLE supplement_brands (
  id                TEXT PRIMARY KEY,
  type_id           TEXT NOT NULL REFERENCES supplement_types(id) ON DELETE CASCADE,
  brand             TEXT NOT NULL,
  product_name      TEXT NOT NULL,
  serving_dose      NUMERIC NOT NULL,
  serving_unit      TEXT NOT NULL,
  serving_size      TEXT NOT NULL,
  form              TEXT NOT NULL DEFAULT 'pill',
  instructions      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User's active brand selection (one per type, separate from catalog)
CREATE TABLE active_selections (
  type_id   TEXT PRIMARY KEY REFERENCES supplement_types(id) ON DELETE CASCADE,
  brand_id  TEXT NOT NULL REFERENCES supplement_brands(id) ON DELETE CASCADE
);

-- Daily log entries (recreate with same schema)
CREATE TABLE logs (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL,
  entry_type TEXT NOT NULL,
  entry_id   TEXT NOT NULL,
  value      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, entry_type, entry_id)
);

CREATE INDEX idx_logs_date ON logs (date);
