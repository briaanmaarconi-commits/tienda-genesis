ALTER TABLE public.product_addon_groups ADD COLUMN IF NOT EXISTS is_multiplier boolean NOT NULL DEFAULT false;
ALTER TABLE public.product_addon_options ADD COLUMN IF NOT EXISTS price_multiplier numeric NOT NULL DEFAULT 1;

UPDATE public.product_addon_groups SET is_multiplier = true, per_unit = false WHERE id = '96fa46ea-18b9-4000-ad05-65757cfcdd63';

UPDATE public.product_addon_options SET price_multiplier = CASE
  WHEN name = 'x1' THEN 1
  WHEN name = 'x10' THEN 10
  WHEN name = 'x50' THEN 50
  WHEN name = 'x100' THEN 100
  ELSE 1 END
WHERE group_id = '96fa46ea-18b9-4000-ad05-65757cfcdd63';