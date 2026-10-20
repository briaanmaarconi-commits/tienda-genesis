import { and, eq, isNull, or } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { customers, products, saleItems, sales, shippingMethods, siteSettings } from "../db/schema.js";
import { env } from "../env.js";
import { provinceCodeFor, splitStreetAddress } from "./argAddress.js";
import { importShipment, isAlreadyImported, micorreoConfigured, type MiCorreoImport } from "./micorreo.js";

// Imports a paid order into the store's MiCorreo account (POST /shipping/import)
// so the label can be printed there. Only orders whose shipping method uses the
// "correo" provider are touched.

const DEFAULT_DIM_CM = 20;
const DEFAULT_WEIGHT_KG = 0.5;

export type ImportResult =
  | { status: "importado" }
  | { status: "preview"; payload: MiCorreoImport }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

class BuildError extends Error {}

const digits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

async function buildPayload(saleId: string): Promise<MiCorreoImport | "not_applicable"> {
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

  // MiCorreo requires a recipient e-mail; fall back to the store's own address
  // when the customer didn't leave one (Correo's notices then reach the store).
  let email = customer.email?.trim() || "";
  if (!email) {
    const [st] = await db.select({ email: siteSettings.email, notify: siteSettings.adminNotifyEmail }).from(siteSettings).limit(1);
    email = st?.email?.trim() || st?.notify?.trim() || "";
  }
  if (!email) throw new BuildError("Falta el email del destinatario");

  const items = await db
    .select({
      qty: saleItems.quantity,
      weight: products.weightKg,
      length: products.lengthCm,
      width: products.widthCm,
      height: products.heightCm,
    })
    .from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, saleId));
  if (!items.length) throw new BuildError("La venta no tiene productos");

  const weightKg = items.reduce((acc, it) => acc + (Number(it.weight) || DEFAULT_WEIGHT_KG) * (it.qty || 1), 0);
  const maxDim = (pick: (it: (typeof items)[number]) => unknown) =>
    Math.min(150, Math.max(DEFAULT_DIM_CM, ...items.map((it) => Math.ceil(Number(pick(it)) || 0))));
  const phone = digits(customer.phone);
  const declared = Math.max(1, Number(sale.subtotal) - Number(sale.discountAmount || 0));

  return {
    extOrderId: String(sale.orderNumber),
    orderNumber: String(sale.orderNumber),
    recipient: { name: customer.name.trim().slice(0, 60), phone, cellPhone: phone, email },
    shipping: {
      deliveryType: isBranch ? "S" : "D",
      agency: isBranch ? sale.shippingBranchId : null,
      address: {
        streetName: street.streetName.slice(0, 60),
        streetNumber: street.streetNumber.slice(0, 10),
        floor: street.floor,
        apartment: street.apartment,
        city: (sale.shippingLocality?.trim() || sale.shippingProvince || "").slice(0, 60),
        provinceCode,
        postalCode: digits(sale.shippingPostalCode).slice(0, 4),
      },
      weight: Math.min(25_000, Math.max(1, Math.round(weightKg * 1000))),
      declaredValue: Math.round(declared * 100) / 100,
      height: maxDim((it) => it.height),
      length: maxDim((it) => it.length),
      width: maxDim((it) => it.width),
    },
  };
}

const short = (msg: string) => msg.slice(0, 300);

export async function importSaleToMiCorreo(saleId: string, opts: { dryRun?: boolean } = {}): Promise<ImportResult> {
  if (!micorreoConfigured()) return { status: "skipped", reason: "MiCorreo no está configurado" };

  let payload: MiCorreoImport | "not_applicable";
  try {
    payload = await buildPayload(saleId);
  } catch (err) {
    if (!(err instanceof BuildError)) throw err;
    if (!opts.dryRun) {
      await db.update(sales).set({ correoImportStatus: "error", correoImportError: short(err.message) }).where(eq(sales.id, saleId));
    }
    return { status: "error", error: err.message };
  }
  if (payload === "not_applicable") return { status: "skipped", reason: "El método de envío no es Correo Argentino" };
  if (opts.dryRun) return { status: "preview", payload };

  // Atomic claim: only one caller (webhook retry, admin click…) imports a sale at a time.
  const claimed = await db
    .update(sales)
    .set({ correoImportStatus: "importando", correoImportError: null })
    .where(and(eq(sales.id, saleId), or(isNull(sales.correoImportStatus), eq(sales.correoImportStatus, "error"))))
    .returning({ id: sales.id });
  if (!claimed.length) return { status: "skipped", reason: "Ya importado o en curso" };

  try {
    await importShipment(payload);
  } catch (err) {
    if (!isAlreadyImported(err)) {
      const message = err instanceof Error ? err.message : String(err);
      await db.update(sales).set({ correoImportStatus: "error", correoImportError: short(message) }).where(eq(sales.id, saleId));
      return { status: "error", error: message };
    }
  }
  await db
    .update(sales)
    .set({ correoImportStatus: "importado", correoImportError: null, correoImportedAt: new Date().toISOString() })
    .where(eq(sales.id, saleId));
  return { status: "importado" };
}

/** Fire-and-forget hook for payment confirmation: never throws, never blocks the caller's response. */
export function autoImportSale(saleId: string, log: FastifyBaseLogger): void {
  if (!env.MICORREO_AUTO_IMPORT) return;
  importSaleToMiCorreo(saleId)
    .then((r) => log.info({ saleId, result: r.status }, "micorreo auto-import"))
    .catch((err) => log.error({ err, saleId }, "micorreo auto-import failed"));
}
