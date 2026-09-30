import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { sales, siteSettings } from "../db/schema.js";

const resend = new Resend(env.RESEND_API_KEY);
const FROM_EMAIL = "Genesis QR <ventas@genesisqr.com>";

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

export async function sendAdminOrderNotification(saleId: string, event: "new" | "paid" = "new") {
  const sale = await db.query.sales.findFirst({
    where: eq(sales.id, saleId),
    with: { customer: true, paymentMethod: true, shippingMethod: true, saleItems: true },
  });
  if (!sale) throw new Error("Venta no encontrada");

  const [settings] = await db
    .select({ adminNotifyEmail: siteSettings.adminNotifyEmail, siteName: siteSettings.siteName, email: siteSettings.email })
    .from(siteSettings)
    .limit(1);

  const notifyTo = (settings?.adminNotifyEmail || settings?.email || "").trim();
  if (!notifyTo) return { skipped: true };

  const recipients = notifyTo
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const c = sale.customer ?? ({} as { name?: string | null; phone?: string | null; email?: string | null; address?: string | null });
  const items = sale.saleItems ?? [];
  const total = Number(sale.total || 0);

  const isPaid = event === "paid";
  const subject = isPaid ? `💰 Pago confirmado ${fmt(total)} — ${c.name ?? ""}` : `🛒 Nueva venta ${fmt(total)} — ${c.name ?? ""}`;

  const itemsHtml = items
    .map(
      (it) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${it.productName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(Number(it.subtotal))}</td>
      </tr>`,
    )
    .join("");

  const waPhone = String(c.phone || "").replace(/\D/g, "");
  const addressLine = [sale.shippingLocality, sale.shippingProvince, sale.shippingPostalCode].filter(Boolean).join(", ");

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:16px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
        <div style="background:${isPaid ? "#16a34a" : "#0f172a"};color:#fff;padding:16px 20px">
          <h1 style="margin:0;font-size:18px">${isPaid ? "💰 Pago confirmado" : "🛒 Nueva venta"}</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:.85">${settings?.siteName ?? ""} · #${String(sale.id).slice(0, 8)}</p>
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
            🚚 ${sale.shippingMethod?.name ?? "-"}${sale.shippingBranchName ? ` — ${sale.shippingBranchName}` : ""}<br/>
            ${addressLine ? `📍 ${addressLine}<br/>` : ""}
            💳 ${sale.paymentMethod?.name ?? "-"}
          </p>

          <table style="width:100%;margin-top:16px;font-size:14px">
            <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(sale.subtotal))}</td></tr>
            ${Number(sale.discountAmount) > 0 ? `<tr><td>Descuento ${sale.couponCode ? `(${sale.couponCode})` : ""}</td><td style="text-align:right;color:#16a34a">-${fmt(Number(sale.discountAmount))}</td></tr>` : ""}
            <tr><td>Envío</td><td style="text-align:right">${fmt(Number(sale.shippingCost))}</td></tr>
            ${Number(sale.surcharge) > 0 ? `<tr><td>Recargo</td><td style="text-align:right">${fmt(Number(sale.surcharge))}</td></tr>` : ""}
            <tr><td style="padding-top:8px;border-top:2px solid #0f172a;font-weight:bold;font-size:16px">Total</td>
                <td style="padding-top:8px;border-top:2px solid #0f172a;text-align:right;font-weight:bold;font-size:16px;color:#0f172a">${fmt(total)}</td></tr>
          </table>

          ${sale.notes ? `<p style="margin-top:16px;padding:10px;background:#fef3c7;border-radius:8px;font-size:13px"><strong>Notas:</strong> ${sale.notes}</p>` : ""}
        </div>
      </div>
    </body></html>`;

  const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: recipients, subject, html });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { ok: true, to: recipients, id: data?.id ?? null };
}
