-- Add photos_required to product variants (per pack/measure)
ALTER TABLE public.product_packs
  ADD COLUMN IF NOT EXISTS photos_required integer;

-- Storage bucket for customer-uploaded photos to be printed
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-photos', 'customer-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can upload to customer-photos (anonymous shoppers)
DO $$ BEGIN
  CREATE POLICY "Anyone can upload customer photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'customer-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can read customer photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'customer-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete customer photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'customer-photos' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;