
CREATE OR REPLACE VIEW public.site_settings_public
WITH (security_invoker = on) AS
SELECT id, site_name, logo_url, phone, email, whatsapp, instagram_url, facebook_url,
       address, updated_at, shipping_origin_postal_code, about_content, info_content, info_faqs
FROM public.site_settings;

GRANT SELECT ON public.site_settings_public TO anon, authenticated;

GRANT SELECT (id, site_name, logo_url, phone, email, whatsapp, instagram_url, facebook_url,
       address, updated_at, shipping_origin_postal_code, about_content, info_content, info_faqs)
ON public.site_settings TO anon;

DROP POLICY IF EXISTS "Public can view basic site settings" ON public.site_settings;
CREATE POLICY "Public can view basic site settings" ON public.site_settings
FOR SELECT TO anon USING (true);
