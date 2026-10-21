import { env } from "../env.js";

// Correo Argentino "API PAQ.AR 2.0": creates the order (returns the tracking
// number), prints the label (PDF) and reads the tracking history.
// Auth: `Authorization: Apikey <key>` + `agreement: <id>` on every call.
const HOSTS = {
  prod: "https://api.correoargentino.com.ar/paqar/v1",
  test: "https://apitest.correoargentino.com.ar/paqar/v1",
} as const;

export const paqarConfigured = () => Boolean(env.PAQAR_AGREEMENT && env.PAQAR_API_KEY);
/** PAQ.AR order creation is opt-in (PAQAR_CREATE_ORDERS=true) until Correo enables the account for it. */
export const paqarCanCreateOrders = () => paqarConfigured() && env.PAQAR_CREATE_ORDERS;

export class PaqarError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
  }
}

type Req = { method: "GET" | "POST" | "PATCH"; path: string; query?: Record<string, string>; body?: unknown };

const headers = (hasBody: boolean) => ({
  Authorization: `Apikey ${env.PAQAR_API_KEY}`,
  agreement: env.PAQAR_AGREEMENT,
  Accept: "application/json",
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
});

async function call<T>(req: Req): Promise<T> {
  const url = new URL(`${HOSTS[env.PAQAR_ENV]}${req.path}`);
  for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers: headers(req.body !== undefined),
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw new PaqarError("Correo Argentino no respondió a tiempo", 504, String(err));
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const message = (typeof data === "object" && data ? data.message || data.error : null) || `Correo Argentino respondió ${res.status}`;
    throw new PaqarError(String(message), res.status, data);
  }
  return data as T;
}

/** 204 = credentials valid for the configured environment. */
export async function checkAuth(): Promise<{ ok: boolean; status: number; message?: string }> {
  try {
    await call<null>({ method: "GET", path: "/auth" });
    return { ok: true, status: 204 };
  } catch (err) {
    return err instanceof PaqarError ? { ok: false, status: err.status, message: err.message } : { ok: false, status: 0, message: String(err) };
  }
}

export type PaqarParty = {
  name?: string; // recipients only: SenderData rejects `name` (it uses businessName)
  areaCodePhone?: string; phoneNumber?: string; areaCodeCellphone?: string; cellphoneNumber?: string;
  email?: string; observation?: string;
  address: { streetName: string; streetNumber: string; cityName: string; floor: string; department: string; state: string; zipCode: string };
};

export type PaqarOrder = {
  sellerId?: string;
  trackingNumber?: string;
  order: {
    senderData: PaqarParty & { id?: string; businessName?: string };
    shippingData: PaqarParty;
    parcels: { dimensions: { height: string; width: string; depth: string }; productWeight: string; productCategory: string; declaredValue: string }[];
    deliveryType: "homeDelivery" | "agency" | "locker";
    agencyId: string;
    saleDate: string; // YYYY-MM-DDTHH:mm:ss-03:00
    serviceType: string; // "CP" Clásico, "EP" Expreso
    shipmentClientId?: string;
  };
};

export async function createOrder(p: PaqarOrder): Promise<{ trackingNumber: string; raw: unknown }> {
  const data = await call<any>({ method: "POST", path: "/orders", body: p });
  const trackingNumber = data?.trackingNumber ?? data?.order?.trackingNumber;
  if (!trackingNumber) throw new PaqarError("Correo no devolvió número de seguimiento", 502, data);
  return { trackingNumber: String(trackingNumber), raw: data };
}

/** Label as a PDF buffer (10x15 thermal format by default). */
export async function getLabelPdf(trackingNumber: string, format: "10x15" | "label" | "" = "10x15"): Promise<Buffer> {
  const data = await call<any[]>({
    method: "POST",
    path: "/labels",
    query: format ? { labelFormat: format } : undefined,
    body: [{ sellerId: "", trackingNumber }],
  });
  const item = Array.isArray(data) ? data[0] : null;
  if (!item?.fileBase64) throw new PaqarError(String(item?.result ?? "Correo no devolvió la etiqueta"), 502, data);
  return Buffer.from(item.fileBase64, "base64");
}

export type PaqarEvent = { status: string; statusId?: string; facility?: string; date?: string };

export async function getTracking(trackingNumber: string): Promise<PaqarEvent[]> {
  const data = await call<any[]>({ method: "GET", path: "/tracking", query: { trackingNumbers: trackingNumber, extClient: "" } });
  const item = Array.isArray(data) ? data.find((d) => d?.trackingNumber === trackingNumber) ?? data[0] : null;
  return (item?.event ?? []).map((e: any) => ({ status: e.status, statusId: e.statusId, facility: e.facility, date: e.date }));
}

export async function getAgencies(stateId?: string): Promise<any[]> {
  return call<any[]>({ method: "GET", path: "/agencies", query: { ...(stateId ? { stateId } : {}), pickup_availability: "true" } });
}
