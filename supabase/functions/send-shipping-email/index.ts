import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Genesis QR <ventas@genesisqr.com>';
const LOGO_URL = 'https://ezvbqnpahgelmqvefqsw.supabase.co/storage/v1/object/public/branding/b8bb278e-fd8a-46c7-8a1e-6c880ec0f42f.png';
const CORREO_TRACKING_PAGE = 'https://www.correoargentino.com.ar/formularios/e-commerce';

function isCorreo(c: string) { return c.toLowerCase().includes('correo'); }
function isAndreani(c: string) { return c.toLowerCase().includes('andreani'); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API keys' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { sale_id, override_email } = await req.json();
    if (!sale_id) return new Response(JSON.stringify({ error: 'sale_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: sale, error } = await supabase
      .from('sales')
      .select('order_number, tracking_code, tracking_carrier, customer:customers(name,email)')
      .eq('id', sale_id)
      .single();
    if (error || !sale) return new Response(JSON.stringify({ error: error?.message ?? 'Sale not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const email = override_email || (sale.customer as any)?.email;
    const name = (sale.customer as any)?.name ?? 'Cliente';
    const code = sale.tracking_code;
    const carrier = sale.tracking_carrier ?? 'Correo Argentino';
    if (!email) return new Response(JSON.stringify({ error: 'no email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!code) return new Response(JSON.stringify({ error: 'tracking_code missing' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let trackingHtml = '';
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
        Hola ${name}, te avisamos que tu pedido <strong>#${sale.order_number}</strong> ya está en camino.
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

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: `Tu pedido #${sale.order_number} fue enviado 🚚`, html }),
    });
    const body = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: 'Resend error', details: body }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true, id: body.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
