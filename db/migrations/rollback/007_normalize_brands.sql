DROP TABLE IF EXISTS brand_research;

ALTER TABLE supplement_brands DROP COLUMN IF EXISTS url;
ALTER TABLE supplement_brands DROP COLUMN IF EXISTS price_per_serving;
ALTER TABLE supplement_brands DROP COLUMN IF EXISTS subscription_discount;
ALTER TABLE supplement_brands DROP COLUMN IF EXISTS in_stock;

ALTER TABLE supplement_brands ADD COLUMN brand TEXT;
UPDATE supplement_brands SET brand = (SELECT name FROM brands WHERE id = supplement_brands.brand_id);
ALTER TABLE supplement_brands ALTER COLUMN brand SET NOT NULL;
ALTER TABLE supplement_brands DROP CONSTRAINT IF EXISTS fk_supplement_brands_brand;
ALTER TABLE supplement_brands DROP COLUMN brand_id;

DROP TABLE IF EXISTS brands;
DELETE FROM supplement_types WHERE id = 'alpha-gpc';
