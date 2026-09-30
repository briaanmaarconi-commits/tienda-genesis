import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const usePaymentMethods = (onlyActive = false) =>
  useQuery({
    queryKey: ["payment_methods", onlyActive],
    queryFn: () => api.get<any[]>(onlyActive ? "/payment-methods" : "/admin/payment-methods"),
  });

export const useShippingMethods = (onlyActive = false) =>
  useQuery({
    queryKey: ["shipping_methods", onlyActive],
    queryFn: () => api.get<any[]>(onlyActive ? "/shipping-methods" : "/admin/shipping-methods"),
  });

export const useCustomers = () =>
  useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<any[]>("/admin/customers"),
  });

export const useSales = (filters?: { status?: string; from?: string; to?: string; search?: string }) =>
  useQuery({
    queryKey: ["sales", filters],
    queryFn: async () => {
      const list = await api.get<any[]>("/admin/sales", {
        status: filters?.status && filters.status !== "all" ? filters.status : undefined,
        from: filters?.from,
        to: filters?.to,
      });
      if (!filters?.search) return list;
      const s = filters.search.toLowerCase();
      return list.filter((sale: any) =>
        sale.customer?.name?.toLowerCase().includes(s) ||
        sale.customer?.phone?.toLowerCase().includes(s) ||
        sale.customer?.email?.toLowerCase().includes(s)
      );
    },
  });

export const useExpenses = () =>
  useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get<any[]>("/admin/expenses"),
  });

export const useSale = (id?: string) =>
  useQuery({
    queryKey: ["sale", id],
    enabled: !!id,
    queryFn: () => api.get<any>(`/admin/sales/${id}`),
  });
