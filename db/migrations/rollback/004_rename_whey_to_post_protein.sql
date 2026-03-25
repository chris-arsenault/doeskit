INSERT INTO supplement_types (id, name, timing, training_day_only, cycle_id, target_dose, target_unit, instructions, sort_order)
  SELECT 'whey', 'Whey Protein', timing, training_day_only, cycle_id, target_dose, target_unit, instructions, sort_order
  FROM supplement_types WHERE id = 'post-protein';

UPDATE supplement_brands SET type_id = 'whey' WHERE type_id = 'post-protein';
UPDATE supplement_logs SET type_id = 'whey' WHERE type_id = 'post-protein';
UPDATE active_selections SET type_id = 'whey' WHERE type_id = 'post-protein';

DELETE FROM supplement_types WHERE id = 'post-protein';
