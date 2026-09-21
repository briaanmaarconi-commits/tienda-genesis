import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, subtotal } = await req.json();
    if (typeof code !== "string" || code.trim().length === 0 || code.length > 64) {
      return new Response(JSON.stringify({ valid: false, discount: 0, error: "Ingresá un código" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sub = Number(subtotal) || 0;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, starts_at, ends_at, usage_limit, times_used, min_order_total, active")
      .ilike("code", code.trim())
      .eq("active", true)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ valid: false, discount: 0, error: "Código inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data) {
      return new Response(JSON.stringify({ valid: false, discount: 0, error: "Código inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const now = Date.now();
    if (data.starts_at && new Date(data.starts_at).getTime() > now)
      return json({ valid: false, discount: 0, error: "El cupón aún no está vigente" });
    if (data.ends_at && new Date(data.ends_at).getTime() < now)
      return json({ valid: false, discount: 0, error: "El cupón expiró" });
    if (data.usage_limit != null && data.times_used >= data.usage_limit)
      return json({ valid: false, discount: 0, error: "El cupón se agotó" });
    if (data.min_order_total != null && sub < Number(data.min_order_total))
      return json({ valid: false, discount: 0, error: `Mínimo de compra: $${data.min_order_total}` });

    const v = Number(data.discount_value);
    const discount =
      data.discount_type === "percentage"
        ? Math.round(((sub * v) / 100) * 100) / 100
        : Math.min(v, sub);

    return json({ valid: true, discount, code: data.code });
  } catch (err: any) {
    return new Response(JSON.stringify({ valid: false, discount: 0, error: "Error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function json(o: unknown) {
    return new Response(JSON.stringify(o), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
