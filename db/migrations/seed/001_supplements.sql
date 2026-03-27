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
-- Brands
-- ═══════════════════════════════════════════════════════════

INSERT INTO brands (id, name) VALUES
  ('momentous',         'Momentous'),
  ('thorne',            'Thorne'),
  ('nutricost',         'Nutricost'),
  ('sports-research',   'Sports Research'),
  ('nordic-naturals',   'Nordic Naturals'),
  ('nootropics-depot',  'Nootropics Depot'),
  ('transparent-labs',  'Transparent Labs'),
  ('vital-proteins',    'Vital Proteins'),
  ('doctors-best',      'Doctor''s Best'),
  ('pescience',         'PEScience'),
  ('orgain',            'Orgain'),
  ('precision-fuel',    'Precision Fuel'),
  ('infiniwell',        'InfiniWell')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ═══════════════════════════════════════════════════════════
-- Supplement Types
-- ═══════════════════════════════════════════════════════════

INSERT INTO supplement_types (id, name, timing, training_day_only, active, cycle_id, target_dose, target_unit, instructions, sort_order) VALUES
  ('creatine',       'Creatine',                 'post_workout',  false, true, NULL,                 5,     'g',            'Take with any meal. On rest days, take with lunch.',                                    10),
  ('alcar',          'ALCAR',                     'morning',       false, true, NULL,                 1000,  'mg',           'Take with carbs (oatmeal, toast, banana). Don''t take fasted.',                          20),
  ('alpha-gpc',      'Alpha GPC',                 'morning',       false, true, NULL,                 600,   'mg',           'Cognitive support. Often paired with creatine.',                                        25),
  ('l-tyrosine',     'L-Tyrosine',                'morning',       false, true, NULL,                 500,   'mg',           'Take on empty stomach or with carbs only.',                                             30),
  ('omega3',         'Omega-3 Fish Oil',          'morning',       false, true, NULL,                 2000,  'mg EPA+DHA',   'Take with fattiest meal for absorption.',                                               40),
  ('vitamin-d3',     'Vitamin D3',                'morning',       false, true, NULL,                 4000,  'IU',           'Take with breakfast (fat-soluble). Target 40-60 ng/mL serum.',                           50),
  ('vitamin-k2',     'Vitamin K2',                'morning',       false, true, NULL,                 800,   'mcg',          'Directs calcium to bones and away from arteries. Take with D3.',                         60),
  ('magnesium',      'Magnesium',                 'evening',       false, true, NULL,                 400,   'mg',           'Mix in water before bed. Supports sleep + recovery.',                                   70),
  ('zinc',           'Zinc',                      'evening',       false, true, NULL,                 30,    'mg',           'Take with dinner, away from magnesium.',                                                80),
  ('copper',         'Copper',                    'evening',       false, true, NULL,                 2,     'mg',           'Take with dinner alongside zinc. Offsets zinc-induced depletion.',                       90),
  ('collagen',       'Collagen Peptides',         'pre_workout',   false, true, NULL,                 15,    'g',            '30-60 min BEFORE training. On rest days, take with breakfast.',                          100),
  ('vitamin-c',      'Vitamin C',                 'pre_workout',   false, true, NULL,                 1000,  'mg',           'Take with collagen for synthesis.',                                                     110),
  ('casein',         'Casein Protein',            'evening',       false, true, NULL,                 37,    'g protein',    'Before bed for overnight MPS.',                                                         120),
  ('ashwagandha',    'Ashwagandha',               'evening',       false, true, 'ashwagandha-cycle',  300,   'mg',           'Take with food. Watch for emotional blunting.',                                         130),
  ('pre-workout',    'Pre-Workout',               'pre_workout',   true,  true, NULL,                 1,     'serving',      '30 min pre-training on empty stomach.',                                                 140),
  ('intra-carb',     'Intra-Workout Carbs',       'intra_workout', true,  true, NULL,                 1,     'serving',      'Mix in water. Sustained carb energy during training.',                                  150),
  ('intra-amino',    'Intra-Workout Aminos',      'intra_workout', true,  true, NULL,                 1,     'serving',      'Mix in water. Anti-catabolic signal during training.',                                   160),
  ('post-protein',   'Post-Workout Protein',      'post_workout',  false, true, NULL,                 38,    'g protein',    'Post-workout or meal replacement. Target 35-42g.',                                      170),
  ('bpc157-am',      'BPC-157 (AM)',              'morning',       false, true, NULL,                 1,     'serving',      'Finishing current supply then discontinuing.',                                          180),
  ('bpc157-pm',      'BPC-157 (PM)',              'evening',       false, true, NULL,                 1,     'serving',      'Finishing current supply then discontinuing.',                                          185)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, timing = EXCLUDED.timing, training_day_only = EXCLUDED.training_day_only,
  cycle_id = EXCLUDED.cycle_id, target_dose = EXCLUDED.target_dose, target_unit = EXCLUDED.target_unit,
  instructions = EXCLUDED.instructions, sort_order = EXCLUDED.sort_order;

-- ═══════════════════════════════════════════════════════════
-- Supplement Brands (products you own/use)
-- ═══════════════════════════════════════════════════════════

INSERT INTO supplement_brands (id, type_id, brand_id, product_name, serving_dose, serving_unit, units_per_serving, unit_name, form, instructions, url, price_per_serving, subscription_discount) VALUES
  -- Creatine
  ('creatine-thorne-agpc',  'creatine',     'thorne',            'Creatine + Alpha GPC',               5,      'g',            1, 'scoop',   'scoop', 'Also provides 600mg Alpha-GPC per scoop.',              'https://www.thorne.com/products/dp/creatine-alpha-gpc',          NULL, 10),
  ('creatine-thorne',       'creatine',     'thorne',            'Creatine',                           5,      'g',            1, 'scoop',   'scoop', 'Pure micronized creatine monohydrate, unflavored.',     'https://www.thorne.com/products/dp/creatine',                    NULL, 10),
  -- ALCAR
  ('alcar-momentous',       'alcar',        'momentous',         'Acetyl L-Carnitine',                 500,    'mg',           1, 'capsule', 'pill',  'Take 2 capsules for 1g dose.',                          'https://www.livemomentous.com/products/acetyl-l-carnitine',      0.45, 25),
  ('alcar-thorne',          'alcar',        'thorne',            'Acetyl-L-Carnitine',                 500,    'mg',           1, 'capsule', 'pill',  '60 capsules.',                                          'https://www.thorne.com/products/dp/carnityl-reg',                0.53, 10),
  ('alcar-nutricost',       'alcar',        'nutricost',         'Acetyl L-Carnitine 500mg',           500,    'mg',           1, 'capsule', 'pill',  '180 capsules.',                                         'https://nutricost.com/products/nutricost-acetyl-l-carnitine-500mg-180-capsules', 0.06, NULL),
  -- Alpha GPC
  ('agpc-momentous',        'alpha-gpc',    'momentous',         'Alpha GPC',                          300,    'mg',           1, 'capsule', 'pill',  '300mg per capsule. Take 2 for 600mg.',                  'https://www.livemomentous.com/products/alpha-gpc',               0.75, 25),
  ('agpc-nutricost',        'alpha-gpc',    'nutricost',         'Alpha GPC 300mg',                    300,    'mg',           1, 'capsule', 'pill',  '120 capsules.',                                         'https://nutricost.com/products/nutricost-alpha-gpc-300mg',       0.23, NULL),
  ('agpc-sr',               'alpha-gpc',    'sports-research',   'Alpha GPC 630mg',                    630,    'mg',           1, 'capsule', 'pill',  'Single capsule meets target.',                          'https://www.sportsresearch.com/products/alpha-gpc',              NULL, NULL),
  ('agpc-nd',               'alpha-gpc',    'nootropics-depot',  'Alpha GPC 150mg',                    150,    'mg',           1, 'capsule', 'pill',  'Take 4 for 600mg.',                                     'https://nootropicsdepot.com/alpha-gpc-150mg-capsules/',          0.30, NULL),
  -- L-Tyrosine
  ('tyrosine-momentous',    'l-tyrosine',   'momentous',         'Tyrosine',                           500,    'mg',           1, 'capsule', 'pill',  'Do not take within 1-2 hours before bedtime.',          'https://www.livemomentous.com/products/tyrosine',                0.33, 25),
  ('tyrosine-nutricost',    'l-tyrosine',   'nutricost',         'L-Tyrosine 500mg',                   500,    'mg',           1, 'capsule', 'pill',  '180 capsules.',                                         'https://nutricost.com/products/nutricost-l-tyrosine-500mg-180-capsules-1', 0.09, NULL),
  ('tyrosine-nd',           'l-tyrosine',   'nootropics-depot',  'L-Tyrosine 500mg',                   500,    'mg',           1, 'capsule', 'pill',  '120 capsules.',                                         'https://nootropicsdepot.com/l-tyrosine-capsules-500mg/',         NULL, NULL),
  -- Omega-3
  ('omega3-sr',             'omega3',       'sports-research',   'Triple Strength Omega-3',            1040,   'mg EPA+DHA',   1, 'softgel', 'pill',  '690mg EPA + 260mg DHA per softgel.',                    'https://www.sportsresearch.com/products/omega-3-fish-oil-alaskaomegar-1250mg', 0.19, NULL),
  ('omega3-thorne',         'omega3',       'thorne',            'Super EPA',                          813,    'mg EPA+DHA',   1, 'gelcap',  'pill',  '425mg EPA + 270mg DHA per gelcap.',                     'https://www.thorne.com/products/dp/super-epa-sp608nc',           0.46, 10),
  ('omega3-momentous',      'omega3',       'momentous',         'Omega-3 Fish Oil',                   800,    'mg EPA+DHA',   1, 'softgel', 'pill',  '800 EPA + 800 DHA per 2-softgel serving.',              'https://www.livemomentous.com/products/omega-3',                 1.33, 25),
  ('omega3-nutricost',      'omega3',       'nutricost',         'Omega-3 Fish Oil',                   833,    'mg EPA+DHA',   1, 'softgel', 'pill',  '1200 EPA + 850 DHA per 3-softgel serving.',             'https://nutricost.com/products/nutricost-omega-3-softgels',      0.67, NULL),
  ('omega3-nordic',         'omega3',       'nordic-naturals',   'Ultimate Omega 2X',                  1075,   'mg EPA+DHA',   1, 'softgel', 'pill',  '1125 EPA + 875 DHA per 2-softgel serving. Highest.',    'https://www.nordicnaturals.com/landing/ultimateomega2x/',        NULL, NULL),
  -- Vitamin D3
  ('d3-thorne-dk2',         'vitamin-d3',   'thorne',            'Vitamin D + K2 Liquid',              500,    'IU',           1, 'drop',    'drops', 'Also provides 100mcg K2 (MK-4) per drop.',              'https://www.thorne.com/products/dp/vitamin-d-k2-liquid',         0.05, 10),
  ('d3-thorne-bn2d',        'vitamin-d3',   'thorne',            'Basic Nutrients 2/Day',              1000,   'IU',           1, 'capsule', 'pill',  'Daily multi. Also provides K1+K2, B vitamins.',         'https://www.thorne.com/products/dp/basic-nutrients-2-day-vm2nc', NULL, 10),
  ('d3-momentous',          'vitamin-d3',   'momentous',         'Vitamin D3 5000 IU',                 5000,   'IU',           1, 'capsule', 'pill',  'Vegan D3. 60 ct.',                                      'https://www.livemomentous.com/products/vitamin-d3-5000-iu',      0.28, 25),
  ('d3-nutricost',          'vitamin-d3',   'nutricost',         'Vitamin D3 5000 IU',                 5000,   'IU',           1, 'softgel', 'pill',  '240 softgels.',                                         'https://nutricost.com/products/nutricost-vitamin-d3-240-softgels', 0.06, NULL),
  ('d3-sr',                 'vitamin-d3',   'sports-research',   'Vegan D3 5000 IU',                   5000,   'IU',           1, 'softgel', 'pill',  '60 veggie softgels.',                                   'https://www.sportsresearch.com/products/vegan-d3',               0.27, NULL),
  -- Vitamin K2
  ('k2-thorne-dk2',         'vitamin-k2',   'thorne',            'Vitamin D + K2 Liquid',              100,    'mcg',          1, 'drop',    'drops', 'Same drops as D3. 8 drops = 800mcg K2.',                'https://www.thorne.com/products/dp/vitamin-d-k2-liquid',         0.05, 10),
  ('k2-thorne-bn2d',        'vitamin-k2',   'thorne',            'Basic Nutrients 2/Day',              200,    'mcg',          1, 'capsule', 'pill',  '200mcg K1 + 200mcg K2 MK-4 per 2-cap serving.',        'https://www.thorne.com/products/dp/basic-nutrients-2-day-vm2nc', NULL, 10),
  ('k2-nutricost',          'vitamin-k2',   'nutricost',         'Vitamin K2 MK-7 100mcg',            100,    'mcg',          1, 'softgel', 'pill',  '240 softgels.',                                         'https://nutricost.com/products/nutricost-vitamin-k2-mk-7',      0.08, NULL),
  ('k2-sr',                 'vitamin-k2',   'sports-research',   'Vitamin K2 MK-7',                   100,    'mcg',          1, 'softgel', 'pill',  'MenaQ7 from chickpeas.',                                'https://www.sportsresearch.com/products/vitamin-k2-as-mk7-with-coconut-oil', NULL, NULL),
  -- Magnesium
  ('mag-thorne',            'magnesium',    'thorne',            'Magnesium Bisglycinate Powder',      200,    'mg',           1, 'scoop',   'scoop', 'Bisglycinate form. Bonus glycine for sleep.',            'https://www.thorne.com/products/dp/magnesium-bisglycinate',      0.87, 10),
  ('mag-nutricost',         'magnesium',    'nutricost',         'Magnesium Glycinate 210mg',          70,     'mg',           1, 'capsule', 'pill',  '360 caps (3 caps = 210mg serving).',                    'https://nutricost.com/products/magnesium-glycinate-210mg',       0.07, NULL),
  ('mag-momentous',         'magnesium',    'momentous',         'Magnesium L-Threonate',              145,    'mg',           3, 'capsule', 'pill',  'Magtein. 145mg elemental Mg per 3-cap serving.',        'https://www.livemomentous.com/products/magnesium-threonate',     1.67, 25),
  -- Zinc
  ('zinc-thorne',           'zinc',         'thorne',            'Zinc Picolinate',                    30,     'mg',           1, 'capsule', 'pill',  'Picolinate form for enhanced absorption.',               'https://www.thorne.com/products/dp/zinc-picolinate',             0.25, 10),
  ('zinc-nutricost',        'zinc',         'nutricost',         'Zinc Picolinate 30mg',               30,     'mg',           1, 'capsule', 'pill',  '240 capsules.',                                         'https://nutricost.com/products/nutricost-picolinate-30mg',       0.09, NULL),
  ('zinc-momentous',        'zinc',         'momentous',         'Zinc Picolinate 15mg',               15,     'mg',           1, 'capsule', 'pill',  '60 capsules. 15mg per cap.',                            'https://www.livemomentous.com/products/zinc-picolinate',         0.32, 25),
  -- Copper
  ('copper-thorne',         'copper',       'thorne',            'Copper Bisglycinate',                2,      'mg',           1, 'capsule', 'pill',  'Albion mineral chelate.',                               'https://www.thorne.com/products/dp/copper-bisglycinate',         0.32, 10),
  ('copper-nutricost',      'copper',       'nutricost',         'Copper Glycinate 3mg',               3,      'mg',           1, 'capsule', 'pill',  '120 capsules.',                                         'https://nutricost.com/products/nutricost-copper-glycinate-capsules', 0.09, NULL),
  -- Collagen
  ('collagen-thorne',       'collagen',     'thorne',            'Collagen Plus',                      13,     'g',            1, 'scoop',   'scoop', 'Also provides NR 125mg, ceramides, betaine.',           'https://www.thorne.com/products/dp/collagen-plus',               NULL, 10),
  ('collagen-vp',           'collagen',     'vital-proteins',    'Collagen Peptides',                  10,     'g',            1, 'scoop',   'scoop', 'Unflavored bovine hide Types I & III.',                 'https://www.vitalproteins.com/products/collagen-peptides',       NULL, NULL),
  -- Vitamin C
  ('vitc-drsbest',          'vitamin-c',    'doctors-best',      'Vitamin C with Q-C',                 1000,   'mg',           1, 'capsule', 'pill',  'Q-C ascorbic acid. Veggie capsule.',                    'https://www.doctorsbest.com/products/doctor-s-best-vitamin-c-1-000-mg-120-veggie-caps-38048', NULL, NULL),
  -- Casein
  ('casein-tl',             'casein',       'transparent-labs',  'Grass-Fed Casein Protein',           25,     'g protein',    1, 'scoop',   'scoop', 'Micellar casein, stevia sweetened.',                    'https://transparentlabs.com/products/casein-protein',            NULL, NULL),
  ('casein-pescience',      'casein',       'pescience',         'Select Multi-Purpose Unflavored',    23,     'g protein',    1, 'scoop',   'scoop', 'Whey + casein blend. 110 cal.',                         NULL,                                                              NULL, NULL),
  -- Ashwagandha
  ('ashwa-momentous',       'ashwagandha',  'momentous',         'Ashwagandha (NooGandha)',            300,    'mg',           1, 'capsule', 'pill',  'NooGandha 3.5% withanolides. NSF Certified.',           'https://www.livemomentous.com/products/ashwagandha',             0.42, 25),
  ('ashwa-nutricost',       'ashwagandha',  'nutricost',         'KSM-66 Ashwagandha 600mg',          600,    'mg',           1, 'capsule', 'pill',  'KSM-66, 5% withanolides. 60 ct.',                       'https://nutricost.com/products/nutricost-ksm-66-600mg-60-capsules', 0.28, NULL),
  ('ashwa-nd',              'ashwagandha',  'nootropics-depot',  'KSM-66 Ashwagandha 300mg',          300,    'mg',           1, 'capsule', 'pill',  'KSM-66, 5% withanolides. 90/180/365 ct.',               'https://nootropicsdepot.com/ksm-66-ashwagandha-extract-300mg-capsules', 0.22, NULL),
  -- Pre-Workout
  ('preworkout-tl',         'pre-workout',  'transparent-labs',  'Stim-Free Pre-Workout',              1,      'serving',      1, 'scoop',   'scoop', '8g citrulline, 4g beta-alanine. Informed Choice.',      'https://transparentlabs.com/products/non-stim-pre-workout',     NULL, NULL),
  ('preworkout-nc',         'pre-workout',  'nutricost',         'Stim Free Preworkout',               1,      'serving',      1, 'scoop',   'scoop', '6g citrulline, 1.2g beta-alanine.',                     'https://nutricost.com/products/nutricost-stim-free-preworkouts-30-servings', NULL, NULL),
  -- Intra Carbs
  ('intra-cdx-tl',          'intra-carb',   'transparent-labs',  'Cyclic Dextrin',                     1,      'serving',      1, 'scoop',   'scoop', '25g HBCD per scoop.',                                   'https://transparentlabs.com/products/cyclic-dextrin',            NULL, NULL),
  ('intra-pf',              'intra-carb',   'precision-fuel',    'Carb & Electrolyte Drink Mix PF 30', 1,      'serving',      2, 'scoop',   'scoop', '30g carbs per 2 scoops.',                               'https://www.precisionhydration.com/us/en/products/pf-30-drink-mix/', NULL, NULL),
  -- Intra Aminos
  ('intra-amino-momentous', 'intra-amino',  'momentous',         'Vital Aminos',                       1,      'serving',      1, 'scoop',   'scoop', '9 EAAs, 2.5g leucine. NSF Certified.',                  'https://www.livemomentous.com/products/vital-amino',             NULL, 25),
  -- Post-Workout Protein
  ('whey-tl',               'post-protein', 'transparent-labs',  'Grass-Fed Whey Protein Isolate',     28,     'g protein',    1, 'scoop',   'scoop', 'Grass-fed American dairy. Informed Choice.',             'https://transparentlabs.com/products/whey-protein-isolate',      NULL, NULL),
  ('plant-thorne',          'post-protein', 'thorne',            'Plant Protein (Chocolate)',           11,     'g protein',    1, 'scoop',   'scoop', 'Pea + rice + chia. 70 cal/scoop. NSF Certified.',       'https://www.thorne.com/products/dp/plant-protein-chocolate-flavored', NULL, 10),
  ('plant-orgain',          'post-protein', 'orgain',            'Organic Protein + 50 Superfoods',    10.5,   'g protein',    1, 'scoop',   'scoop', 'Pea + rice + mung bean + chia. 80 cal/scoop.',          'https://orgain.com/products/organic-protein-superfoods-plant-based-protein-powder', NULL, NULL),
  -- Missing comparison brands
  ('tyrosine-thorne',       'l-tyrosine',   'thorne',            'L-Tyrosine',                         500,    'mg',           1, 'capsule', 'pill',  'Being discontinued. 90 ct.',                            'https://www.thorne.com/products/dp/l-tyrosine',                  0.31, 10),
  ('alcar-nd',              'alcar',        'nootropics-depot',  'ALCAR 500mg',                        500,    'mg',           1, 'capsule', 'pill',  '90 or 180 ct.',                                         'https://nootropicsdepot.com/acetyl-l-carnitine-hcl-500mg-capsules-alcar/', NULL, NULL),
  ('ashwa-thorne',          'ashwagandha',  'thorne',            'Ashwagandha (Shoden)',               120,    'mg',           1, 'capsule', 'pill',  'Shoden extract, 35% withanolide glycosides. 30 ct.',    'https://www.thorne.com/products/dp/ashwagandha',                 0.73, 10),
  ('ashwa-sr',              'ashwagandha',  'sports-research',   'Ashwagandha (Shoden)',               500,    'mg',           1, 'capsule', 'pill',  'Shoden extract.',                                       'https://www.sportsresearch.com/products/ashwagandha',            NULL, NULL),
  ('d3-nordic',             'vitamin-d3',   'nordic-naturals',   'Vitamin D3 5000',                    5000,   'IU',           1, 'softgel', 'pill',  NULL,                                                    'https://nordicnaturals.com/en/products/products/514/?ProdID=1683', 0.25, NULL),
  ('d3-nd',                 'vitamin-d3',   'nootropics-depot',  'Vitamin D3+K2+C',                    2500,   'IU',           1, 'tablet',  'pill',  'Combo with K2 MK-7 and Vitamin C.',                     'https://nootropicsdepot.com/vitamin-d3-k2-c-supplement/',        NULL, NULL),
  ('k2-nordic',             'vitamin-k2',   'nordic-naturals',   'D3+K2 Gummies',                      45,    'mcg',          1, 'gummy',   'pill',  'Low K2 dose (45mcg). Combo with D3.',                   'https://nordicnaturals.com/en/Products/Product_Details/156/?ProdID=1775', NULL, NULL),
  ('k2-nd',                 'vitamin-k2',   'nootropics-depot',  'Vitamin D3+K2+C',                    100,   'mcg',          1, 'tablet',  'pill',  'MK-7. Combo with D3 and Vitamin C.',                    'https://nootropicsdepot.com/vitamin-d3-k2-c-supplement/',        NULL, NULL),
  ('mag-sr',                'magnesium',    'sports-research',   'Magnesium Glycinate',                200,    'mg',           2, 'capsule', 'pill',  '2 capsules per serving.',                               'https://www.sportsresearch.com/products/magnesium-glycinate',    NULL, NULL),
  ('mag-nordic',            'magnesium',    'nordic-naturals',   'Magnesium Complex',                  200,    'mg',           2, 'capsule', 'pill',  NULL,                                                    'https://nordicnaturals.com/en/products/products/514/?ProdID=1810', NULL, NULL),
  ('mag-nd',                'magnesium',    'nootropics-depot',  'Magnesium Glycinate',                200,    'mg',           1, 'capsule', 'pill',  NULL,                                                    'https://nootropicsdepot.com/magnesium-glycinate-capsules',       NULL, NULL),
  ('zinc-sr',               'zinc',         'sports-research',   'Zinc Picolinate',                    30,     'mg',           1, 'softgel', 'pill',  'With coconut oil.',                                     'https://www.sportsresearch.com/products/zinc-picolinate-with-coconut-oil', NULL, NULL),
  ('zinc-nordic',           'zinc',         'nordic-naturals',   'Zinc Glycinate 20mg',                20,     'mg',           1, 'capsule', 'pill',  NULL,                                                    'https://nordicnaturals.com/en/products/zinc-glycinate/761/?ProdID=1813', NULL, NULL),
  -- BPC-157
  ('bpc157-am-infiniwell',  'bpc157-am',    'infiniwell',        'BPC DELAYED PRO',                    1,      'serving',      1, 'capsule', 'pill',  '500mcg BPC. SNAC + delayed release.',                   'https://infiniwell.com/products/bpc-157-delayed-pro',            NULL, NULL),
  ('bpc157-pm-infiniwell',  'bpc157-pm',    'infiniwell',        'BPC DELAYED PRO',                    1,      'serving',      1, 'capsule', 'pill',  '500mcg BPC. SNAC + delayed release.',                   'https://infiniwell.com/products/bpc-157-delayed-pro',            NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  type_id = EXCLUDED.type_id, brand_id = EXCLUDED.brand_id, product_name = EXCLUDED.product_name,
  serving_dose = EXCLUDED.serving_dose, serving_unit = EXCLUDED.serving_unit,
  units_per_serving = EXCLUDED.units_per_serving, unit_name = EXCLUDED.unit_name,
  form = EXCLUDED.form, instructions = EXCLUDED.instructions,
  url = EXCLUDED.url, price_per_serving = EXCLUDED.price_per_serving,
  subscription_discount = EXCLUDED.subscription_discount;

-- ═══════════════════════════════════════════════════════════
-- Default active selections (only inserted if no selection exists)
-- ═══════════════════════════════════════════════════════════

INSERT INTO active_selections (type_id, brand_id) VALUES
  ('creatine',    'creatine-thorne-agpc'),
  ('alcar',       'alcar-momentous'),
  ('alpha-gpc',   'agpc-momentous'),
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

-- ═══════════════════════════════════════════════════════════
-- Brand Research (comparison data + DNE markers)
-- ═══════════════════════════════════════════════════════════

INSERT INTO brand_research (type_id, brand_id, not_found, notes, last_researched) VALUES
  -- L-Tyrosine research
  ('l-tyrosine', 'sports-research',  true,  NULL,                                          '2026-03-27'),
  ('l-tyrosine', 'nordic-naturals',  true,  NULL,                                          '2026-03-27'),
  ('l-tyrosine', 'momentous',        false, 'Active brand. $0.33/serving.',                '2026-03-27'),
  ('l-tyrosine', 'nutricost',        false, 'Best value at $0.09/serving.',                '2026-03-27'),
  ('l-tyrosine', 'nootropics-depot', false, 'Price not confirmed via direct site.',        '2026-03-27'),
  ('l-tyrosine', 'thorne',           false, 'Being discontinued. $0.31/serving.',          '2026-03-27'),
  -- ALCAR research
  ('alcar', 'sports-research',  true,  NULL,                                               '2026-03-27'),
  ('alcar', 'nordic-naturals',  true,  NULL,                                               '2026-03-27'),
  ('alcar', 'nootropics-depot', false, 'Price not confirmed via direct site.',             '2026-03-27'),
  ('alcar', 'momentous',        false, '$0.45/serving.',                                   '2026-03-27'),
  ('alcar', 'thorne',           false, '$0.53/serving.',                                   '2026-03-27'),
  ('alcar', 'nutricost',        false, 'Best value at $0.06/serving.',                     '2026-03-27'),
  -- Alpha GPC research
  ('alpha-gpc', 'thorne',           true,  'Only available as combo (Creatine + Alpha GPC).', '2026-03-27'),
  ('alpha-gpc', 'nordic-naturals',  true,  NULL,                                              '2026-03-27'),
  ('alpha-gpc', 'momentous',        false, '$0.75/serving (300mg caps, need 2).',             '2026-03-27'),
  ('alpha-gpc', 'nutricost',        false, 'Best value at $0.23/serving.',                    '2026-03-27'),
  ('alpha-gpc', 'sports-research',  false, '630mg single-cap. Price unconfirmed.',            '2026-03-27'),
  ('alpha-gpc', 'nootropics-depot', false, '150mg caps. $0.30/serving.',                      '2026-03-27'),
  -- Ashwagandha research
  ('ashwagandha', 'nordic-naturals',  true,  NULL,                                            '2026-03-27'),
  ('ashwagandha', 'momentous',        false, 'NooGandha 300mg. $0.42/serving.',               '2026-03-27'),
  ('ashwagandha', 'thorne',           false, 'Shoden 120mg (different extract). $0.73/serving.', '2026-03-27'),
  ('ashwagandha', 'nutricost',        false, 'KSM-66 600mg. Best value at $0.28/serving.',    '2026-03-27'),
  ('ashwagandha', 'sports-research',  false, 'Shoden 500mg. Price unconfirmed.',              '2026-03-27'),
  ('ashwagandha', 'nootropics-depot', false, 'KSM-66 300mg. Best value at $0.22/serving.',   '2026-03-27'),
  -- Vitamin D3 research
  ('vitamin-d3', 'momentous',        false, 'Vegan D3 5000 IU. $0.28/serving.',              '2026-03-27'),
  ('vitamin-d3', 'thorne',           false, 'D-5000 capsule. $0.33/serving.',                '2026-03-27'),
  ('vitamin-d3', 'nutricost',        false, 'Best value at $0.06/serving.',                  '2026-03-27'),
  ('vitamin-d3', 'sports-research',  false, 'Vegan D3 5000 IU. $0.27/serving.',             '2026-03-27'),
  ('vitamin-d3', 'nordic-naturals',  false, 'D3 5000. ~$0.25/serving.',                     '2026-03-27'),
  ('vitamin-d3', 'nootropics-depot', false, 'Combo D3+K2+C tablet. Price unconfirmed.',     '2026-03-27'),
  -- Vitamin K2 research
  ('vitamin-k2', 'momentous',        true,  'Does not sell standalone K2.',                  '2026-03-27'),
  ('vitamin-k2', 'thorne',           false, 'K2 Liquid high-dose MK-4. $0.06/drop.',        '2026-03-27'),
  ('vitamin-k2', 'nutricost',        false, 'MK-7 100mcg. $0.08/serving.',                  '2026-03-27'),
  ('vitamin-k2', 'sports-research',  false, 'MK-7 with coconut oil. Price unconfirmed.',    '2026-03-27'),
  ('vitamin-k2', 'nordic-naturals',  false, 'Only as D3+K2 gummies (45mcg K2, low dose).', '2026-03-27'),
  ('vitamin-k2', 'nootropics-depot', false, 'Combo D3+K2+C tablet.',                        '2026-03-27'),
  -- Magnesium research
  ('magnesium', 'momentous',        false, 'L-Threonate (Magtein). Expensive: $1.67/serving.', '2026-03-27'),
  ('magnesium', 'thorne',           false, 'Bisglycinate powder. $0.87/serving.',            '2026-03-27'),
  ('magnesium', 'nutricost',        false, 'Glycinate. Best value at $0.07/cap.',            '2026-03-27'),
  ('magnesium', 'sports-research',  false, 'Glycinate capsules. Price unconfirmed.',         '2026-03-27'),
  ('magnesium', 'nordic-naturals',  false, 'Magnesium Complex. Price unconfirmed.',          '2026-03-27'),
  ('magnesium', 'nootropics-depot', false, 'Glycinate capsules. Price unconfirmed.',         '2026-03-27'),
  -- Zinc research
  ('zinc', 'momentous',        false, 'Picolinate 15mg. $0.32/serving.',                    '2026-03-27'),
  ('zinc', 'thorne',           false, 'Picolinate 30mg. $0.25/serving.',                    '2026-03-27'),
  ('zinc', 'nutricost',        false, 'Picolinate 30mg. Best value at $0.09/serving.',      '2026-03-27'),
  ('zinc', 'sports-research',  false, 'Picolinate. Price unconfirmed.',                     '2026-03-27'),
  ('zinc', 'nordic-naturals',  false, 'Glycinate 20mg. Price unconfirmed.',                 '2026-03-27'),
  ('zinc', 'nootropics-depot', true,  NULL,                                                  '2026-03-27'),
  -- Copper research
  ('copper', 'momentous',        true,  'No standalone copper product.',                     '2026-03-27'),
  ('copper', 'sports-research',  true,  NULL,                                                '2026-03-27'),
  ('copper', 'nordic-naturals',  true,  NULL,                                                '2026-03-27'),
  ('copper', 'nootropics-depot', true,  NULL,                                                '2026-03-27'),
  ('copper', 'thorne',           false, 'Bisglycinate 2mg. $0.32/serving.',                  '2026-03-27'),
  ('copper', 'nutricost',        false, 'Glycinate 3mg. $0.09/serving.',                     '2026-03-27'),
  -- Omega-3 research
  ('omega3', 'momentous',        false, '1600mg EPA+DHA per 2-softgel. $1.33/serving.',     '2026-03-27'),
  ('omega3', 'thorne',           false, 'Super EPA. 695mg per gelcap. $0.46/serving.',       '2026-03-27'),
  ('omega3', 'nutricost',        false, '2500mg per 3-softgel. $0.67/serving.',              '2026-03-27'),
  ('omega3', 'sports-research',  false, 'Triple Strength. 1040mg per softgel. $0.19/serving.', '2026-03-27'),
  ('omega3', 'nordic-naturals',  false, 'Ultimate Omega 2X. 2150mg per 2-softgel. Highest per-softgel.', '2026-03-27'),
  ('omega3', 'nootropics-depot', true,  NULL,                                                '2026-03-27')
ON CONFLICT (type_id, brand_id) DO UPDATE SET
  not_found = EXCLUDED.not_found, notes = EXCLUDED.notes, last_researched = EXCLUDED.last_researched;
