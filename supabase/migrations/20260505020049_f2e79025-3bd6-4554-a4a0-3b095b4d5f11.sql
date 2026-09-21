
-- Products & packs: sale fields
ALTER TABLE public.products
  ADD COLUMN compare_at_price numeric,
  ADD COLUMN sale_starts_at timestamptz,
  ADD COLUMN sale_ends_at timestamptz;

ALTER TABLE public.product_packs
  ADD COLUMN compare_at_price numeric,
  ADD COLUMN sale_starts_at timestamptz,
  ADD COLUMN sale_ends_at timestamptz;

-- Sales: coupon usage
ALTER TABLE public.sales
  ADD COLUMN coupon_code text,
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;

-- Coupons
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type public.discount_type NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_total numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  times_used integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coupons" ON public.coupons
  FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Anyone can view active coupons" ON public.coupons
  FOR SELECT USING (active = true OR has_role(auth.uid(),'admin'));

-- Allow public to increment times_used when applying a coupon during checkout.
-- Restricted via a SECURITY DEFINER function (no direct UPDATE policy needed).
CREATE OR REPLACE FUNCTION public.apply_coupon(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons
  SET times_used = times_used + 1
  WHERE upper(code) = upper(_code)
    AND active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND (usage_limit IS NULL OR times_used < usage_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_coupon(text) TO anon, authenticated;

CREATE TRIGGER coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
