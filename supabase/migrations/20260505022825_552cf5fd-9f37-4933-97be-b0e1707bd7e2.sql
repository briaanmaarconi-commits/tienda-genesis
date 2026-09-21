
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_status text;

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual';

INSERT INTO public.payment_methods (name, provider, surcharge_pct, sort_order, active)
SELECT 'Mercado Pago', 'mercadopago', 0, 100, true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE provider = 'mercadopago');
