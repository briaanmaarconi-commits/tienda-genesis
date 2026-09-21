import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePaymentMethods = (onlyActive = false) =>
  useQuery({
    queryKey: ["payment_methods", onlyActive],
    queryFn: async () => {
      let q = supabase.from("payment_methods").select("*").order("sort_order");
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export const useShippingMethods = (onlyActive = false) =>
  useQuery({
    queryKey: ["shipping_methods", onlyActive],
    queryFn: async () => {
      let q = supabase.from("shipping_methods").select("*").order("sort_order");
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCustomers = () =>
  useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useSales = (filters?: { status?: string; from?: string; to?: string; search?: string }) =>
  useQuery({
    queryKey: ["sales", filters],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("*, customer:customers(id,name,phone,email), payment_method:payment_methods(name), shipping_method:shipping_methods(name), items:sale_items(id,product_name,unit_price,quantity,subtotal)")
        .order("created_at", { ascending: false });
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status as any);
      if (filters?.from) q = q.gte("created_at", filters.from);
      if (filters?.to) q = q.lte("created_at", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      let list = data ?? [];
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        list = list.filter((sale: any) =>
          sale.customer?.name?.toLowerCase().includes(s) ||
          sale.customer?.phone?.toLowerCase().includes(s) ||
          sale.customer?.email?.toLowerCase().includes(s)
        );
      }
      return list;
    },
  });

export const useSale = (id?: string) =>
  useQuery({
    queryKey: ["sale", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customer:customers(*), payment_method:payment_methods(*), shipping_method:shipping_methods(*), items:sale_items(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
