// Lista de sucursales Andreani cercanas a un código postal.
// El endpoint público de sucursales de Andreani busca por lat/lng, no por CP,
// así que primero geocodificamos el CP con Nominatim (OpenStreetMap, sin API key).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const QuerySchema = z.object({
  postal_code: z.string().min(4).max(8),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method !== 'GET') {
      body = await req.json().catch(() => ({}));
    }
    const parsed = QuerySchema.safeParse({
      postal_code: url.searchParams.get('postal_code') ?? body.postal_code ?? body.cp,
    });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'postal_code requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cp = parsed.data.postal_code;

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cp)}&country=Argentina&format=json&limit=1`,
      { headers: { 'User-Agent': 'TiendaGenesisShipping/1.0 (contacto@genesisqr.com)' } }
    );
    if (!geoRes.ok) {
      return new Response(JSON.stringify({ error: 'No se pudo geolocalizar el código postal' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const geoData = await geoRes.json();
    const geo = Array.isArray(geoData) ? geoData[0] : null;
    if (!geo?.lat || !geo?.lon) {
      return new Response(JSON.stringify({ branches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiUrl = `https://www.andreani.com/api/sucursales/byCoordenadas?lat=${geo.lat}&lng=${geo.lon}`;
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'No se pudieron obtener sucursales', status: res.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const branches = (Array.isArray(data) ? data : []).map((s: any) => ({
      id: String(s.id ?? s.idSucursal ?? ''),
      name: s.descripcion ?? '',
      address: s.direccionSucursal ?? '',
      locality: '',
      province: '',
      hours: s.horarioDeAtencion ?? '',
    }));

    return new Response(JSON.stringify({ branches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
