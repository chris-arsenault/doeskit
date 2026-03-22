-- Training schedule
INSERT INTO config (key, value) VALUES
  ('training_schedule', '{"days": ["tuesday", "thursday", "saturday", "sunday"]}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Cycles
INSERT INTO cycles (id, name, weeks_on, weeks_off, start_date) VALUES
  ('ashwagandha-cycle', 'Ashwagandha 8/4', 8, 4, '2026-01-26')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, weeks_on = EXCLUDED.weeks_on,
  weeks_off = EXCLUDED.weeks_off, start_date = EXCLUDED.start_date;

-- Supplements
INSERT INTO supplements (id, name, dose, unit, active, cycle_id, timing, training_day_only, notes) VALUES
  ('creatine',      'Creatine Monohydrate',          '5',            'g',               true, NULL,                 'post_workout',  false, 'Take with any meal. On rest days, take with lunch.'),
  ('alcar',         'ALCAR',                          '1',            'g',               true, NULL,                 'morning',       false, 'Take with carbs (oatmeal, toast, banana). Don''t take fasted.'),
  ('l-tyrosine',    'L-Tyrosine',                     '500',          'mg',              true, NULL,                 'morning',       false, 'Take on empty stomach or with carbs only. TL pre-workout has 600mg NALT on training days — this is on top.'),
  ('omega3',        'Omega-3 Fish Oil',               '2 softgels',   '~1900mg EPA+DHA', true, NULL,                'morning',       false, 'Take with fattiest meal for absorption.'),
  ('vitamin-d3-k2', 'Vitamin D3 + K2',               '6-10 drops',   '3-5K IU D3',      true, NULL,                'morning',       false, 'Thorne liquid. Take with breakfast (fat-soluble). Target 40-60 ng/mL serum.'),
  ('magnesium',     'Magnesium Bisglycinate',         '1-2 scoops',   '200-400mg',       true, NULL,                'evening',       false, 'Thorne powder. Mix in water before bed. Supports sleep + recovery.'),
  ('zinc',          'Zinc Picolinate',                '30',           'mg',              true, NULL,                 'evening',       false, 'Thorne. Take with dinner, away from magnesium (compete for absorption).'),
  ('copper',        'Copper Bisglycinate',            '2',            'mg',              true, NULL,                 'evening',       false, 'Thorne. Take with dinner alongside zinc. Offsets zinc-induced depletion.'),
  ('collagen',      'Collagen + Vitamin C',           '15g + 50mg',   '',                true, NULL,                 'pre_workout',   false, '30-60 min BEFORE training (Shaw protocol). On rest days, take with breakfast.'),
  ('casein',        'Casein Protein',                 '1.5 scoops',   '~37g protein',    true, NULL,                'evening',       false, 'TL Grass-Fed. Before bed for overnight MPS. 30-40g threshold matters at 40.'),
  ('ashwagandha',   'Ashwagandha',                    '500',          'mg',              true, 'ashwagandha-cycle', 'evening',       false, 'KSM-66 or Sensoril. Take with food. Watch for emotional blunting — start off-cycle early if noticed.'),
  ('pre-workout',   'TL Stim-Free Pre-Workout',      '1 scoop',      '',                true, NULL,                 'pre_workout',   true,  '30 min pre-training. 8g citrulline, 4g beta-alanine, 600mg tyrosine. Tingles normal.'),
  ('intra-workout', 'Cyclic Dextrin + Vital Aminos',  '1 serving each', '',              true, NULL,                 'intra_workout', true,  'Mix in water. EAAs + sustained carb energy. Not a protein replacement.'),
  ('whey',          'Whey Isolate',                   '1-1.5 scoops', '28-42g protein',  true, NULL,                'post_workout',  true,  'TL Grass-Fed. If shake IS post-workout meal, use 1.5 scoops.'),
  ('bpc157-am',     'BPC-157 (AM)',                   '1 capsule',    '',                true, NULL,                 'morning',       false, 'InfiniWell. Finishing current supply then discontinuing — wait for legal injectable access.'),
  ('bpc157-pm',     'BPC-157 (PM)',                   '1 capsule',    '',                true, NULL,                 'evening',       false, 'InfiniWell. Finishing current supply then discontinuing — wait for legal injectable access.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, dose = EXCLUDED.dose, unit = EXCLUDED.unit,
  active = EXCLUDED.active, cycle_id = EXCLUDED.cycle_id, timing = EXCLUDED.timing,
  training_day_only = EXCLUDED.training_day_only, notes = EXCLUDED.notes;
