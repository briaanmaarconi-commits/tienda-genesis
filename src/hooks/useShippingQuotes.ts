import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useShopData";

export type ShippingQuote = {
  method_id: string;
  method_name: string;
  provider: string;
  delivery_type: string;
  cost: number;
  free: boolean;
  estimated_time: string | null;
  needs_branch: boolean;
  pickup_hours?: string | null;
  zone_id?: string | null;
  source: "andreani" | "oca" | "correo" | "manual_table" | "local_zone" | "pickup" | "fixed" | "fallback";
  error?: string | null;
};

type CartItem = { product: any; qty: number };

const computeWeight = (items: CartItem[]) =>
  Math.max(0.1, items.reduce((acc, it) => acc + (Number(it.product.weight_kg) || 0.5) * it.qty, 0));

async function lookupManualRate(methodId: string, postalCode: string, province: string) {
  const { data: rates } = await supabase
    .from("shipping_rates" as any)
    .select("*")
    .eq("shipping_method_id", methodId)
    .eq("active", true)
    .order("sort_order");
  const cpNum = parseInt(postalCode, 10);
  return (rates ?? []).find((r: any) => {
    if (r.province && province && r.province.toLowerCase() === province.toLowerCase()) return true;
    if (r.postal_code_from && r.postal_code_to) {
      const from = parseInt(r.postal_code_from, 10);
      const to = parseInt(r.postal_code_to, 10);
      return cpNum >= from && cpNum <= to;
    }
    if (r.postal_code_from && !r.postal_code_to) return postalCode.startsWith(r.postal_code_from);
    return false;
  }) as any;
}

async function lookupLocalZone(methodId: string, postalCode: string) {
  const { data: zones } = await supabase
    .from("local_delivery_zones" as any)
    .select("*")
    .eq("shipping_method_id", methodId)
    .eq("active", true)
    .order("sort_order");
  return (zones ?? []).find((z: any) => (z.postal_codes ?? []).includes(postalCode)) as any;
}

async function checkFreeShipping(methodId: string, province: string, postalCode: string, cartTotal: number) {
  const { data: rules } = await supabase
    .from("free_shipping_rules" as any)
    .select("*")
    .eq("active", true);
  const cpNum = parseInt(postalCode, 10);
  return (rules ?? []).some((r: any) => {
    if (r.shipping_method_id && r.shipping_method_id !== methodId) return false;
    if (Number(cartTotal) < Number(r.min_amount ?? 0)) return false;
    if (r.province && (!province || r.province.toLowerCase() !== province.toLowerCase())) return false;
    if (r.postal_code_from && r.postal_code_to) {
      const from = parseInt(r.postal_code_from, 10);
      const to = parseInt(r.postal_code_to, 10);
      if (isNaN(cpNum) || cpNum < from || cpNum > to) return false;
    }
    return true;
  });
}

export function useShippingQuotes(opts: {
  methods: any[];
  postalCode: string;
  province: string;
  items: CartItem[];
  cartTotal: number;
}) {
  const { methods, postalCode, province, items, cartTotal } = opts;
  const { data: settings } = useSiteSettings();
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [loading, setLoading] = useState(false);

  const cpReady = postalCode.length >= 4;
  const totalWeight = computeWeight(items);
  const origin = (settings as any)?.shipping_origin_postal_code || "1414";

  useEffect(() => {
    if (!methods.length) { setQuotes([]); return; }
    if (!cpReady) { setQuotes([]); return; }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      const results = await Promise.all(
        methods.map(async (m: any): Promise<ShippingQuote> => {
          const base: ShippingQuote = {
            method_id: m.id,
            method_name: m.name,
            provider: m.provider ?? "manual",
            delivery_type: m.delivery_type ?? "domicilio",
            cost: Number(m.cost ?? 0),
            free: false,
            estimated_time: m.estimated_time ?? null,
            needs_branch: (m.delivery_type ?? "domicilio") === "sucursal",
            pickup_hours: m.pickup_hours ?? null,
            source: "fixed",
          };

          try {
            // Retiro en local
            if (m.provider === "pickup" || m.delivery_type === "pickup") {
              return { ...base, cost: 0, free: true, source: "pickup", needs_branch: false };
            }

            // Zona local de cadetería
            if (m.delivery_type === "local_zone" || m.provider === "local") {
              const zone = await lookupLocalZone(m.id, postalCode);
              if (zone) {
                return {
                  ...base,
                  cost: Number(zone.cost),
                  estimated_time: zone.estimated_time ?? base.estimated_time,
                  source: "local_zone",
                  zone_id: zone.id,
                  needs_branch: false,
                };
              }
              return { ...base, error: "Fuera de zona de cadetería", source: "fallback", needs_branch: false };
            }

            // Andreani
            if (m.provider === "andreani") {
              const { data, error } = await supabase.functions.invoke("andreani-quote", {
                body: {
                  postal_code_origin: origin,
                  postal_code_destination: postalCode,
                  weight_kg: totalWeight,
                  length_cm: 20, width_cm: 20, height_cm: 20,
                  declared_value: Math.max(1000, cartTotal),
                  delivery_type: m.delivery_type === "sucursal" ? "sucursal" : "domicilio",
                },
              });
              if (!error && typeof data?.cost === "number" && data.cost > 0) {
                return {
                  ...base,
                  cost: data.cost,
                  estimated_time: data.estimated_days ? `${data.estimated_days} días hábiles` : base.estimated_time,
                  source: "andreani",
                };
              }
            }

            // OCA
            if (m.provider === "oca") {
              const { data, error } = await supabase.functions.invoke("oca-quote", {
                body: {
                  postal_code_origin: origin,
                  postal_code_destination: postalCode,
                  weight_kg: totalWeight,
                  declared_value: Math.max(1000, cartTotal),
                  delivery_type: m.delivery_type === "sucursal" ? "sucursal" : "domicilio",
                },
              });
              if (!error && typeof data?.cost === "number" && data.cost > 0) {
                return {
                  ...base,
                  cost: data.cost,
                  estimated_time: data.estimated_days ? `${data.estimated_days} días hábiles` : base.estimated_time,
                  source: "oca",
                };
              }
            }

            // Correo Argentino
            if (m.provider === "correo") {
              const { data, error } = await supabase.functions.invoke("correo-quote", {
                body: {
                  postal_code_origin: origin,
                  postal_code_destination: postalCode,
                  weight_kg: totalWeight,
                  declared_value: Math.max(1000, cartTotal),
                  delivery_type: m.delivery_type === "sucursal" ? "sucursal" : "domicilio",
                },
              });
              if (!error && typeof data?.cost === "number" && data.cost > 0) {
                return {
                  ...base,
                  cost: data.cost,
                  estimated_time: data.estimated_days ? `${data.estimated_days} días hábiles` : base.estimated_time,
                  source: "correo",
                };
              }
            }

            // Fallback: tabla manual
            const manual = await lookupManualRate(m.id, postalCode, province);
            if (manual) {
              return { ...base, cost: Number(manual.cost), source: "manual_table" };
            }

            // Último fallback: costo fijo del método
            return { ...base, source: "fixed" };
          } catch (e: any) {
            return { ...base, error: e?.message ?? "Error al cotizar", source: "fallback" };
          }
        })
      );

      // Aplicar reglas de envío gratis
      const withFree = await Promise.all(
        results.map(async (q) => {
          if (q.source === "pickup") return q;
          const free = await checkFreeShipping(q.method_id, province, postalCode, cartTotal);
          return free ? { ...q, cost: 0, free: true } : q;
        })
      );

      if (!cancelled) {
        setQuotes(withFree);
        setLoading(false);
      }
    };

    const t = setTimeout(run, 400);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [methods.map((m: any) => m.id).join(","), postalCode, province, totalWeight, cartTotal, origin, cpReady]);

  return { quotes, loading };
}
