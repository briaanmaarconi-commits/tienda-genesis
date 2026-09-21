ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS about_content TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS info_content TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS info_faqs JSONB DEFAULT '[]'::jsonb;

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();