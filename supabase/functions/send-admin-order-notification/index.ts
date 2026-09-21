import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sale_id, event = "new" } = await req.json();
    if (!sale_id) throw new Error("sale_id requerido");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: sale }, { data: settings }] = await Promise.all([
      supabase.from("sales").select("*, customers(*), payment_methods(name), shipping_methods(name), sale_items(*)").eq("id", sale_id).maybeSingle(),
      supabase.from("site_settings").select("admin_notify_email, site_name, email").maybeSingle(),
    ]);

    if (!sale) throw new Error("Venta no encontrada");
    const notifyTo = (settings?.admin_notify_email || settings?.email || "").trim();
    if (!notifyTo) {
      console.log("admin notify: sin email configurado");
      return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const recipients = notifyTo.split(",").map((s: string) => s.trim()).filter(Boolean);
    const c = sale.customers ?? {};
    const items = (sale.sale_items ?? []) as any[];
    const total = Number(sale.total || 0);

    const isPaid = event === "paid";
    const subject = isPaid
      ? `💰 Pago confirmado ${fmt(total)} — ${c.name ?? ""}`
      : `🛒 Nueva venta ${fmt(total)} — ${c.name ?? ""}`;

    const itemsHtml = items.map((it) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${it.product_name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(Number(it.subtotal))}</td>
      </tr>`).join("");

    const waPhone = String(c.phone || "").replace(/\D/g, "");
    const addressLine = [sale.shipping_locality, sale.shipping_province, sale.shipping_postal_code].filter(Boolean).join(", ");

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:16px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
        <div style="background:${isPaid ? "#16a34a" : "#0f172a"};color:#fff;padding:16px 20px">
          <h1 style="margin:0;font-size:18px">${isPaid ? "💰 Pago confirmado" : "🛒 Nueva venta"}</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:.85">${settings?.site_name ?? ""} · #${String(sale.id).slice(0, 8)}</p>
        </div>
        <div style="padding:20px">
          <h2 style="margin:0 0 8px;font-size:16px">Cliente</h2>
          <p style="margin:0;font-size:14px;line-height:1.6">
            <strong>${c.name ?? ""}</strong><br/>
            📞 ${waPhone ? `<a href="https://wa.me/${waPhone}">${c.phone}</a>` : (c.phone ?? "-")}<br/>
            ${c.email ? `✉️ ${c.email}<br/>` : ""}
            ${c.address ? `📍 ${c.address}<br/>` : ""}
          </p>

          <h2 style="margin:18px 0 8px;font-size:16px">Productos</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead><tr style="background:#f1f5f9">
              <th style="padding:6px 8px;text-align:left">Producto</th>
              <th style="padding:6px 8px;text-align:center">Cant.</th>
              <th style="padding:6px 8px;text-align:right">Subtotal</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <h2 style="margin:18px 0 8px;font-size:16px">Envío y pago</h2>
          <p style="margin:0;font-size:14px;line-height:1.6">
            🚚 ${sale.shipping_methods?.name ?? "-"}${sale.shipping_branch_name ? ` — ${sale.shipping_branch_name}` : ""}<br/>
            ${addressLine ? `📍 ${addressLine}<br/>` : ""}
            💳 ${sale.payment_methods?.name ?? "-"}
          </p>

          <table style="width:100%;margin-top:16px;font-size:14px">
            <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(sale.subtotal))}</td></tr>
            ${Number(sale.discount_amount) > 0 ? `<tr><td>Descuento ${sale.coupon_code ? `(${sale.coupon_code})` : ""}</td><td style="text-align:right;color:#16a34a">-${fmt(Number(sale.discount_amount))}</td></tr>` : ""}
            <tr><td>Envío</td><td style="text-align:right">${fmt(Number(sale.shipping_cost))}</td></tr>
            ${Number(sale.surcharge) > 0 ? `<tr><td>Recargo</td><td style="text-align:right">${fmt(Number(sale.surcharge))}</td></tr>` : ""}
            <tr><td style="padding-top:8px;border-top:2px solid #0f172a;font-weight:bold;font-size:16px">Total</td>
                <td style="padding-top:8px;border-top:2px solid #0f172a;text-align:right;font-weight:bold;font-size:16px;color:#0f172a">${fmt(total)}</td></tr>
          </table>

          ${sale.notes ? `<p style="margin-top:16px;padding:10px;background:#fef3c7;border-radius:8px;font-size:13px"><strong>Notas:</strong> ${sale.notes}</p>` : ""}
        </div>
      </div>
    </body></html>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL") || "Genesis QR <ventas@genesisqr.com>";
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) throw new Error("Credenciales de email no configuradas");

    const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });
    const out = await r.json();
    if (!r.ok) throw new Error(`Resend: ${JSON.stringify(out)}`);

    return new Response(JSON.stringify({ ok: true, to: recipients }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-admin-order-notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
