import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export const useCoupons = () =>
  useQuery({
    queryKey: ["coupons"],
    queryFn: () => api.get<any[]>("/admin/coupons"),
  });

export type CouponValidation = { valid: boolean; discount: number; coupon?: { code: string }; error?: string };

export const validateCoupon = async (code: string, subtotal: number): Promise<CouponValidation> => {
  if (!code.trim()) return { valid: false, discount: 0, error: "Ingresá un código" };
  try {
    const data = await api.post<{ valid: boolean; discount: number; code: string; error?: string }>("/coupons/validate", {
      code: code.trim(),
      subtotal,
    });
    if (!data?.valid) return { valid: false, discount: 0, error: data?.error ?? "Código inválido" };
    return { valid: true, discount: Number(data.discount) || 0, coupon: { code: data.code } };
  } catch (err) {
    return { valid: false, discount: 0, error: err instanceof ApiError ? err.message : "Error" };
  }
};
