// Cotizador público de Andreani (no requiere credenciales)
// Usa el endpoint del sitio andreani.com que cotiza envíos al consumidor final.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  postal_code_origin: z.string().min(4).max(8),
  postal_code_destination: z.string().min(4).max(8),
  weight_kg: z.number().positive().max(50),
  length_cm: z.number().positive().max(200).default(20),
  width_cm: z.number().positive().max(200).default(20),
  height_cm: z.number().positive().max(200).default(20),
  declared_value: z.number().nonnegative().default(1000),
  delivery_type: z.enum(['domicilio', 'sucursal']).default('domicilio'),
});

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

    // Endpoint público de cotización de Andreani.
    // Estructura observada del cotizador del sitio andreani.com
    const url = 'https://cotizador-api.andreani.com/v1/Tarifas';
    const body = {
      cpOrigen: p.postal_code_origin,
      cpDestino: p.postal_code_destination,
      contrato: p.delivery_type === 'sucursal'
        ? '400006611' // Estándar a sucursal (público)
        : '400006610', // Estándar a domicilio (público)
      cliente: '',
      bultos: [{
        kilos: p.weight_kg,
        largoCm: p.length_cm,
        anchoCm: p.width_cm,
        altoCm: p.height_cm,
        valorDeclarado: p.declared_value,
        volumenCm: p.length_cm * p.width_cm * p.height_cm,
      }],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({
        error: 'No se pudo cotizar con Andreani',
        status: res.status,
        detail: txt.slice(0, 500),
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();
    // Normalizamos la respuesta
    const cost = Number(data?.tarifaConIva?.total ?? data?.tarifa?.total ?? data?.total ?? 0);
    const estimatedDays = data?.plazoEntrega ?? data?.tiempoDeEntrega ?? null;

    return new Response(JSON.stringify({
      cost,
      currency: 'ARS',
      estimated_days: estimatedDays,
      delivery_type: p.delivery_type,
      raw: data,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
