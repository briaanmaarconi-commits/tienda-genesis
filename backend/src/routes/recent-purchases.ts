import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { env } from "../env.js";

// Public "social proof" feed: only paid web orders, first name + product +
// timestamp. Nothing else about the customer (surname, phone, address, email,
// amounts) ever leaves this endpoint.
const WINDOW_DAYS = 30;
const MAX_ITEMS = 12;

export function firstNameOf(raw: string | null | undefined): string | null {
  const token = (raw ?? "").trim().split(/\s+/)[0] ?? "";
  const letters = token.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2 || letters.length > 20) return null;
  return letters.charAt(0).toLocaleUpperCase("es-AR") + letters.slice(1).toLocaleLowerCase("es-AR");
}

export async function registerRecentPurchaseRoutes(app: FastifyInstance) {
  app.get("/api/recent-purchases", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=120");
    if (!env.RECENT_PURCHASES_ENABLED) return { purchases: [] };

    const result = await db.execute(sql`
      SELECT s.created_at, c.name AS customer_name, i.product_name, i.quantity
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      JOIN LATERAL (
        SELECT product_name, quantity FROM sale_items
        WHERE sale_id = s.id ORDER BY subtotal DESC LIMIT 1
      ) i ON true
      WHERE s.source = 'public'
        AND s.status IN ('abonado', 'enviada', 'entregada')
        AND s.created_at > now() - make_interval(days => ${WINDOW_DAYS})
      ORDER BY s.created_at DESC
      LIMIT ${MAX_ITEMS * 2}`);

    const purchases = [];
    for (const row of result.rows as any[]) {
      const firstName = firstNameOf(row.customer_name);
      const full = String(row.product_name ?? "").replace(/\s+/g, " ").trim();
      const product = full.length > 70 ? `${full.slice(0, 69)}…` : full;
      if (!firstName || !product) continue;
      purchases.push({
        first_name: firstName,
        product,
        quantity: Number(row.quantity) || 1,
        at: new Date(row.created_at).toISOString(),
      });
      if (purchases.length >= MAX_ITEMS) break;
    }
    return { purchases };
  });
}
