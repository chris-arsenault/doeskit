DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS active_selections;
DROP TABLE IF EXISTS supplement_brands;
DROP TABLE IF EXISTS supplement_types;

-- Restore original supplements table
CREATE TABLE supplements (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  dose              TEXT NOT NULL,
  unit              TEXT NOT NULL DEFAULT '',
  active            BOOLEAN NOT NULL DEFAULT true,
  cycle_id          TEXT REFERENCES cycles(id) ON DELETE SET NULL,
  timing            TEXT NOT NULL DEFAULT 'morning',
  training_day_only BOOLEAN NOT NULL DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
