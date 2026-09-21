
CREATE SEQUENCE IF NOT EXISTS public.sales_order_number_seq START WITH 1000 INCREMENT BY 1;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS order_number INTEGER UNIQUE;

-- Backfill existing rows in created_at order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) + 999 AS n
  FROM public.sales
  WHERE order_number IS NULL
)
UPDATE public.sales s SET order_number = o.n FROM ordered o WHERE s.id = o.id;

-- Advance sequence past current max
SELECT setval('public.sales_order_number_seq', GREATEST(1000, COALESCE((SELECT MAX(order_number) FROM public.sales), 999)) + 1, false);

ALTER TABLE public.sales ALTER COLUMN order_number SET DEFAULT nextval('public.sales_order_number_seq');
ALTER TABLE public.sales ALTER COLUMN order_number SET NOT NULL;
ALTER SEQUENCE public.sales_order_number_seq OWNED BY public.sales.order_number;
