
ALTER TABLE public.product_addon_groups
  ADD CONSTRAINT product_addon_groups_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.product_addon_options
  ADD CONSTRAINT product_addon_options_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.product_addon_groups(id) ON DELETE CASCADE;
