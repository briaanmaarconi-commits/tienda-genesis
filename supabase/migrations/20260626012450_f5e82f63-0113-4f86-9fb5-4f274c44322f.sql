
ALTER TABLE public.product_addon_groups ADD COLUMN IF NOT EXISTS per_unit boolean NOT NULL DEFAULT false;

INSERT INTO public.product_addon_groups (product_id, name, required, per_unit, sort_order)
VALUES
  ('00c0a9b5-8414-462b-873b-0d7a7cd177b1', 'Imán', false, true, 1),
  ('fd232eb6-92f3-4d25-8910-2144649757f1', 'Imán', false, true, 1);

INSERT INTO public.product_addon_options (group_id, name, extra_price, sort_order)
SELECT g.id, 'Con imán', 0, 0
FROM public.product_addon_groups g
WHERE g.name = 'Imán' AND g.product_id IN ('00c0a9b5-8414-462b-873b-0d7a7cd177b1','fd232eb6-92f3-4d25-8910-2144649757f1');
