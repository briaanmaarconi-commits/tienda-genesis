
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_kg numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS length_cm numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS width_cm numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS height_cm numeric NOT NULL DEFAULT 10;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS shipping_postal_code text,
  ADD COLUMN IF NOT EXISTS shipping_address_extra text,
  ADD COLUMN IF NOT EXISTS andreani_branch_id text,
  ADD COLUMN IF NOT EXISTS andreani_tracking_number text,
  ADD COLUMN IF NOT EXISTS andreani_label_url text,
  ADD COLUMN IF NOT EXISTS andreani_status text;

ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tipo text;
