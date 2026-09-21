
-- 1) site_settings: stop exposing financial/admin data publicly
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
REVOKE SELECT ON public.site_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

CREATE OR REPLACE VIEW public.site_settings_public
WITH (security_invoker = off) AS
SELECT id, site_name, logo_url, phone, email, whatsapp, instagram_url, facebook_url,
       address, updated_at, shipping_origin_postal_code, about_content, info_content, info_faqs
FROM public.site_settings;

GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- 2) customer uploads: readable only by admins (files served via signed URLs)
DROP POLICY IF EXISTS "Admins read customer photos" ON storage.objects;
CREATE POLICY "Admins read customer photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'customer-photos' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins read custom sticker uploads" ON storage.objects;
CREATE POLICY "Admins read custom sticker uploads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'custom-sticker-uploads' AND has_role(auth.uid(), 'admin'::app_role));
