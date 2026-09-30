import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { localDeliveryZones } from "../../db/schema.js";

export async function registerAdminDeliveryZoneRoutes(app: FastifyInstance) {
  app.get("/delivery-zones", async () => {
    return db.query.localDeliveryZones.findMany({
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
      with: { shippingMethod: { columns: { name: true } } },
    });
  });

  app.post("/delivery-zones", async (req) => {
    const [row] = await db.insert(localDeliveryZones).values(toValues(req.body as Record<string, unknown>)).returning();
    return row;
  });

  app.put("/delivery-zones/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(localDeliveryZones)
      .set({ ...toValues(req.body as Record<string, unknown>), updatedAt: new Date().toISOString() })
      .where(eq(localDeliveryZones.id, id))
      .returning();
    return row;
  });

  app.delete("/delivery-zones/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(localDeliveryZones).where(eq(localDeliveryZones.id, id));
    return { ok: true };
  });
}

function toValues(body: Record<string, unknown>) {
  return {
    shippingMethodId: body.shipping_method_id as string,
    name: (body.name as string).trim(),
    postalCodes: (body.postal_codes as string[]) ?? [],
    cost: String(body.cost ?? 0),
    estimatedTime: (body.estimated_time as string) || null,
    active: body.active as boolean,
    sortOrder: body.sort_order as number,
  };
}
