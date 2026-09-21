ALTER TABLE public.product_sticker_folders
  ADD CONSTRAINT product_sticker_folders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;