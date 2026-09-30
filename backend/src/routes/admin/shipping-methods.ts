import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { shippingMethods } from "../../db/schema.js";

export async function registerAdminShippingMethodRoutes(app: FastifyInstance) {
  app.get("/shipping-methods", async () => {
    return db.select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder));
  });

  app.post("/shipping-methods", async (req) => {
    const [row] = await db.insert(shippingMethods).values(toValues(req.body as Record<string, unknown>)).returning();
    return row;
  });

  app.put("/shipping-methods/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(shippingMethods)
      .set({ ...toValues(req.body as Record<string, unknown>), updatedAt: new Date().toISOString() })
      .where(eq(shippingMethods.id, id))
      .returning();
    return row;
  });

  app.delete("/shipping-methods/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(shippingMethods).where(eq(shippingMethods.id, id));
    return { ok: true };
  });
}

function toValues(body: Record<string, unknown>) {
  return {
    name: body.name as string,
    cost: String(body.cost ?? 0),
    active: body.active as boolean,
    sortOrder: body.sort_order as number,
    provider: body.provider as string,
    tipo: (body.tipo as string) ?? null,
    rateMode: body.rate_mode as string,
    deliveryType: body.delivery_type as string,
    estimatedTime: (body.estimated_time as string) || null,
    pickupHours: (body.pickup_hours as string) || null,
  };
}
