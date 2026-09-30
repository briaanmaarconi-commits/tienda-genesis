-- Schema added directly against the live Supabase project during this
-- session's earlier cost/expense/profit-analytics work (see memory:
-- project-tienda-genesis-metrics) — never went through a migration file,
-- so 000_schema.sql (built purely from the 39 historical migration files)
-- doesn't know about it. RLS/policy lines dropped as usual; authorization
-- for `expenses` (admin-only, same as products/sales/site_settings) is
-- enforced by the requireAdmin middleware instead.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0;

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS employee_profit_pct numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric not null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);
