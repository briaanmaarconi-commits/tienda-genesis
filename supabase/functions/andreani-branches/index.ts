// Lista de sucursales Andreani cercanas a un código postal (endpoint público)
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
    const apiUrl = `https://envios.andreani.com/api/v1/Sucursales?codigoPostal=${encodeURIComponent(cp)}`;
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'No se pudieron obtener sucursales', status: res.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const branches = (Array.isArray(data) ? data : data?.sucursales ?? []).map((s: any) => ({
      id: String(s.id ?? s.codigo ?? s.sucursalId ?? ''),
      name: s.descripcion ?? s.nombre ?? '',
      address: s.direccion ?? s.calle ?? '',
      locality: s.localidad ?? '',
      province: s.provincia ?? '',
      hours: s.horarioAtencion ?? s.horario ?? '',
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
