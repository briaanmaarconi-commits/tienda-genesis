// Lista de sucursales del Correo Argentino por CP.
//
// El buscador público de Correo Argentino no expone una búsqueda directa y
// estable por CP: primero pide provincia/localidad y después devuelve HTML.
// Para que el checkout funcione como Empretienda, usamos una base local de
// sucursales y filtramos por código postal.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import branchesData from './branches.json' with { type: 'json' };

const BodySchema = z.object({
  postal_code: z.string().min(4).max(8).optional(),
  cp: z.string().min(4).max(8).optional(),
  codigoPostal: z.string().min(4).max(8).optional(),
  province: z.string().optional(),
});

type CorreoBranch = {
  id: string;
  name: string;
  street: string;
  number: string;
  cpa: string;
  postal_code: string;
  locality: string;
  province: string;
};

const BRANCHES = branchesData as CorreoBranch[];

const normalizeCP = (value: string) => value.replace(/\D/g, '').slice(0, 4);

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const formatBranch = (s: CorreoBranch) => ({
  id: s.id,
  name: `Correo Argentino - ${s.name}`,
  address: [s.street, s.number].filter(Boolean).join(' '),
  postal_code: s.postal_code,
  locality: s.locality,
  province: s.province,
  cpa: s.cpa,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse({
      postal_code: url.searchParams.get('postal_code') ?? body.postal_code,
      cp: url.searchParams.get('cp') ?? body.cp,
      codigoPostal: url.searchParams.get('codigoPostal') ?? body.codigoPostal,
      province: url.searchParams.get('province') ?? body.province,
    });

    if (!parsed.success) {
      return new Response(JSON.stringify({ branches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cp = normalizeCP(parsed.data.postal_code ?? parsed.data.cp ?? parsed.data.codigoPostal ?? '');
    if (cp.length < 4) {
      return new Response(JSON.stringify({ branches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let matches = BRANCHES.filter((s) => s.postal_code === cp);

    // Si el CP no tiene sucursal exacta, devolvemos algunas opciones cercanas
    // de la misma provincia para que el cliente no quede bloqueado.
    if (matches.length === 0) {
      const requestedProvince = normalizeText(parsed.data.province ?? '');
      const cpNumber = Number(cp);
      const provinceMatches = requestedProvince
        ? BRANCHES.filter((s) => normalizeText(s.province) === requestedProvince)
        : BRANCHES;
      matches = provinceMatches
        .map((s) => ({ branch: s, distance: Math.abs(Number(s.postal_code) - cpNumber) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)
        .map((x) => x.branch);
    }

    const branches = matches
      .map(formatBranch)
      .sort((a, b) => normalizeText(a.locality).localeCompare(normalizeText(b.locality)) || a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ branches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ branches: [], error: String((e as Error)?.message ?? e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
