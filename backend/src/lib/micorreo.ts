import { env } from "../env.js";

// Official Correo Argentino "API MiCorreo" client (quotes, branches, shipment
// import). Auth is a JWT obtained with HTTP Basic credentials; the credential
// pair is the same for the test and production hosts.
const BASE_URLS = {
  prod: "https://api.correoargentino.com.ar/micorreo/v1",
  test: "https://apitest.correoargentino.com.ar/micorreo/v1",
} as const;

export const micorreoConfigured = () =>
  Boolean(env.MICORREO_USER && env.MICORREO_PASSWORD && env.MICORREO_CUSTOMER_ID);

const baseUrl = () => BASE_URLS[env.MICORREO_ENV];

export class MiCorreoError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function fetchToken(): Promise<string> {
  const basic = Buffer.from(`${env.MICORREO_USER}:${env.MICORREO_PASSWORD}`).toString("base64");
  const res = await fetch(`${baseUrl()}/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.token) throw new MiCorreoError("MiCorreo: no se pudo autenticar", res.status, data);
  // The docs show `expires`, the live API answers `expire`; accept both and
  // fall back to a short lifetime if the format is unexpected.
  const parsed = Date.parse(String(data.expire ?? data.expires ?? "").replace(" ", "T") + "-03:00");
  const expiresAt = Number.isFinite(parsed) ? parsed : Date.now() + 10 * 60_000;
  cachedToken = { value: data.token as string, expiresAt };
  return cachedToken.value;
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value;
  return fetchToken();
}

async function call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string> }): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken();
    let res: Response;
    try {
      res = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      if (attempt === 0) continue; // timeout / connection reset: one retry
      throw new MiCorreoError("MiCorreo no respondió a tiempo", 504, String(err));
    }
    if (res.status === 401 && attempt === 0) {
      cachedToken = null; // expired/revoked token: re-authenticate once
      continue;
    }
    const data: any = await res.json().catch(() => null);
    if (!res.ok) throw new MiCorreoError(data?.message ?? `MiCorreo respondió ${res.status}`, res.status, data);
    return data as T;
  }
  throw new MiCorreoError("MiCorreo: autenticación rechazada", 401);
}

export type MiCorreoRate = {
  deliveredType: "D" | "S";
  productType: string; // "CP" Clásico, "EP" Expreso
  productName: string;
  price: number;
  deliveryTimeMin?: string;
  deliveryTimeMax?: string;
};

export async function getRates(p: {
  postalCodeOrigin: string;
  postalCodeDestination: string;
  deliveredType?: "D" | "S";
  weightGr: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}): Promise<MiCorreoRate[]> {
  const data = await call<{ rates?: MiCorreoRate[] }>("/rates", {
    method: "POST",
    body: {
      customerId: env.MICORREO_CUSTOMER_ID,
      postalCodeOrigin: p.postalCodeOrigin,
      postalCodeDestination: p.postalCodeDestination,
      ...(p.deliveredType ? { deliveredType: p.deliveredType } : {}),
      dimensions: {
        // API limits: 1–25000 g, up to 150 cm per side, integers only.
        weight: Math.min(25_000, Math.max(1, Math.round(p.weightGr))),
        height: Math.min(150, Math.max(1, Math.round(p.heightCm))),
        width: Math.min(150, Math.max(1, Math.round(p.widthCm))),
        length: Math.min(150, Math.max(1, Math.round(p.lengthCm))),
      },
    },
  });
  return (data.rates ?? []).map((r) => ({ ...r, price: Number(r.price) }));
}

export type MiCorreoImport = {
  extOrderId: string;
  orderNumber: string;
  recipient: { name: string; phone: string; cellPhone: string; email: string };
  shipping: {
    deliveryType: "D" | "S";
    agency: string | null;
    address: { streetName: string; streetNumber: string; floor: string; apartment: string; city: string; provinceCode: string; postalCode: string };
    weight: number;
    declaredValue: number;
    height: number;
    length: number;
    width: number;
  };
};

/** The API answers 402 "La orden ya fue importada con anterioridad." on repeats. */
export const isAlreadyImported = (err: unknown) =>
  err instanceof MiCorreoError && /ya fue importada/i.test(err.message);

export async function importShipment(p: MiCorreoImport): Promise<{ createdAt?: string }> {
  return call<{ createdAt?: string }>("/shipping/import", {
    method: "POST",
    body: { customerId: env.MICORREO_CUSTOMER_ID, ...p },
  });
}
