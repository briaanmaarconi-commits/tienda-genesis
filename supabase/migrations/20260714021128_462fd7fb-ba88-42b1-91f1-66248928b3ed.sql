ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS transfer_alias text,
  ADD COLUMN IF NOT EXISTS transfer_holder text,
  ADD COLUMN IF NOT EXISTS transfer_cbu text,
  ADD COLUMN IF NOT EXISTS transfer_bank text,
  ADD COLUMN IF NOT EXISTS transfer_notes text;

UPDATE public.site_settings
SET transfer_alias = COALESCE(transfer_alias, 'genesis.impresiones'),
    transfer_holder = COALESCE(transfer_holder, 'Brian Jose Marconi Poggio');