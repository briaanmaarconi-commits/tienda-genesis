import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { coupons } from "../../db/schema.js";

export async function registerAdminCouponRoutes(app: FastifyInstance) {
  app.get("/coupons", async () => {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  });

  app.post("/coupons", async (req) => {
    const [row] = await db.insert(coupons).values(toValues(req.body as Record<string, unknown>)).returning();
    return row;
  });

  app.put("/coupons/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(coupons)
      .set({ ...toValues(req.body as Record<string, unknown>), updatedAt: new Date().toISOString() })
      .where(eq(coupons.id, id))
      .returning();
    return row;
  });

  app.delete("/coupons/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(coupons).where(eq(coupons.id, id));
    return { ok: true };
  });
}

function toValues(body: Record<string, unknown>) {
  return {
    code: (body.code as string).trim().toUpperCase(),
    discountType: body.discount_type as "percentage" | "fixed",
    discountValue: String(body.discount_value ?? 0),
    minOrderTotal: body.min_order_total != null ? String(body.min_order_total) : null,
    startsAt: (body.starts_at as string) ?? null,
    endsAt: (body.ends_at as string) ?? null,
    usageLimit: (body.usage_limit as number) ?? null,
    active: body.active as boolean,
  };
}
