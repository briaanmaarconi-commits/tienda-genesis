CREATE TABLE public.product_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  units integer NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product packs"
  ON public.product_packs FOR SELECT USING (true);

CREATE POLICY "Admins manage product packs"
  ON public.product_packs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_product_packs_product ON public.product_packs(product_id);