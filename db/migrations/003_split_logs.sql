-- Replace generic logs table with purpose-built tables

DROP TABLE IF EXISTS logs;

CREATE TABLE day_log (
  date                DATE PRIMARY KEY,
  sleep               INT,
  energy_morning      INT,
  energy_afternoon    INT,
  energy_evening      INT,
  workout_done        BOOL,
  workout_motivation  INT
);

CREATE TABLE supplement_logs (
  date      DATE NOT NULL REFERENCES day_log(date),
  type_id   TEXT NOT NULL REFERENCES supplement_types(id) ON DELETE CASCADE,
  brand_id  TEXT NOT NULL REFERENCES supplement_brands(id) ON DELETE CASCADE,
  taken     BOOL NOT NULL DEFAULT false,
  PRIMARY KEY (date, type_id)
);
