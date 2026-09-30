import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { sales, customers } from "../db/schema.js";

const resend = new Resend(env.RESEND_API_KEY);
const FROM_EMAIL = "Genesis QR <ventas@genesisqr.com>";
const LOGO_URL = "https://ezvbqnpahgelmqvefqsw.supabase.co/storage/v1/object/public/branding/b8bb278e-fd8a-46c7-8a1e-6c880ec0f42f.png";
const CORREO_TRACKING_PAGE = "https://www.correoargentino.com.ar/formularios/e-commerce";

const isCorreo = (c: string) => c.toLowerCase().includes("correo");
const isAndreani = (c: string) => c.toLowerCase().includes("andreani");

export async function sendShippingEmail(saleId: string, overrideEmail?: string): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const [row] = await db
    .select({
      orderNumber: sales.orderNumber,
      trackingCode: sales.trackingCode,
      trackingCarrier: sales.trackingCarrier,
      customerName: customers.name,
      customerEmail: customers.email,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(eq(sales.id, saleId))
    .limit(1);

  if (!row) return { ok: false, error: "Sale not found" };

  const email = overrideEmail || row.customerEmail;
  const name = row.customerName ?? "Cliente";
  const code = row.trackingCode;
  const carrier = row.trackingCarrier ?? "Correo Argentino";
  if (!email) return { ok: false, error: "no email" };
  if (!code) return { ok: false, error: "tracking_code missing" };

  let trackingHtml = "";
  if (isCorreo(carrier)) {
    trackingHtml = `<p style="margin:16px 0 0">Seguí tu envío en el sitio de Correo Argentino con el código de arriba:</p>
      <p style="margin:8px 0 0"><a href="${CORREO_TRACKING_PAGE}" style="background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Seguir envío en Correo Argentino</a></p>`;
  } else if (isAndreani(carrier)) {
    const url = `https://www.andreani.com/#!/informacionEnvio/${encodeURIComponent(code)}`;
    trackingHtml = `<p style="margin:16px 0 0"><a href="${url}" style="background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Seguir envío en Andreani</a></p>`;
  }

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:linear-gradient(135deg,#111,#2a2a2a);padding:28px;text-align:center">
      <img src="${LOGO_URL}" alt="Genesis" style="max-height:64px;display:inline-block" />
    </div>
    <div style="padding:32px 28px">
      <h1 style="margin:0 0 8px;color:#111;font-size:24px">¡Tu pedido fue enviado! 🚚</h1>
      <p style="margin:0 0 20px;color:#444;font-size:15px;line-height:1.5">
        Hola ${name}, te avisamos que tu pedido <strong>#${row.orderNumber}</strong> ya está en camino.
      </p>
      <div style="background:#f4f8ff;border:1px solid #cfe0ff;border-radius:10px;padding:16px 18px;margin:0 0 18px">
        <p style="margin:0;color:#111;font-size:14px"><strong>Transporte:</strong> ${carrier}</p>
        <p style="margin:8px 0 0;color:#111;font-size:14px"><strong>Código de seguimiento:</strong> <span style="font-family:monospace;background:#fff;padding:3px 8px;border-radius:5px;border:1px solid #dde6f5">${code}</span></p>
      </div>
      <div style="background:#ecfdf3;border:1px solid #b8e9c8;border-radius:10px;padding:14px 16px;color:#155724;font-size:14px">
        ⏱️ Tiempo estimado de entrega: <strong>3 a 7 días hábiles</strong>.
      </div>
      ${trackingHtml}
      <p style="color:#666;font-size:13px;margin-top:28px">¡Gracias por confiar en Genesis! 💛</p>
    </div>
    <div style="background:#111;color:#bbb;padding:18px;text-align:center;font-size:12px">
      Genesis · Olavarría · genesisqr.com
    </div>
  </div>
</body></html>`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [email],
    subject: `Tu pedido #${row.orderNumber} fue enviado 🚚`,
    html,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id ?? null };
}
