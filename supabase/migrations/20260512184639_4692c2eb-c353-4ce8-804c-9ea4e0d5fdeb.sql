ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'standard';

CREATE TABLE public.product_sticker_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  name text NOT NULL,
  slug text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.product_sticker_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sticker_folders_product ON public.product_sticker_folders(product_id);
CREATE INDEX idx_stickers_folder ON public.product_stickers(folder_id);

ALTER TABLE public.product_sticker_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sticker folders" ON public.product_sticker_folders FOR SELECT USING (true);
CREATE POLICY "Admins manage sticker folders" ON public.product_sticker_folders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view stickers" ON public.product_stickers FOR SELECT USING (true);
CREATE POLICY "Admins manage stickers" ON public.product_stickers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sticker_folders_updated BEFORE UPDATE ON public.product_sticker_folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stickers_updated BEFORE UPDATE ON public.product_stickers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();