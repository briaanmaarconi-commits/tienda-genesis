
-- Add columns to shipping_methods
ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'domicilio',
  ADD COLUMN IF NOT EXISTS estimated_time text,
  ADD COLUMN IF NOT EXISTS pickup_hours text;

-- Add column to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS shipping_branch_name text;

-- Free shipping rules
CREATE TABLE IF NOT EXISTS public.free_shipping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_method_id uuid REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
  min_amount numeric NOT NULL DEFAULT 0,
  province text,
  postal_code_from text,
  postal_code_to text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.free_shipping_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_shipping_rules TO authenticated;
GRANT ALL ON public.free_shipping_rules TO service_role;

ALTER TABLE public.free_shipping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active free shipping rules"
  ON public.free_shipping_rules FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage free shipping rules"
  ON public.free_shipping_rules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_free_shipping_rules
  BEFORE UPDATE ON public.free_shipping_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Local delivery zones
CREATE TABLE IF NOT EXISTS public.local_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_method_id uuid NOT NULL REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
  name text NOT NULL,
  postal_codes text[] NOT NULL DEFAULT '{}',
  cost numeric NOT NULL DEFAULT 0,
  estimated_time text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.local_delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.local_delivery_zones TO authenticated;
GRANT ALL ON public.local_delivery_zones TO service_role;

ALTER TABLE public.local_delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active delivery zones"
  ON public.local_delivery_zones FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage delivery zones"
  ON public.local_delivery_zones FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_local_delivery_zones
  BEFORE UPDATE ON public.local_delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
