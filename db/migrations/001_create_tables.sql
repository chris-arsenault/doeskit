-- Cycles (e.g., ashwagandha 8 weeks on / 4 weeks off)
CREATE TABLE IF NOT EXISTS cycles (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  weeks_on   INTEGER NOT NULL,
  weeks_off  INTEGER NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplements
CREATE TABLE IF NOT EXISTS supplements (
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

-- Daily log entries
CREATE TABLE IF NOT EXISTS logs (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL,
  entry_type TEXT NOT NULL,
  entry_id   TEXT NOT NULL,
  value      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, entry_type, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_logs_date ON logs (date);

-- Config (training schedule, etc.)
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
