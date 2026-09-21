ALTER TABLE public.product_packs ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.product_packs ALTER COLUMN units DROP NOT NULL;