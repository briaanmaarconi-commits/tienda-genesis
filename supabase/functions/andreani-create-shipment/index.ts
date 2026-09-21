// Stub para generación de etiquetas con la API oficial Andreani B2B.
// Inactivo hasta que se carguen los secrets ANDREANI_USER y ANDREANI_PASS.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const BodySchema = z.object({ sale_id: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Validar admin
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claims } = await supabase.auth.getClaims(token);
  if (!claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const user = Deno.env.get('ANDREANI_USER');
  const pass = Deno.env.get('ANDREANI_PASS');
  const cliente = Deno.env.get('ANDREANI_CLIENTE');
  const contrato = Deno.env.get('ANDREANI_CONTRATO');

  if (!user || !pass || !cliente || !contrato) {
    return new Response(JSON.stringify({
      error: 'Andreani API no configurada',
      message: 'Para generar etiquetas necesitás una cuenta empresa de Andreani. Solicitala en andreani.com/empresas y cargá los secrets ANDREANI_USER, ANDREANI_PASS, ANDREANI_CLIENTE y ANDREANI_CONTRATO.',
      configured: false,
    }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'sale_id inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // TODO: Implementar llamada real a https://apisqa.andreani.com/v1/Ordenes-de-envio
  // cuando estén las credenciales reales. Por ahora devolvemos placeholder.
  return new Response(JSON.stringify({
    configured: true,
    message: 'Integración pendiente de implementación. Las credenciales están cargadas pero el flujo de creación de orden aún no fue activado.',
  }), { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
