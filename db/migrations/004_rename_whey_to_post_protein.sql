-- Rename whey type to post-protein (preserves all FK references)

INSERT INTO supplement_types (id, name, timing, training_day_only, cycle_id, target_dose, target_unit, instructions, sort_order)
  SELECT 'post-protein', 'Post-Workout Protein', timing, training_day_only, cycle_id, target_dose, target_unit, instructions, sort_order
  FROM supplement_types WHERE id = 'whey';

UPDATE supplement_brands SET type_id = 'post-protein' WHERE type_id = 'whey';
UPDATE supplement_logs SET type_id = 'post-protein' WHERE type_id = 'whey';
UPDATE active_selections SET type_id = 'post-protein' WHERE type_id = 'whey';

DELETE FROM supplement_types WHERE id = 'whey';
