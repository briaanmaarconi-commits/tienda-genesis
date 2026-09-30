import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { shippingRates } from "../../db/schema.js";

export async function registerAdminShippingRateRoutes(app: FastifyInstance) {
  app.get("/shipping-rates", async () => {
    const rows = await db.query.shippingRates.findMany({
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
      with: { shippingMethod: { columns: { name: true } } },
    });
    // Matches the old unaliased Supabase embed (shipping_methods(name), plural).
    return rows.map((r) => ({ ...r, shipping_methods: r.shippingMethod, shippingMethod: undefined }));
  });

  app.post("/shipping-rates", async (req) => {
    const [row] = await db.insert(shippingRates).values(toValues(req.body as Record<string, unknown>)).returning();
    return row;
  });

  app.put("/shipping-rates/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(shippingRates)
      .set({ ...toValues(req.body as Record<string, unknown>), updatedAt: new Date().toISOString() })
      .where(eq(shippingRates.id, id))
      .returning();
    return row;
  });

  app.delete("/shipping-rates/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(shippingRates).where(eq(shippingRates.id, id));
    return { ok: true };
  });
}

function toValues(body: Record<string, unknown>) {
  return {
    shippingMethodId: body.shipping_method_id as string,
    province: (body.province as string) || null,
    postalCodeFrom: (body.postal_code_from as string) || null,
    postalCodeTo: (body.postal_code_to as string) || null,
    cost: String(body.cost ?? 0),
    freeFromAmount: body.free_from_amount != null && body.free_from_amount !== "" ? String(body.free_from_amount) : null,
    active: body.active as boolean,
    sortOrder: body.sort_order as number,
  };
}
