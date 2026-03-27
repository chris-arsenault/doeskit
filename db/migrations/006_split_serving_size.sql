ALTER TABLE supplement_brands ADD COLUMN units_per_serving NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE supplement_brands ADD COLUMN unit_name TEXT NOT NULL DEFAULT 'serving';

-- Backfill from existing serving_size data
UPDATE supplement_brands SET units_per_serving = 2, unit_name = 'scoop' WHERE serving_size LIKE '2 scoop%';
UPDATE supplement_brands SET units_per_serving = 1, unit_name = 'scoop' WHERE serving_size LIKE '1 scoop%';
UPDATE supplement_brands SET units_per_serving = 1, unit_name = 'capsule' WHERE serving_size LIKE '1 capsule%';
UPDATE supplement_brands SET units_per_serving = 1, unit_name = 'softgel' WHERE serving_size LIKE '1 softgel%';
UPDATE supplement_brands SET units_per_serving = 1, unit_name = 'gelcap' WHERE serving_size LIKE '1 gelcap%';
UPDATE supplement_brands SET units_per_serving = 1, unit_name = 'drop' WHERE serving_size LIKE '1 drop%';

ALTER TABLE supplement_brands DROP COLUMN serving_size;
