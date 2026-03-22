-- Create dosekit application user
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dosekit_app') THEN
    CREATE ROLE dosekit_app LOGIN PASSWORD 'dosekit_app_password';
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE dosekit TO dosekit_app;

-- Cycles (e.g., ashwagandha 8 weeks on / 4 weeks off)
CREATE TABLE cycles (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  weeks_on   INTEGER NOT NULL,
  weeks_off  INTEGER NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplements
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

-- Daily log entries
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

-- Config (training schedule, etc.)
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Grant permissions to app user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dosekit_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dosekit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO dosekit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO dosekit_app;
