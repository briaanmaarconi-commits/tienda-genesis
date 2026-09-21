
CREATE TABLE public.product_addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  name text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_addon_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_addon_groups TO authenticated;
GRANT ALL ON public.product_addon_groups TO service_role;
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active addon groups" ON public.product_addon_groups
  FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage addon groups" ON public.product_addon_groups
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_product_addon_groups
  BEFORE UPDATE ON public.product_addon_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_addon_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  name text NOT NULL,
  extra_price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_addon_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_addon_options TO authenticated;
GRANT ALL ON public.product_addon_options TO service_role;
ALTER TABLE public.product_addon_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active addon options" ON public.product_addon_options
  FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage addon options" ON public.product_addon_options
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_product_addon_options
  BEFORE UPDATE ON public.product_addon_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS addons jsonb;
