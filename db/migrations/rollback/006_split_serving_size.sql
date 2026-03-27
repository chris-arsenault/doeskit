ALTER TABLE supplement_brands ADD COLUMN serving_size TEXT NOT NULL DEFAULT '1 serving';
ALTER TABLE supplement_brands DROP COLUMN units_per_serving;
ALTER TABLE supplement_brands DROP COLUMN unit_name;
