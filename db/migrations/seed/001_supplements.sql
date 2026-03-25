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

-- ═══════════════════════════════════════════════════════════
-- Supplement Types
-- ═══════════════════════════════════════════════════════════

INSERT INTO supplement_types (id, name, timing, training_day_only, cycle_id, target_dose, target_unit, instructions, sort_order) VALUES
  ('creatine',       'Creatine',                 'post_workout',  false, NULL,                 5,     'g',            'Take with any meal. On rest days, take with lunch.',                                    10),
  ('alcar',          'ALCAR',                     'morning',       false, NULL,                 1000,  'mg',           'Take with carbs (oatmeal, toast, banana). Don''t take fasted.',                          20),
  ('l-tyrosine',     'L-Tyrosine',                'morning',       false, NULL,                 500,   'mg',           'Take on empty stomach or with carbs only. Pre-workout contains tyrosine on training days — this is on top.', 30),
  ('omega3',         'Omega-3 Fish Oil',          'morning',       false, NULL,                 2000,  'mg EPA+DHA',   'Take with fattiest meal for absorption.',                                               40),
  ('vitamin-d3',     'Vitamin D3',                'morning',       false, NULL,                 4000,  'IU',           'Take with breakfast (fat-soluble). Target 40-60 ng/mL serum.',                           50),
  ('vitamin-k2',     'Vitamin K2',                'morning',       false, NULL,                 800,   'mcg',          'Directs calcium to bones and away from arteries. Take with D3.',                         60),
  ('magnesium',      'Magnesium',                 'evening',       false, NULL,                 400,   'mg',           'Mix in water before bed. Supports sleep + recovery.',                                   70),
  ('zinc',           'Zinc',                      'evening',       false, NULL,                 30,    'mg',           'Take with dinner, away from magnesium (compete for absorption).',                        80),
  ('copper',         'Copper',                    'evening',       false, NULL,                 2,     'mg',           'Take with dinner alongside zinc. Offsets zinc-induced depletion.',                       90),
  ('collagen',       'Collagen Peptides',         'pre_workout',   false, NULL,                 15,    'g',            '30-60 min BEFORE training (Shaw protocol). On rest days, take with breakfast.',          100),
  ('vitamin-c',      'Vitamin C',                 'pre_workout',   false, NULL,                 1000,  'mg',           'Take with collagen for synthesis.',                                                     110),
  ('casein',         'Casein Protein',            'evening',       false, NULL,                 37,    'g protein',    'Before bed for overnight MPS. 30-40g threshold matters at 40.',                          120),
  ('ashwagandha',    'Ashwagandha',               'evening',       false, 'ashwagandha-cycle',  300,   'mg',           'Take with food. Watch for emotional blunting — start off-cycle early if noticed.',       130),
  ('pre-workout',    'Pre-Workout',               'pre_workout',   true,  NULL,                 1,     'serving',      '30 min pre-training on empty stomach.',                                                 140),
  ('intra-carb',     'Intra-Workout Carbs',       'intra_workout', true,  NULL,                 1,     'serving',      'Mix in water. Sustained carb energy during training.',                                  150),
  ('intra-amino',    'Intra-Workout Aminos',      'intra_workout', true,  NULL,                 1,     'serving',      'Mix in water. Anti-catabolic signal during training, not a protein replacement.',        160),
  ('post-protein',   'Post-Workout Protein',      'post_workout',  true,  NULL,                 28,    'g protein',    'Post-workout. If shake IS the meal, increase to ~42g.',                                 170),
  ('bpc157-am',      'BPC-157 (AM)',              'morning',       false, NULL,                 1,     'serving',      'Finishing current supply then discontinuing — wait for legal injectable access.',        180),
  ('bpc157-pm',      'BPC-157 (PM)',              'evening',       false, NULL,                 1,     'serving',      'Finishing current supply then discontinuing — wait for legal injectable access.',        185)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, timing = EXCLUDED.timing, training_day_only = EXCLUDED.training_day_only,
  cycle_id = EXCLUDED.cycle_id, target_dose = EXCLUDED.target_dose, target_unit = EXCLUDED.target_unit,
  instructions = EXCLUDED.instructions, sort_order = EXCLUDED.sort_order;

-- ═══════════════════════════════════════════════════════════
-- Supplement Brands (catalog only — no user state)
-- ═══════════════════════════════════════════════════════════

INSERT INTO supplement_brands (id, type_id, brand, product_name, serving_dose, serving_unit, serving_size, form, instructions) VALUES
  ('creatine-thorne-agpc',  'creatine',    'Thorne',              'Creatine + Alpha GPC',               5,      'g',            '1 scoop (7.7g)',    'scoop', 'Also provides 600mg Alpha-GPC per scoop. Watermelon Lemonade flavor.'),
  ('creatine-thorne',       'creatine',    'Thorne',              'Creatine',                           5,      'g',            '1 scoop (5g)',      'scoop', 'Pure micronized creatine monohydrate, unflavored.'),
  ('alcar-momentous',       'alcar',       'Momentous',           'Acetyl L-Carnitine',                 500,    'mg',           '1 capsule',         'pill',  'Take 2 capsules for 1g dose.'),
  ('tyrosine-momentous',    'l-tyrosine',  'Momentous',           'Tyrosine',                           500,    'mg',           '1 capsule',         'pill',  'Do not take within 1-2 hours before bedtime.'),
  ('omega3-sr',             'omega3',      'Sports Research',     'Triple Strength Omega-3',            1040,   'mg EPA+DHA',   '1 softgel',         'pill',  '690mg EPA + 260mg DHA per softgel. Wild Alaska Pollock, triglyceride form.'),
  ('omega3-thorne',         'omega3',      'Thorne',              'Super EPA',                          813,    'mg EPA+DHA',   '1 gelcap',          'pill',  '425mg EPA + 270mg DHA per gelcap. Molecular distilled.'),
  ('d3-thorne-dk2',         'vitamin-d3',  'Thorne',              'Vitamin D + K2 Liquid',              500,    'IU',           '1 drop',            'drops', 'Metered dispenser. Also provides 100mcg K2 (MK-4) per drop.'),
  ('d3-thorne-bn2d',        'vitamin-d3',  'Thorne',              'Basic Nutrients 2/Day',              1000,   'IU',           '1 capsule',         'pill',  'Daily multi. 2,000 IU D3 per 2-capsule serving. Also provides K1+K2, B vitamins, minerals.'),
  ('k2-thorne-dk2',         'vitamin-k2',  'Thorne',              'Vitamin D + K2 Liquid',              100,    'mcg',          '1 drop',            'drops', 'Same drops as D3. 8 drops = 800mcg K2.'),
  ('k2-thorne-bn2d',        'vitamin-k2',  'Thorne',              'Basic Nutrients 2/Day',              200,    'mcg',          '1 capsule',         'pill',  'Daily multi. 400mcg K per 2-capsule serving (200mcg K1 + 200mcg K2 MK-4).'),
  ('mag-thorne',            'magnesium',   'Thorne',              'Magnesium Bisglycinate Powder',      200,    'mg',           '1 scoop',           'scoop', 'Bisglycinate form: superior absorption, bonus glycine for sleep.'),
  ('zinc-thorne',           'zinc',        'Thorne',              'Zinc Picolinate',                    30,     'mg',           '1 capsule',         'pill',  'Picolinate form for enhanced absorption.'),
  ('copper-thorne',         'copper',      'Thorne',              'Copper Bisglycinate',                2,      'mg',           '1 capsule',         'pill',  'Albion mineral chelate.'),
  ('collagen-thorne',       'collagen',    'Thorne',              'Collagen Plus',                      13,     'g',            '1 scoop (16.5g)',   'scoop', 'Also provides NR 125mg, ceramides, betaine. Passion Berry flavor.'),
  ('collagen-vp',           'collagen',    'Vital Proteins',      'Collagen Peptides',                  10,     'g',            '1 scoop (10g)',     'scoop', 'Unflavored bovine hide Types I & III. 2 scoops = 20g.'),
  ('vitc-drsbest',          'vitamin-c',   'Doctor''s Best',      'Vitamin C with Q-C',                 1000,   'mg',           '1 capsule',         'pill',  'Q-C ascorbic acid. Veggie capsule.'),
  ('casein-tl',             'casein',      'Transparent Labs',    'Grass-Fed Casein Protein',           25,     'g protein',    '1 scoop',           'scoop', 'Micellar casein, stevia sweetened. Slow-digesting overnight.'),
  ('ashwa-momentous',       'ashwagandha', 'Momentous',           'Ashwagandha (NooGandha)',            300,    'mg',           '1 capsule',         'pill',  'NooGandha extract, 3.5% withanolides, liposomal delivery. NSF Certified for Sport.'),
  ('preworkout-tl',         'pre-workout', 'Transparent Labs',    'Stim-Free Pre-Workout',              1,      'serving',      '1 scoop (~17g)',    'scoop', '8g citrulline, 4g beta-alanine, 2.5g betaine, 1g tyrosine. Tingles normal. Informed Choice certified.'),
  ('preworkout-nc',         'pre-workout', 'Nutricost',           'Stim Free Preworkout',               1,      'serving',      '1 scoop (15g)',     'scoop', '6g citrulline, 1.2g beta-alanine, 500mg NALT, 200mg Alpha GPC.'),
  ('intra-cdx-tl',          'intra-carb',  'Transparent Labs',    'Cyclic Dextrin',                     1,      'serving',      '1 scoop (~27g)',    'scoop', '25g highly branched cyclic dextrin per scoop.'),
  ('intra-pf',              'intra-carb',  'Precision Fuel',      'Carb & Electrolyte Drink Mix PF 30', 1,      'serving',      '2 scoops / 500ml', 'scoop', '30g carbs (maltodextrin:fructose 2:1), 500mg sodium. Hypotonic. Informed Sport.'),
  ('intra-amino-momentous', 'intra-amino', 'Momentous',           'Vital Aminos',                       1,      'serving',      '1 scoop (11.5g)',   'scoop', '9 EAAs, 2.5g leucine. NSF Certified for Sport.'),
  ('whey-tl',               'post-protein', 'Transparent Labs',   'Grass-Fed Whey Protein Isolate',     28,     'g protein',    '1 scoop (~32g)',    'scoop', 'Grass-fed American dairy. Stevia sweetened. Informed Choice certified.'),
  ('plant-thorne',           'post-protein', 'Thorne',             'Plant Protein (Chocolate)',          22,     'g protein',    '2 scoops',          'scoop', 'Pea + rice + chia. 140 cal, 4g fat, 0g added sugar. NSF Certified for Sport.'),
  ('plant-orgain',           'post-protein', 'Orgain',             'Organic Protein + 50 Superfoods',   21,     'g protein',    '2 scoops',          'scoop', 'Pea + rice + mung bean + chia. 160 cal, 18g carbs, 8g fiber. Use for non-training days.'),
  ('bpc157-am-infiniwell',  'bpc157-am',   'InfiniWell',          'BPC DELAYED PRO',                    1,      'serving',      '1 capsule',         'pill',  '500mcg BPC per capsule. SNAC absorption enhancer, delayed release.'),
  ('bpc157-pm-infiniwell',  'bpc157-pm',   'InfiniWell',          'BPC DELAYED PRO',                    1,      'serving',      '1 capsule',         'pill',  '500mcg BPC per capsule. SNAC absorption enhancer, delayed release.')
ON CONFLICT (id) DO UPDATE SET
  type_id = EXCLUDED.type_id, brand = EXCLUDED.brand, product_name = EXCLUDED.product_name,
  serving_dose = EXCLUDED.serving_dose, serving_unit = EXCLUDED.serving_unit, serving_size = EXCLUDED.serving_size,
  form = EXCLUDED.form, instructions = EXCLUDED.instructions;

-- ═══════════════════════════════════════════════════════════
-- Default active selections (only inserted if no selection exists yet)
-- ═══════════════════════════════════════════════════════════

INSERT INTO active_selections (type_id, brand_id) VALUES
  ('creatine',    'creatine-thorne-agpc'),
  ('alcar',       'alcar-momentous'),
  ('l-tyrosine',  'tyrosine-momentous'),
  ('omega3',      'omega3-sr'),
  ('vitamin-d3',  'd3-thorne-dk2'),
  ('vitamin-k2',  'k2-thorne-dk2'),
  ('magnesium',   'mag-thorne'),
  ('zinc',        'zinc-thorne'),
  ('copper',      'copper-thorne'),
  ('collagen',    'collagen-thorne'),
  ('vitamin-c',   'vitc-drsbest'),
  ('casein',      'casein-tl'),
  ('ashwagandha', 'ashwa-momentous'),
  ('pre-workout', 'preworkout-tl'),
  ('intra-carb',  'intra-cdx-tl'),
  ('intra-amino', 'intra-amino-momentous'),
  ('post-protein', 'whey-tl'),
  ('bpc157-am',   'bpc157-am-infiniwell'),
  ('bpc157-pm',   'bpc157-pm-infiniwell')
ON CONFLICT (type_id) DO NOTHING;
