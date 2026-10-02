-- Carritos armados por el admin para compartir con un cliente vía link.
-- El cliente completa envío y pago; el admin solo elige productos/cantidades.
CREATE TABLE IF NOT EXISTS public.shared_carts (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  customer_name text,
  customer_phone text,
  notes text,
  items jsonb not null,
  status text not null default 'pendiente',
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS shared_carts_token_key ON public.shared_carts (token);
