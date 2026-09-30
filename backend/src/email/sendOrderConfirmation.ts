import { Resend } from "resend";
import { eq, inArray, asc } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { sales, customers, saleItems, productImages } from "../db/schema.js";

const resend = new Resend(env.RESEND_API_KEY);
const FROM_EMAIL = "Genesis QR <ventas@genesisqr.com>";
const LOGO_URL = "https://ezvbqnpahgelmqvefqsw.supabase.co/storage/v1/object/public/branding/b8bb278e-fd8a-46c7-8a1e-6c880ec0f42f.png";

const money = (n: number) => `$${Number(n || 0).toLocaleString("es-AR")}`;

function renderHtml(opts: { name: string; orderNumber: number; total: number; items: Array<{ name: string; qty: number; price: number; image: string | null }> }) {
  const { name, orderNumber, total, items } = opts;
  const itemsHtml = items
    .map(
      (it) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;width:72px">
        ${it.image ? `<img src="${it.image}" width="64" height="64" style="border-radius:8px;object-fit:cover;display:block" />` : ""}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;color:#111;font-size:14px">
        <div style="font-weight:600">${it.name}</div>
        <div style="color:#666;font-size:12px">Cantidad: ${it.qty}</div>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;color:#111;font-size:14px;text-align:right;white-space:nowrap">
        ${money(it.price * it.qty)}
      </td>
    </tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:linear-gradient(135deg,#111,#2a2a2a);padding:28px;text-align:center">
      <img src="${LOGO_URL}" alt="Genesis" style="max-height:64px;display:inline-block" />
    </div>
    <div style="padding:32px 28px">
      <h1 style="margin:0 0 8px;color:#111;font-size:24px">¡Gracias por tu compra, ${name}! 🎉</h1>
      <p style="margin:0 0 20px;color:#444;font-size:15px;line-height:1.5">
        Recibimos tu pedido <strong>#${orderNumber}</strong>. Ya estamos preparando todo para enviártelo. Te avisaremos por mail cuando salga con el código de seguimiento.
      </p>
      <div style="background:#fff8ec;border:1px solid #f5d99a;border-radius:10px;padding:14px 16px;margin:0 0 24px;color:#7a5a10;font-size:14px">
        📦 La tienda está preparando tu pedido.
      </div>
      <h3 style="margin:0 0 8px;color:#111;font-size:16px">Detalle del pedido</h3>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 16px">
        ${itemsHtml}
        <tr>
          <td colspan="2" style="padding:14px 8px;color:#111;font-weight:700;font-size:15px">Total</td>
          <td style="padding:14px 8px;color:#111;font-weight:700;font-size:15px;text-align:right">${money(total)}</td>
        </tr>
      </table>
      <p style="color:#666;font-size:13px;margin:24px 0 0">Si tenés alguna duda, respondé a este mail o escribinos por WhatsApp.</p>
    </div>
    <div style="background:#111;color:#bbb;padding:18px;text-align:center;font-size:12px">
      Genesis · Olavarría · genesisqr.com
    </div>
  </div>
</body></html>`;
}

export async function sendOrderConfirmation(saleId: string, overrideEmail?: string): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const [sale] = await db
    .select({ orderNumber: sales.orderNumber, total: sales.total, customerName: customers.name, customerEmail: customers.email })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(eq(sales.id, saleId))
    .limit(1);
  if (!sale) return { ok: false, error: "Sale not found" };

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));

  const productIds = items.map((it) => it.productId).filter((id): id is string => !!id);
  const imgMap = new Map<string, string>();
  if (productIds.length) {
    const imgs = await db.select().from(productImages).where(inArray(productImages.productId, productIds)).orderBy(asc(productImages.sortOrder));
    for (const row of imgs) {
      if (!imgMap.has(row.productId)) imgMap.set(row.productId, row.url);
    }
  }

  const lineItems = items.map((it) => ({
    name: it.productName,
    qty: it.quantity,
    price: Number(it.unitPrice),
    image: it.productId ? (imgMap.get(it.productId) ?? null) : null,
  }));

  const email = overrideEmail || sale.customerEmail;
  const name = sale.customerName ?? "Cliente";
  if (!email) return { ok: false, error: "no email" };

  const html = renderHtml({ name, orderNumber: sale.orderNumber, total: Number(sale.total), items: lineItems });

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [email],
    subject: `Gracias por tu compra #${sale.orderNumber} 🎉`,
    html,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id ?? null };
}
