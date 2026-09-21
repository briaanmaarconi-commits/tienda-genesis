
-- Enums
CREATE TYPE public.sale_status AS ENUM ('pendiente','confirmada','enviada','entregada','cancelada');
CREATE TYPE public.sale_source AS ENUM ('admin','public');

-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage customers" ON public.customers FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone can create customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payment methods
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  surcharge_pct numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment methods" ON public.payment_methods FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone can view active payment methods" ON public.payment_methods FOR SELECT USING (active = true OR has_role(auth.uid(),'admin'));
CREATE TRIGGER payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shipping methods
CREATE TABLE public.shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shipping methods" ON public.shipping_methods FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone can view active shipping methods" ON public.shipping_methods FOR SELECT USING (active = true OR has_role(auth.uid(),'admin'));
CREATE TRIGGER shipping_methods_updated_at BEFORE UPDATE ON public.shipping_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sales
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  shipping_method_id uuid REFERENCES public.shipping_methods(id) ON DELETE SET NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  surcharge numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status public.sale_status NOT NULL DEFAULT 'pendiente',
  source public.sale_source NOT NULL DEFAULT 'admin',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sales" ON public.sales FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone can create public sales" ON public.sales FOR INSERT WITH CHECK (source = 'public' OR has_role(auth.uid(),'admin'));
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX idx_sales_status ON public.sales(status);

-- Sale items
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sale items" ON public.sale_items FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone can insert sale items" ON public.sale_items FOR INSERT WITH CHECK (true);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);

-- Defaults
INSERT INTO public.payment_methods (name, surcharge_pct, sort_order) VALUES
  ('Efectivo', 0, 1),
  ('Transferencia', 0, 2),
  ('MercadoPago', 0, 3);

INSERT INTO public.shipping_methods (name, cost, sort_order) VALUES
  ('Retiro en local', 0, 1),
  ('Envío local', 0, 2);
