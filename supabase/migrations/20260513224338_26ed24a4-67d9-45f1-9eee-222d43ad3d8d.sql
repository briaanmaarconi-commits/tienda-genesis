
ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS enviopack_carrier text,
  ADD COLUMN IF NOT EXISTS enviopack_modalidad text,
  ADD COLUMN IF NOT EXISTS enviopack_servicio text DEFAULT 'N';

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS enviopack_shipment_id text,
  ADD COLUMN IF NOT EXISTS shipping_province text,
  ADD COLUMN IF NOT EXISTS shipping_locality text,
  ADD COLUMN IF NOT EXISTS shipping_branch_id text;
