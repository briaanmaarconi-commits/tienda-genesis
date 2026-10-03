import { createHash } from "node:crypto";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function browserId(value: unknown): string | undefined {
  return typeof value === "string" && /^fb\.\d+\.\d{10,16}\.[A-Za-z0-9_-]{1,300}$/.test(value) ? value : undefined;
}

export function purchaseSnapshot(input: {
  saleId: string; customerId: string; email?: string | null; total: number;
  userAgent?: string; fbp?: string; fbc?: string; origin: string;
  contents: { id: string; quantity: number }[];
}) {
  if (!Number.isFinite(input.total) || input.total <= 0) return null;
  const email = input.email?.trim().toLowerCase();
  return {
    event_name: "Purchase", event_id: `purchase_${input.saleId}`, action_source: "website",
    // Never include customer information or shared-cart capability tokens in URLs.
    event_source_url: new URL("/", input.origin).href,
    user_data: {
      external_id: [hash(input.customerId)],
      ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { em: [hash(email)] } : {}),
      ...(input.userAgent ? { client_user_agent: input.userAgent.slice(0, 1000) } : {}),
      ...(browserId(input.fbp) ? { fbp: input.fbp } : {}),
      ...(browserId(input.fbc) ? { fbc: input.fbc } : {}),
    },
    custom_data: {
      currency: "ARS", value: Math.round(input.total * 100) / 100,
      ...(input.contents.length ? { content_type: "product", contents: input.contents, content_ids: input.contents.map(c => c.id) } : {}),
    },
  };
}

export function verifiedMpPurchase(payment: { status?: string; currency_id?: string; transaction_amount?: number; live_mode?: boolean }, total: number): boolean {
  return payment.status === "approved" && payment.live_mode === true && payment.currency_id === "ARS"
    && Number.isFinite(total) && total > 0 && Number.isFinite(payment.transaction_amount)
    && Math.round(Number(payment.transaction_amount) * 100) === Math.round(total * 100);
}

export function eventAtPayment(snapshot: object, paidAt: string | Date, now = Date.now()) {
  const timestamp = new Date(paidAt).getTime();
  if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp >= 7 * 24 * 60 * 60 * 1000) return null;
  return { ...snapshot, event_time: Math.floor(timestamp / 1000) };
}
