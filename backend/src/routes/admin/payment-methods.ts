import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { paymentMethods } from "../../db/schema.js";

export async function registerAdminPaymentMethodRoutes(app: FastifyInstance) {
  app.get("/payment-methods", async () => {
    return db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder));
  });

  app.post("/payment-methods", async (req) => {
    const [row] = await db.insert(paymentMethods).values(toValues(req.body as Record<string, unknown>)).returning();
    return row;
  });

  app.put("/payment-methods/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(paymentMethods)
      .set({ ...toValues(req.body as Record<string, unknown>), updatedAt: new Date().toISOString() })
      .where(eq(paymentMethods.id, id))
      .returning();
    return row;
  });

  app.delete("/payment-methods/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
    return { ok: true };
  });
}

function toValues(body: Record<string, unknown>) {
  return {
    name: (body.name as string).trim(),
    surchargePct: String(body.surcharge_pct ?? 0),
    active: body.active as boolean,
    sortOrder: body.sort_order as number,
    provider: body.provider as string,
  };
}
