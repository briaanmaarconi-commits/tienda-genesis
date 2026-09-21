import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sale_id } = await req.json();
    if (!sale_id) throw new Error("sale_id requerido");

    const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sale, error: e1 } = await supabase
      .from("sales")
      .select("id, total, shipping_cost, surcharge, discount_amount, customer_id, customers(name, email)")
      .eq("id", sale_id)
      .single();
    if (e1 || !sale) throw new Error("Venta no encontrada");

    const { data: items } = await supabase
      .from("sale_items")
      .select("product_name, quantity, unit_price, subtotal, addons")
      .eq("sale_id", sale_id);

    const origin = req.headers.get("origin") || "";
    const customer: any = sale.customers;

    const mpItems: any[] = [];
    for (const it of items ?? []) {
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.unit_price) || 0;
      const subtotal = Number(it.subtotal) || unit * qty;
      // Base product line
      mpItems.push({
        title: String(it.product_name).slice(0, 250),
        quantity: qty,
        unit_price: unit,
        currency_id: "ARS",
      });
      // Addon extras (difference between subtotal and base) as a single line to avoid rounding issues
      const extras = Math.max(0, Math.round((subtotal - unit * qty) * 100) / 100);
      if (extras > 0) {
        const addonLabels = Array.isArray(it.addons)
          ? (it.addons as any[]).map((a: any) => a?.option_name || a?.group_name).filter(Boolean).join(", ")
          : "";
        mpItems.push({
          title: `Adicionales${addonLabels ? ` - ${addonLabels}` : ""} (${it.product_name})`.slice(0, 250),
          quantity: 1,
          unit_price: extras,
          currency_id: "ARS",
        });
      }
    }
    const shippingCost = Number((sale as any).shipping_cost ?? 0);
    if (shippingCost > 0) mpItems.push({ title: "Envío", quantity: 1, unit_price: shippingCost, currency_id: "ARS" });
    const surcharge = Number((sale as any).surcharge ?? 0);
    if (surcharge > 0) mpItems.push({ title: "Recargo", quantity: 1, unit_price: surcharge, currency_id: "ARS" });
    const discount = Number((sale as any).discount_amount ?? 0);
    if (discount > 0) mpItems.push({ title: "Descuento", quantity: 1, unit_price: -discount, currency_id: "ARS" });

    const body = {
      items: mpItems,
      payer: customer?.email ? { name: customer.name, email: customer.email } : { name: customer?.name },
      external_reference: sale.id,
      back_urls: {
        success: `${origin}/pago/exito?sale_id=${sale.id}`,
        failure: `${origin}/pago/error?sale_id=${sale.id}`,
        pending: `${origin}/pago/pendiente?sale_id=${sale.id}`,
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) throw new Error(`MP error: ${JSON.stringify(mpData)}`);

    await supabase.from("sales").update({ mp_preference_id: mpData.id }).eq("id", sale.id);

    return new Response(
      JSON.stringify({ init_point: mpData.init_point, sandbox_init_point: mpData.sandbox_init_point, preference_id: mpData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("mp-create-preference error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
