DO $$
DECLARE pid uuid := '192543a1-c4a3-449a-b110-8e9ef3ed0897';
BEGIN
  DELETE FROM public.product_packs WHERE product_id = pid;

  INSERT INTO public.product_packs (product_id, label, units, price, photos_required, sort_order) VALUES
    (pid, '1 unidad', 1, 0, 1, 0),
    (pid, '10 unidades', 10, 0, 10, 1),
    (pid, '50 unidades', 50, 0, 50, 2),
    (pid, '100 unidades', 100, 0, 100, 3);

  UPDATE public.product_addon_groups
    SET per_unit = true, is_multiplier = false
    WHERE product_id = pid AND name = 'tamaños';

  UPDATE public.product_addon_groups
    SET active = false, required = false
    WHERE product_id = pid AND name = 'unidades';
END $$;