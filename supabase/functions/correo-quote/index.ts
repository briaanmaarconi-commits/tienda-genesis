// Cotizador público Correo Argentino (Clásico).
// Usa el endpoint público del sitio correoargentino.com.ar/MicroSitios/calculadorDeEnvios
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  postal_code_origin: z.string().min(4).max(8),
  postal_code_destination: z.string().min(4).max(8),
  weight_kg: z.number().positive().max(50),
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
    const weightGr = Math.round(p.weight_kg * 1000);

    const url = `https://www.correoargentino.com.ar/MicroSitios/calculadorDeEnvios/calcularPrecio?cpOrigen=${p.postal_code_origin}&cpDestino=${p.postal_code_destination}&peso=${weightGr}&largo=20&ancho=20&alto=20&valorDeclarado=${p.declared_value}`;

    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Correo Argentino no disponible', status: res.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json().catch(() => null);
    // Buscamos servicio "Clásico domicilio" o "Sucursal" según delivery_type
    const services: any[] = Array.isArray(data?.paqarClasico) ? data.paqarClasico :
                            Array.isArray(data?.servicios) ? data.servicios :
                            Array.isArray(data) ? data : [];

    const wantSucursal = p.delivery_type === 'sucursal';
    let pick = services.find((s) => {
      const n = String(s?.nombre ?? s?.servicio ?? '').toLowerCase();
      return wantSucursal ? n.includes('sucursal') : (n.includes('domicilio') || n.includes('clasico') || n.includes('clásico'));
    }) ?? services[0];

    const cost = Number(pick?.aDestino ?? pick?.precio ?? pick?.total ?? 0);
    const estimatedDays = pick?.plazoEntrega ?? pick?.plazo ?? null;

    if (!cost) {
      return new Response(JSON.stringify({ error: 'Sin tarifa', raw: data }), {
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
