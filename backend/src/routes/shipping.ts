import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import correoBranchesData from "../data/correo-branches.json" with { type: "json" };

// Ports of the shipping edge functions. Everything here is unauthenticated
// public HTTP/SOAP, no DB. `correo-quote` and OCA are confirmed dead code
// (no shipping_methods row uses their provider) but ported anyway for
// frontend parity — `andreani-create-shipment` (label generation) is the
// only one explicitly out of scope, per prior user decision.

const QuoteBody = z.object({
  postal_code_origin: z.string().min(4).max(8),
  postal_code_destination: z.string().min(4).max(8),
  weight_kg: z.number().positive().max(50),
  declared_value: z.number().nonnegative().default(1000),
  delivery_type: z.enum(["domicilio", "sucursal"]).default("domicilio"),
});

const AndreaniQuoteBody = QuoteBody.extend({
  length_cm: z.number().positive().max(200).default(20),
  width_cm: z.number().positive().max(200).default(20),
  height_cm: z.number().positive().max(200).default(20),
});

const PostalCodeQuery = z.object({ postal_code: z.string().min(4).max(8) });

const ANDREANI_TIPO_DE_ENVIO_ID = "9c16612c-a916-48cf-9fbb-dbad2b097e9e";
const OCA_PUBLIC_CUIT = "30708001606";
const OCA_PUBLIC_OP = "0224";

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
const CORREO_BRANCHES = correoBranchesData as CorreoBranch[];

export async function registerShippingRoutes(app: FastifyInstance) {
  app.post("/api/shipping/andreani/quote", async (req, reply) => {
    const parsed = AndreaniQuoteBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const p = parsed.data;

    const res = await fetch("https://www.andreani.com/api/cotizador/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        codigoPostalOrigen: p.postal_code_origin,
        codigoPostalDestino: p.postal_code_destination,
        tipoDeEnvioId: ANDREANI_TIPO_DE_ENVIO_ID,
        bultos: [
          {
            itemId: randomUUID(),
            altoCm: String(p.height_cm),
            anchoCm: String(p.width_cm),
            largoCm: String(p.length_cm),
            peso: String(Math.round(p.weight_kg * 1000)),
            unidad: "grs",
            valorDeclarado: String(Math.round(p.declared_value)),
          },
        ],
      }),
    });

    if (!res.ok) {
      reply.code(502).send({ error: "No se pudo cotizar con Andreani", status: res.status, detail: (await res.text()).slice(0, 500) });
      return;
    }

    const data = (await res.json()) as Array<{ type: string; price: number }>;
    const wantType = p.delivery_type === "sucursal" ? "branch" : "home";
    const match = Array.isArray(data) ? data.find((d) => d?.type === wantType) : null;
    const cost = Number(match?.price ?? 0);

    if (!cost) {
      reply.code(404).send({ error: "Sin tarifa disponible", raw: data });
      return;
    }
    return { cost, currency: "ARS", estimated_days: null, delivery_type: p.delivery_type };
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/shipping/andreani/branches",
    handler: async (req, reply) => {
      const raw = req.method === "GET" ? (req.query as Record<string, unknown>) : ((req.body as Record<string, unknown>) ?? {});
      const parsed = PostalCodeQuery.safeParse({ postal_code: raw.postal_code ?? raw.cp });
      if (!parsed.success) {
        reply.code(400).send({ error: "postal_code requerido" });
        return;
      }
      const cp = parsed.data.postal_code;

      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cp)}&country=Argentina&format=json&limit=1`,
        { headers: { "User-Agent": "TiendaGenesisShipping/1.0 (contacto@genesisqr.com)" } },
      );
      if (!geoRes.ok) {
        reply.code(502).send({ error: "No se pudo geolocalizar el código postal" });
        return;
      }
      const geoData = (await geoRes.json()) as Array<{ lat?: string; lon?: string }>;
      const geo = Array.isArray(geoData) ? geoData[0] : null;
      if (!geo?.lat || !geo?.lon) return { branches: [] };

      const res = await fetch(`https://www.andreani.com/api/sucursales/byCoordenadas?lat=${geo.lat}&lng=${geo.lon}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        reply.code(502).send({ error: "No se pudieron obtener sucursales", status: res.status });
        return;
      }
      const data = (await res.json()) as Array<Record<string, unknown>>;
      const branches = (Array.isArray(data) ? data : []).map((s) => ({
        id: String(s.id ?? s.idSucursal ?? ""),
        name: (s.descripcion as string) ?? "",
        address: (s.direccionSucursal as string) ?? "",
        locality: "",
        province: "",
        hours: (s.horarioDeAtencion as string) ?? "",
      }));
      return { branches };
    },
  });

  app.post("/api/shipping/oca/quote", async (req, reply) => {
    const parsed = QuoteBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const p = parsed.data;

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
      <Cuit>${OCA_PUBLIC_CUIT}</Cuit>
      <Operativa>${OCA_PUBLIC_OP}</Operativa>
    </Tarifar_Envio_Corporativo>
  </soap:Body>
</soap:Envelope>`;

    const res = await fetch("http://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "Oca.E_Pak.Negocio.Vip/Tarifar_Envio_Corporativo",
      },
      body: soapBody,
    });

    if (!res.ok) {
      reply.code(502).send({ error: "OCA no disponible", status: res.status });
      return;
    }

    const xml = await res.text();
    const totalMatch = xml.match(/<Total>([^<]+)<\/Total>/i);
    const plazoMatch = xml.match(/<PlazoEntrega>([^<]+)<\/PlazoEntrega>/i);
    const cost = totalMatch ? Number(String(totalMatch[1]).replace(",", ".")) : 0;
    const estimatedDays = plazoMatch ? Number(plazoMatch[1]) : null;

    if (!cost || Number.isNaN(cost)) {
      reply.code(404).send({ error: "Sin tarifa", detail: xml.slice(0, 300) });
      return;
    }
    return { cost, currency: "ARS", estimated_days: estimatedDays, delivery_type: p.delivery_type };
  });

  app.post("/api/shipping/oca/branches", async (req, reply) => {
    const parsed = PostalCodeQuery.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
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

    const res = await fetch("http://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "Oca.E_Pak.Negocio.Vip/GetCentrosImposicionPorCP",
      },
      body: soap,
    });

    if (!res.ok) return { branches: [] };

    const xml = await res.text();
    const rows = [...xml.matchAll(/<Table>([\s\S]*?)<\/Table>/g)];
    const branches = rows
      .map((m) => {
        const block = m[1];
        const get = (k: string) => (block.match(new RegExp(`<${k}>([^<]*)<\/${k}>`, "i"))?.[1] ?? "").trim();
        return {
          id: get("IdCentroImposicion") || get("Sucursal") || get("Sigla"),
          name: get("Sucursal") || get("Sigla"),
          address: [get("Calle"), get("Numero"), get("Localidad")].filter(Boolean).join(" "),
          postal_code: get("CodigoPostal"),
        };
      })
      .filter((b) => b.id && b.name);

    return { branches };
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/shipping/correo/branches",
    handler: async (req) => {
      const raw = req.method === "GET" ? (req.query as Record<string, unknown>) : ((req.body as Record<string, unknown>) ?? {});
      const cp = normalizeCP(String(raw.postal_code ?? raw.cp ?? raw.codigoPostal ?? ""));
      if (cp.length < 4) return { branches: [] };

      let matches = CORREO_BRANCHES.filter((s) => s.postal_code === cp);

      if (matches.length === 0) {
        const requestedProvince = normalizeText(String(raw.province ?? ""));
        const cpNumber = Number(cp);
        const provinceMatches = requestedProvince
          ? CORREO_BRANCHES.filter((s) => normalizeText(s.province) === requestedProvince)
          : CORREO_BRANCHES;
        matches = provinceMatches
          .map((s) => ({ branch: s, distance: Math.abs(Number(s.postal_code) - cpNumber) }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10)
          .map((x) => x.branch);
      }

      const branches = matches
        .map(formatCorreoBranch)
        .sort((a, b) => normalizeText(a.locality).localeCompare(normalizeText(b.locality)) || a.name.localeCompare(b.name));

      return { branches };
    },
  });

  app.post("/api/shipping/correo/quote", async (req, reply) => {
    const parsed = QuoteBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const p = parsed.data;
    const weightGr = Math.round(p.weight_kg * 1000);

    const url = `https://www.correoargentino.com.ar/MicroSitios/calculadorDeEnvios/calcularPrecio?cpOrigen=${p.postal_code_origin}&cpDestino=${p.postal_code_destination}&peso=${weightGr}&largo=20&ancho=20&alto=20&valorDeclarado=${p.declared_value}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      reply.code(502).send({ error: "Correo Argentino no disponible", status: res.status });
      return;
    }

    const data = await res.json().catch(() => null);
    type CorreoService = { nombre?: string; servicio?: string; aDestino?: number; precio?: number; total?: number; plazoEntrega?: unknown; plazo?: unknown };
    const services: CorreoService[] = Array.isArray(data?.paqarClasico) ? data.paqarClasico : Array.isArray(data?.servicios) ? data.servicios : Array.isArray(data) ? data : [];

    const wantSucursal = p.delivery_type === "sucursal";
    const pick =
      services.find((s) => {
        const n = String(s?.nombre ?? s?.servicio ?? "").toLowerCase();
        return wantSucursal ? n.includes("sucursal") : n.includes("domicilio") || n.includes("clasico") || n.includes("clásico");
      }) ?? services[0];

    const cost = Number(pick?.aDestino ?? pick?.precio ?? pick?.total ?? 0);
    const estimatedDays = pick?.plazoEntrega ?? pick?.plazo ?? null;

    if (!cost) {
      reply.code(404).send({ error: "Sin tarifa", raw: data });
      return;
    }

    return { cost, currency: "ARS", estimated_days: estimatedDays, delivery_type: p.delivery_type };
  });
}

const normalizeCP = (value: string) => value.replace(/\D/g, "").slice(0, 4);

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

const formatCorreoBranch = (s: CorreoBranch) => ({
  id: s.id,
  name: `Correo Argentino - ${s.name}`,
  address: [s.street, s.number].filter(Boolean).join(" "),
  postal_code: s.postal_code,
  locality: s.locality,
  province: s.province,
  cpa: s.cpa,
});
