
-- Materials
CREATE TABLE public.sticker_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sticker_materials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_materials TO authenticated;
GRANT ALL ON public.sticker_materials TO service_role;
ALTER TABLE public.sticker_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active materials" ON public.sticker_materials FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage materials" ON public.sticker_materials FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_sticker_materials BEFORE UPDATE ON public.sticker_materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Finishes
CREATE TABLE public.sticker_finishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  surcharge numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sticker_finishes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_finishes TO authenticated;
GRANT ALL ON public.sticker_finishes TO service_role;
ALTER TABLE public.sticker_finishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active finishes" ON public.sticker_finishes FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage finishes" ON public.sticker_finishes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_sticker_finishes BEFORE UPDATE ON public.sticker_finishes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shapes
CREATE TABLE public.sticker_shapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sticker_shapes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_shapes TO authenticated;
GRANT ALL ON public.sticker_shapes TO service_role;
ALTER TABLE public.sticker_shapes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active shapes" ON public.sticker_shapes FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage shapes" ON public.sticker_shapes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_sticker_shapes BEFORE UPDATE ON public.sticker_shapes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sizes
CREATE TABLE public.sticker_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  width_cm numeric NOT NULL DEFAULT 0,
  height_cm numeric NOT NULL DEFAULT 0,
  price_multiplier numeric NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sticker_sizes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_sizes TO authenticated;
GRANT ALL ON public.sticker_sizes TO service_role;
ALTER TABLE public.sticker_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active sizes" ON public.sticker_sizes FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage sizes" ON public.sticker_sizes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_sticker_sizes BEFORE UPDATE ON public.sticker_sizes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Quantities
CREATE TABLE public.sticker_quantities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity int NOT NULL,
  discount_pct numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sticker_quantities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_quantities TO authenticated;
GRANT ALL ON public.sticker_quantities TO service_role;
ALTER TABLE public.sticker_quantities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active quantities" ON public.sticker_quantities FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage quantities" ON public.sticker_quantities FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_sticker_quantities BEFORE UPDATE ON public.sticker_quantities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sale items field for custom sticker config
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS custom_sticker_config jsonb;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('custom-sticker-uploads', 'custom-sticker-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view custom sticker uploads" ON storage.objects FOR SELECT USING (bucket_id = 'custom-sticker-uploads');
CREATE POLICY "Anyone can upload custom sticker uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'custom-sticker-uploads');
CREATE POLICY "Admins delete custom sticker uploads" ON storage.objects FOR DELETE USING (bucket_id = 'custom-sticker-uploads' AND has_role(auth.uid(), 'admin'::app_role));

-- Seed defaults
INSERT INTO public.sticker_materials (name, base_price, sort_order) VALUES
  ('Vinilo blanco', 100, 1),
  ('Vinilo transparente', 120, 2),
  ('Vinilo dorado', 180, 3),
  ('Vinilo holográfico', 200, 4);

INSERT INTO public.sticker_finishes (name, surcharge, sort_order) VALUES
  ('Laca brillo', 0, 1),
  ('Laminado mate', 30, 2),
  ('Laminado brillo', 30, 3);

INSERT INTO public.sticker_shapes (name, icon, sort_order) VALUES
  ('Circular', 'circle', 1),
  ('Cuadrado', 'square', 2),
  ('Rectangular', 'rectangle-horizontal', 3),
  ('Silueta (corte personalizado)', 'shapes', 4);

INSERT INTO public.sticker_sizes (label, width_cm, height_cm, price_multiplier, sort_order) VALUES
  ('3 × 3 cm', 3, 3, 0.6, 1),
  ('5 × 5 cm', 5, 5, 1.0, 2),
  ('7 × 7 cm', 7, 7, 1.6, 3),
  ('10 × 10 cm', 10, 10, 2.5, 4),
  ('15 × 15 cm', 15, 15, 4.5, 5);

INSERT INTO public.sticker_quantities (quantity, discount_pct, sort_order) VALUES
  (10, 0, 1),
  (25, 5, 2),
  (50, 10, 3),
  (100, 20, 4),
  (250, 30, 5),
  (500, 40, 6);
