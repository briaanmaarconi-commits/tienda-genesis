import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Genesis QR <ventas@genesisqr.com>';
const LOGO_URL = 'https://ezvbqnpahgelmqvefqsw.supabase.co/storage/v1/object/public/branding/b8bb278e-fd8a-46c7-8a1e-6c880ec0f42f.png';

const money = (n: number) => `$${Number(n || 0).toLocaleString('es-AR')}`;

function renderHtml(opts: {
  name: string;
  orderNumber: string | number;
  total: number;
  items: Array<{ name: string; qty: number; price: number; image?: string | null }>;
}) {
  const { name, orderNumber, total, items } = opts;
  const itemsHtml = items.map(it => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;width:72px">
        ${it.image ? `<img src="${it.image}" width="64" height="64" style="border-radius:8px;object-fit:cover;display:block" />` : ''}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;color:#111;font-size:14px">
        <div style="font-weight:600">${it.name}</div>
        <div style="color:#666;font-size:12px">Cantidad: ${it.qty}</div>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;color:#111;font-size:14px;text-align:right;white-space:nowrap">
        ${money(it.price * it.qty)}
      </td>
    </tr>`).join('');

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API keys' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { sale_id, override_email } = await req.json();
    if (!sale_id) return new Response(JSON.stringify({ error: 'sale_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: sale, error } = await supabase
      .from('sales')
      .select('order_number, total, customer:customers(name,email), items:sale_items(product_id,product_name,quantity,unit_price)')
      .eq('id', sale_id)
      .single();
    if (error || !sale) return new Response(JSON.stringify({ error: error?.message ?? 'Sale not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const productIds = (sale.items as any[]).map(i => i.product_id).filter(Boolean);
    const imgMap = new Map<string, string>();
    if (productIds.length) {
      const { data: imgs } = await supabase
        .from('product_images')
        .select('product_id,url,sort_order')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true });
      for (const r of (imgs ?? []) as any[]) {
        if (!imgMap.has(r.product_id)) imgMap.set(r.product_id, r.url);
      }
    }

    const items = (sale.items as any[]).map(it => ({
      name: it.product_name,
      qty: it.quantity,
      price: Number(it.unit_price),
      image: it.product_id ? imgMap.get(it.product_id) ?? null : null,
    }));

    const email = override_email || (sale.customer as any)?.email;
    const name = (sale.customer as any)?.name ?? 'Cliente';
    if (!email) return new Response(JSON.stringify({ error: 'no email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const html = renderHtml({ name, orderNumber: sale.order_number, total: Number(sale.total), items });

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': RESEND_API_KEY },
      body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: `Gracias por tu compra #${sale.order_number} 🎉`, html }),
    });
    const body = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: 'Resend error', details: body }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true, id: body.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
