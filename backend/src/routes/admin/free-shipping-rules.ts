import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { freeShippingRules } from "../../db/schema.js";

const ANY = "__any__";

export async function registerAdminFreeShippingRuleRoutes(app: FastifyInstance) {
  app.get("/free-shipping-rules", async () => {
    return db.query.freeShippingRules.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: { shippingMethod: { columns: { name: true } } },
    });
  });

  app.post("/free-shipping-rules", async (req) => {
    const [row] = await db.insert(freeShippingRules).values(toValues(req.body as Record<string, unknown>)).returning();
    return row;
  });

  app.put("/free-shipping-rules/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(freeShippingRules)
      .set({ ...toValues(req.body as Record<string, unknown>), updatedAt: new Date().toISOString() })
      .where(eq(freeShippingRules.id, id))
      .returning();
    return row;
  });

  app.delete("/free-shipping-rules/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(freeShippingRules).where(eq(freeShippingRules.id, id));
    return { ok: true };
  });
}

// "__any__" is the sentinel the frontend's Select components use for a
// nullable FK/text field (Radix Select can't hold an empty-string value) —
// converted to null here, exactly like the original client-side save().
function toValues(body: Record<string, unknown>) {
  const shippingMethodId = body.shipping_method_id as string;
  const province = body.province as string;
  return {
    shippingMethodId: shippingMethodId === ANY ? null : shippingMethodId,
    minAmount: String(body.min_amount ?? 0),
    province: province === ANY ? null : province,
    postalCodeFrom: (body.postal_code_from as string) || null,
    postalCodeTo: (body.postal_code_to as string) || null,
    active: body.active as boolean,
  };
}
