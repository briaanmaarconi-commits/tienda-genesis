
-- Limpieza Enviopack (no se usa)
ALTER TABLE public.shipping_methods 
  DROP COLUMN IF EXISTS enviopack_carrier,
  DROP COLUMN IF EXISTS enviopack_modalidad,
  DROP COLUMN IF EXISTS enviopack_servicio;

ALTER TABLE public.sales DROP COLUMN IF EXISTS enviopack_shipment_id;

-- Modo de cálculo de tarifa
ALTER TABLE public.shipping_methods 
  ADD COLUMN IF NOT EXISTS rate_mode text NOT NULL DEFAULT 'fixed';
-- valores válidos: 'fixed', 'andreani_api', 'manual_table'

-- CP de origen del comercio (para cotizar)
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS shipping_origin_postal_code text;

-- Tabla de tarifas manuales
CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_method_id uuid NOT NULL REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
  province text,
  postal_code_from text,
  postal_code_to text,
  cost numeric NOT NULL DEFAULT 0,
  free_from_amount numeric,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shipping_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_rates TO authenticated;
GRANT ALL ON public.shipping_rates TO service_role;

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active shipping rates"
  ON public.shipping_rates FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage shipping rates"
  ON public.shipping_rates FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_shipping_rates_updated_at
  BEFORE UPDATE ON public.shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_shipping_rates_method ON public.shipping_rates(shipping_method_id);
