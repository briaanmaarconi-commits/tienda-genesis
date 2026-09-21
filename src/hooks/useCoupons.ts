import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCoupons = () =>
  useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export type CouponValidation = { valid: boolean; discount: number; coupon?: { code: string }; error?: string };

export const validateCoupon = async (code: string, subtotal: number): Promise<CouponValidation> => {
  if (!code.trim()) return { valid: false, discount: 0, error: "Ingresá un código" };
  const { data, error } = await supabase.functions.invoke("validate-coupon", {
    body: { code: code.trim(), subtotal },
  });
  if (error) return { valid: false, discount: 0, error: error.message };
  if (!data?.valid) return { valid: false, discount: 0, error: data?.error ?? "Código inválido" };
  return { valid: true, discount: Number(data.discount) || 0, coupon: { code: data.code } };
};
