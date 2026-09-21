
-- 1) customers: drop public read & public insert; admins-only via existing "Admins manage customers"
DROP POLICY IF EXISTS "Public can read customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;

-- 2) sales: drop public read & public insert
DROP POLICY IF EXISTS "Public can read public sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can create public sales" ON public.sales;

-- 3) sale_items: drop public read & public insert
DROP POLICY IF EXISTS "Public can read sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Anyone can insert sale items" ON public.sale_items;

-- 4) coupons: drop public read; admins-only via existing "Admins manage coupons"
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

-- 5) Restrict SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.apply_coupon(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_coupon(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- has_role: switch to SECURITY INVOKER (user_roles already lets users read their own rows)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6) Storage: drop overly broad SELECT (listing) policies on public buckets
DROP POLICY IF EXISTS "Anyone can read customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view custom sticker uploads" ON storage.objects;

-- Tighten the always-true INSERT policies by scoping them to their bucket
DROP POLICY IF EXISTS "Anyone can upload customer photos" ON storage.objects;
CREATE POLICY "Public upload to customer-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'customer-photos');

DROP POLICY IF EXISTS "Anyone can upload custom sticker uploads" ON storage.objects;
CREATE POLICY "Public upload to custom-sticker-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'custom-sticker-uploads');
