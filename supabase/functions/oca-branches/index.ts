// Sucursales OCA cercanas a un CP. Devuelve lista normalizada.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BodySchema = z.object({ postal_code: z.string().min(4).max(8) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const cp = parsed.data.postal_code;

    const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCentrosImposicionPorCP xmlns="Oca.E_Pak.Negocio.Vip">
      <CodigoPostal>${cp}</CodigoPostal>
    </GetCentrosImposicionPorCP>
  </soap:Body>
</soap:Envelope>`;

    const res = await fetch('http://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'Oca.E_Pak.Negocio.Vip/GetCentrosImposicionPorCP',
      },
      body: soap,
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ branches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const xml = await res.text();
    const rows = [...xml.matchAll(/<Table>([\s\S]*?)<\/Table>/g)];
    const branches = rows.map((m) => {
      const block = m[1];
      const get = (k: string) => (block.match(new RegExp(`<${k}>([^<]*)<\/${k}>`, 'i'))?.[1] ?? '').trim();
      return {
        id: get('IdCentroImposicion') || get('Sucursal') || get('Sigla'),
        name: get('Sucursal') || get('Sigla'),
        address: [get('Calle'), get('Numero'), get('Localidad')].filter(Boolean).join(' '),
        postal_code: get('CodigoPostal'),
      };
    }).filter((b) => b.id && b.name);

    return new Response(JSON.stringify({ branches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ branches: [], error: String((e as Error)?.message ?? e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
