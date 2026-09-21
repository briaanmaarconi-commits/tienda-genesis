// Cotizador público OCA (e-Pak) sin credenciales.
// Usa el SOAP público Tarifar_Envio_Corporativo del OEP de OCA.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  postal_code_origin: z.string().min(4).max(8),
  postal_code_destination: z.string().min(4).max(8),
  weight_kg: z.number().positive().max(50),
  declared_value: z.number().nonnegative().default(1000),
  delivery_type: z.enum(['domicilio', 'sucursal']).default('domicilio'),
});

// CUIT/operativa de demo pública — pueden cambiar
const PUBLIC_CUIT = '30708001606';
const PUBLIC_OP = '0224';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const p = parsed.data;

    // SOAP envelope
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Tarifar_Envio_Corporativo xmlns="Oca.E_Pak.Negocio.Vip">
      <PesoTotal>${p.weight_kg.toFixed(2)}</PesoTotal>
      <VolumenTotal>0.008</VolumenTotal>
      <CodigoPostalOrigen>${p.postal_code_origin}</CodigoPostalOrigen>
      <CodigoPostalDestino>${p.postal_code_destination}</CodigoPostalDestino>
      <CantidadPaquetes>1</CantidadPaquetes>
      <ValorDeclarado>${p.declared_value}</ValorDeclarado>
      <Cuit>${PUBLIC_CUIT}</Cuit>
      <Operativa>${PUBLIC_OP}</Operativa>
    </Tarifar_Envio_Corporativo>
  </soap:Body>
</soap:Envelope>`;

    const res = await fetch('http://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'Oca.E_Pak.Negocio.Vip/Tarifar_Envio_Corporativo',
      },
      body: soapBody,
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'OCA no disponible', status: res.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const xml = await res.text();
    // Parseo simple del precio: <Total>$valor</Total> y <PlazoEntrega>N</PlazoEntrega>
    const totalMatch = xml.match(/<Total>([^<]+)<\/Total>/i);
    const plazoMatch = xml.match(/<PlazoEntrega>([^<]+)<\/PlazoEntrega>/i);
    const cost = totalMatch ? Number(String(totalMatch[1]).replace(',', '.')) : 0;
    const estimatedDays = plazoMatch ? Number(plazoMatch[1]) : null;

    if (!cost || isNaN(cost)) {
      return new Response(JSON.stringify({ error: 'Sin tarifa', detail: xml.slice(0, 300) }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      cost,
      currency: 'ARS',
      estimated_days: estimatedDays,
      delivery_type: p.delivery_type,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
