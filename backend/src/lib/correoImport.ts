import { and, eq, isNull, or } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { customers, products, saleItems, sales, shippingMethods, siteSettings } from "../db/schema.js";
import { env } from "../env.js";
import { provinceCodeFor, splitStreetAddress, type StreetParts } from "./argAddress.js";
import { importShipment, isAlreadyImported, micorreoConfigured, type MiCorreoImport } from "./micorreo.js";
import { createOrder, paqarCanCreateOrders, type PaqarOrder } from "./paqar.js";

// Hands a paid order over to Correo Argentino. Two backends, picked automatically:
//  - PAQ.AR API (when the sender id is configured): creates the order, returns the
//    tracking number (saved on the sale) and enables label printing + tracking here.
//  - API MiCorreo (otherwise): imports the shipment into the MiCorreo account, where the
//    label is printed by hand.
// Only orders whose shipping method uses the "correo" provider are touched.

const DEFAULT_DIM_CM = 20;
const DEFAULT_WEIGHT_KG = 0.5;

export type ImportResult =
  | { status: "importado"; via: "paqar" | "micorreo"; tracking_code?: string }
  | { status: "preview"; via: "paqar" | "micorreo"; payload: unknown }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

class BuildError extends Error {}

const digits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

type SaleData = {
  orderNumber: number;
  name: string;
  phone: string;
  email: string;
  isBranch: boolean;
  branchId: string | null;
  branchName: string | null;
  postalCode: string;
  provinceCode: string;
  city: string;
  street: StreetParts;
  weightGr: number;
  heightCm: number;
  lengthCm: number;
  widthCm: number;
  declared: number;
  express: boolean;
  trackingCode: string | null;
};

async function loadSaleData(saleId: string): Promise<SaleData | "not_applicable"> {
  const [row] = await db
    .select({ sale: sales, customer: customers, method: shippingMethods })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(shippingMethods, eq(sales.shippingMethodId, shippingMethods.id))
    .where(eq(sales.id, saleId))
    .limit(1);
  if (!row) throw new BuildError("Venta inexistente");
  const { sale, customer, method } = row;
  if (method?.provider !== "correo") return "not_applicable";
  if (!customer) throw new BuildError("La venta no tiene cliente");

  const isBranch = method.deliveryType === "sucursal";
  if (isBranch && !sale.shippingBranchId) throw new BuildError("Falta la sucursal de destino");
  if (!sale.shippingPostalCode) throw new BuildError("Falta el código postal de destino");

  // Province: the branch code starts with the province letter; for home delivery map the name.
  const provinceCode = isBranch ? sale.shippingBranchId!.charAt(0).toUpperCase() : provinceCodeFor(sale.shippingProvince);
  if (!provinceCode || !/^[A-Z]$/.test(provinceCode)) throw new BuildError(`Provincia no reconocida: ${sale.shippingProvince ?? "(vacía)"}`);

  if (!isBranch && !customer.address?.trim()) throw new BuildError("Falta la dirección de entrega");
  const street = splitStreetAddress(isBranch ? sale.shippingBranchName : customer.address);

  // Correo requires a recipient e-mail; fall back to the store's own address when the
  // customer didn't leave one (Correo's notices then reach the store).
  let email = customer.email?.trim() || "";
  if (!email) {
    const [st] = await db.select({ email: siteSettings.email, notify: siteSettings.adminNotifyEmail }).from(siteSettings).limit(1);
    email = st?.email?.trim() || st?.notify?.trim() || "";
  }
  if (!email) throw new BuildError("Falta el email del destinatario");

  const items = await db
    .select({ qty: saleItems.quantity, weight: products.weightKg, length: products.lengthCm, width: products.widthCm, height: products.heightCm })
    .from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, saleId));
  if (!items.length) throw new BuildError("La venta no tiene productos");

  const weightKg = items.reduce((acc, it) => acc + (Number(it.weight) || DEFAULT_WEIGHT_KG) * (it.qty || 1), 0);
  const maxDim = (pick: (it: (typeof items)[number]) => unknown) =>
    Math.min(150, Math.max(DEFAULT_DIM_CM, ...items.map((it) => Math.ceil(Number(pick(it)) || 0))));

  return {
    orderNumber: sale.orderNumber,
    name: customer.name.trim().slice(0, 60),
    phone: digits(customer.phone),
    email,
    isBranch,
    branchId: sale.shippingBranchId,
    branchName: sale.shippingBranchName,
    postalCode: digits(sale.shippingPostalCode).slice(0, 4),
    provinceCode,
    city: (sale.shippingLocality?.trim() || sale.shippingProvince || "").slice(0, 60),
    street,
    weightGr: Math.min(25_000, Math.max(1, Math.round(weightKg * 1000))),
    heightCm: maxDim((it) => it.height),
    lengthCm: maxDim((it) => it.length),
    widthCm: maxDim((it) => it.width),
    declared: Math.round(Math.max(1, Number(sale.subtotal) - Number(sale.discountAmount || 0)) * 100) / 100,
    express: /expres/i.test(`${method.tipo ?? ""} ${method.name ?? ""}`),
    trackingCode: sale.trackingCode,
  };
}

function toMiCorreo(d: SaleData): MiCorreoImport {
  return {
    extOrderId: String(d.orderNumber),
    orderNumber: String(d.orderNumber),
    recipient: { name: d.name, phone: d.phone, cellPhone: d.phone, email: d.email },
    shipping: {
      deliveryType: d.isBranch ? "S" : "D",
      agency: d.isBranch ? d.branchId : null,
      address: {
        streetName: d.street.streetName.slice(0, 60),
        streetNumber: d.street.streetNumber.slice(0, 10),
        floor: d.street.floor,
        apartment: d.street.apartment,
        city: d.city,
        provinceCode: d.provinceCode,
        postalCode: d.postalCode,
      },
      weight: d.weightGr,
      declaredValue: d.declared,
      height: d.heightCm,
      length: d.lengthCm,
      width: d.widthCm,
    },
  };
}

/** "2026-10-21T15:00:00-03:00" in Argentina time, as PAQ.AR requires. */
function argentinaTimestamp(date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-03:00`;
}

function toPaqar(d: SaleData): PaqarOrder {
  return {
    sellerId: env.PAQAR_AGREEMENT,
    order: {
      senderData: {
        ...(env.PAQAR_SENDER_ID ? { id: env.PAQAR_SENDER_ID } : {}),
        businessName: env.PAQAR_SENDER_NAME,
        address: {
          streetName: env.PAQAR_SENDER_STREET,
          streetNumber: env.PAQAR_SENDER_NUMBER,
          cityName: env.PAQAR_SENDER_CITY,
          floor: "",
          department: "",
          state: env.PAQAR_SENDER_STATE,
          zipCode: env.PAQAR_SENDER_ZIP,
        },
      },
      shippingData: {
        name: d.name,
        cellphoneNumber: d.phone,
        email: d.email,
        address: {
          streetName: d.street.streetName.slice(0, 60),
          streetNumber: d.street.streetNumber.slice(0, 10),
          cityName: d.city,
          floor: d.street.floor,
          department: d.street.apartment,
          state: d.provinceCode,
          zipCode: d.postalCode,
        },
      },
      parcels: [
        {
          dimensions: { height: String(d.heightCm), width: String(d.widthCm), depth: String(d.lengthCm) },
          productWeight: String(d.weightGr),
          productCategory: "Impresiones",
          declaredValue: String(Math.max(1, Math.round(d.declared))),
        },
      ],
      deliveryType: d.isBranch ? "agency" : "homeDelivery",
      agencyId: d.isBranch ? d.branchId ?? "" : "",
      saleDate: argentinaTimestamp(),
      serviceType: d.express ? "EP" : "CP",
      shipmentClientId: String(d.orderNumber),
    },
  };
}

const short = (msg: string) => msg.slice(0, 300);
const via = (): "paqar" | "micorreo" => (paqarCanCreateOrders() ? "paqar" : "micorreo");

export async function importSaleToCorreo(saleId: string, opts: { dryRun?: boolean } = {}): Promise<ImportResult> {
  if (!paqarCanCreateOrders() && !micorreoConfigured()) return { status: "skipped", reason: "Correo Argentino no está configurado" };
  const route = via();

  let data: SaleData | "not_applicable";
  try {
    data = await loadSaleData(saleId);
  } catch (err) {
    if (!(err instanceof BuildError)) throw err;
    if (!opts.dryRun) {
      await db.update(sales).set({ correoImportStatus: "error", correoImportError: short(err.message) }).where(eq(sales.id, saleId));
    }
    return { status: "error", error: err.message };
  }
  if (data === "not_applicable") return { status: "skipped", reason: "El método de envío no es Correo Argentino" };
  if (opts.dryRun) return { status: "preview", via: route, payload: route === "paqar" ? toPaqar(data) : toMiCorreo(data) };

  // Atomic claim: only one caller (webhook retry, admin click…) hands a sale over at a time.
  const claimed = await db
    .update(sales)
    .set({ correoImportStatus: "importando", correoImportError: null })
    .where(and(eq(sales.id, saleId), or(isNull(sales.correoImportStatus), eq(sales.correoImportStatus, "error"))))
    .returning({ id: sales.id });
  if (!claimed.length) return { status: "skipped", reason: "Ya importado o en curso" };

  let trackingCode: string | undefined;
  try {
    if (route === "paqar") {
      trackingCode = (await createOrder(toPaqar(data))).trackingNumber;
    } else {
      await importShipment(toMiCorreo(data));
    }
  } catch (err) {
    if (route === "micorreo" && isAlreadyImported(err)) {
      // Already in MiCorreo from an earlier attempt: treat as done.
    } else {
      const message = err instanceof Error ? err.message : String(err);
      await db.update(sales).set({ correoImportStatus: "error", correoImportError: short(message) }).where(eq(sales.id, saleId));
      return { status: "error", error: message };
    }
  }
  await db
    .update(sales)
    .set({
      correoImportStatus: "importado",
      correoImportError: null,
      correoImportedAt: new Date().toISOString(),
      ...(trackingCode ? { trackingCode, trackingCarrier: "Correo Argentino" } : {}),
    })
    .where(eq(sales.id, saleId));
  return { status: "importado", via: route, tracking_code: trackingCode };
}

/** Fire-and-forget hook for payment confirmation: never throws, never blocks the caller's response. */
export function autoImportSale(saleId: string, log: FastifyBaseLogger): void {
  if (!env.MICORREO_AUTO_IMPORT) return;
  importSaleToCorreo(saleId)
    .then((r) => log.info({ saleId, result: r.status }, "correo auto-import"))
    .catch((err) => log.error({ err, saleId }, "correo auto-import failed"));
}
