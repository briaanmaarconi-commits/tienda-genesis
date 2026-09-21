// Cotizador público de Andreani (no requiere credenciales)
// Usa el endpoint que usa el propio cotizador público en andreani.com/?tab=cotizar-envio
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

// ID del tipo de envío "Paquetería" tal como lo usa el cotizador público de
// andreani.com. Es un valor fijo del formulario público, no ligado a ninguna
// cuenta ni credencial.
const TIPO_DE_ENVIO_ID = '9c16612c-a916-48cf-9fbb-dbad2b097e9e';

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

    const url = 'https://www.andreani.com/api/cotizador/prices';
    const body = {
      codigoPostalOrigen: p.postal_code_origin,
      codigoPostalDestino: p.postal_code_destination,
      tipoDeEnvioId: TIPO_DE_ENVIO_ID,
      bultos: [{
        itemId: crypto.randomUUID(),
        altoCm: String(p.height_cm),
        anchoCm: String(p.width_cm),
        largoCm: String(p.length_cm),
        peso: String(Math.round(p.weight_kg * 1000)),
        unidad: 'grs',
        valorDeclarado: String(Math.round(p.declared_value)),
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
    // Respuesta: [{"type":"branch","price":N},{"type":"home","price":N}]
    const wantType = p.delivery_type === 'sucursal' ? 'branch' : 'home';
    const match = Array.isArray(data) ? data.find((d: any) => d?.type === wantType) : null;
    const cost = Number(match?.price ?? 0);

    if (!cost) {
      return new Response(JSON.stringify({ error: 'Sin tarifa disponible', raw: data }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      cost,
      currency: 'ARS',
      estimated_days: null,
      delivery_type: p.delivery_type,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
