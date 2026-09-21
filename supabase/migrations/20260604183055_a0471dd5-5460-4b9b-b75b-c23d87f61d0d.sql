CREATE POLICY "Public can read customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Public can read public sales" ON public.sales FOR SELECT USING (source = 'public' OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Public can read sale items" ON public.sale_items FOR SELECT USING (true);
GRANT SELECT ON public.customers TO anon;
GRANT SELECT ON public.sales TO anon;
GRANT SELECT ON public.sale_items TO anon;