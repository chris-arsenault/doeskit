DROP TABLE IF EXISTS supplement_logs;
DROP TABLE IF EXISTS day_log;

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
