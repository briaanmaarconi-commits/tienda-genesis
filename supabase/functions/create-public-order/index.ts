import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lightweight input validation (no external deps) — server-side authoritative.
const isStr = (v: unknown, max = 500) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { customer, sale, items, coupon_code } = payload ?? {};

    if (!customer || !isStr(customer.name, 100) || !isStr(customer.phone, 30)) {
      return new Response(JSON.stringify({ error: "Datos de cliente inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sale || !isStr(sale.payment_method_id) || !isStr(sale.shipping_method_id)) {
      return new Response(JSON.stringify({ error: "Datos de envío/pago inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
      return new Response(JSON.stringify({ error: "Items inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Server-side coupon validation & discount computation.
    let discount_amount = 0;
    let appliedCouponCode: string | null = null;
    const subtotal = num(sale.subtotal) || 0;

    if (coupon_code && isStr(coupon_code, 64)) {
      const { data: c } = await supabase
        .from("coupons")
        .select("*")
        .ilike("code", String(coupon_code).trim())
        .eq("active", true)
        .maybeSingle();
      const now = Date.now();
      if (
        c &&
        (!c.starts_at || new Date(c.starts_at).getTime() <= now) &&
        (!c.ends_at || new Date(c.ends_at).getTime() >= now) &&
        (c.usage_limit == null || c.times_used < c.usage_limit) &&
        (c.min_order_total == null || subtotal >= Number(c.min_order_total))
      ) {
        const v = Number(c.discount_value);
        discount_amount =
          c.discount_type === "percentage"
            ? Math.round(((subtotal * v) / 100) * 100) / 100
            : Math.min(v, subtotal);
        appliedCouponCode = c.code;
      }
    }

    const shipping_cost = Math.max(0, num(sale.shipping_cost) || 0);
    const surcharge = Math.max(0, num(sale.surcharge) || 0);
    const total = Math.max(0, subtotal - discount_amount) + shipping_cost + surcharge;

    const { data: customerRow, error: e0 } = await supabase
      .from("customers")
      .insert({
        name: String(customer.name).trim().slice(0, 100),
        phone: String(customer.phone).trim().slice(0, 30),
        email: customer.email ? String(customer.email).trim().slice(0, 255) : null,
        address: customer.address ? String(customer.address).trim().slice(0, 300) : null,
      })
      .select()
      .single();
    if (e0) throw e0;

    const { data: saleRow, error: e1 } = await supabase
      .from("sales")
      .insert({
        customer_id: customerRow.id,
        payment_method_id: sale.payment_method_id,
        shipping_method_id: sale.shipping_method_id,
        subtotal,
        shipping_cost,
        surcharge,
        discount_amount,
        coupon_code: appliedCouponCode,
        total,
        status: "pendiente",
        source: "public",
        notes: sale.notes ? String(sale.notes).slice(0, 500) : null,
        shipping_postal_code: sale.shipping_postal_code ?? null,
        shipping_province: sale.shipping_province ?? null,
        shipping_locality: sale.shipping_locality ?? null,
        shipping_branch_id: sale.shipping_branch_id ?? null,
        shipping_branch_name: sale.shipping_branch_name ?? null,
      } as any)
      .select()
      .single();
    if (e1) throw e1;

    const rows = items.map((it: any) => ({
      sale_id: saleRow.id,
      product_id: null,
      product_name: String(it.product_name ?? "").slice(0, 300),
      unit_price: Math.max(0, num(it.unit_price) || 0),
      quantity: Math.max(1, Math.floor(num(it.quantity) || 1)),
      subtotal: Math.max(0, num(it.subtotal) || 0),
      custom_sticker_config: it.custom_sticker_config ?? null,
      addons: it.addons ?? null,
      photos: Array.isArray(it.photos) ? it.photos.slice(0, 500).map((u: any) => String(u).slice(0, 1000)) : null,
    }));
    const { error: e2 } = await supabase.from("sale_items").insert(rows as any);
    if (e2) throw e2;

    if (appliedCouponCode) {
      await supabase.rpc("apply_coupon", { _code: appliedCouponCode });
    }

    try {
      await supabase.functions.invoke("send-admin-order-notification", {
        body: { sale_id: saleRow.id, event: "new" },
      });
    } catch (e) {
      console.error("send-admin-order-notification (new) failed", e);
    }

    // Bank transfer data is private: only returned to the buyer that just
    // created an order paid by manual transfer.
    let transfer: Record<string, string | null> | null = null;
    try {
      const { data: pm } = await supabase
        .from("payment_methods")
        .select("name, provider")
        .eq("id", sale.payment_method_id)
        .maybeSingle();
      if (pm && pm.provider === "manual" && /transfer/i.test(pm.name ?? "")) {
        const { data: st } = await supabase
          .from("site_settings")
          .select("transfer_alias, transfer_holder, transfer_cbu, transfer_bank, transfer_notes")
          .limit(1)
          .maybeSingle();
        if (st) transfer = st as any;
      }
    } catch (e) {
      console.error("transfer details lookup failed", e);
    }

    return new Response(
      JSON.stringify({ sale_id: saleRow.id, total, discount_amount, coupon_code: appliedCouponCode, transfer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("create-public-order error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
