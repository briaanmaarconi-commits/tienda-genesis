import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { customers } from "../../db/schema.js";

export async function registerAdminCustomerRoutes(app: FastifyInstance) {
  app.get("/customers", async () => {
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  });

  app.post("/customers", async (req) => {
    const body = req.body as { name: string; phone?: string; email?: string; address?: string; notes?: string };
    const [row] = await db.insert(customers).values(body).returning();
    return row;
  });

  app.put("/customers/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { name: string; phone?: string; email?: string; address?: string; notes?: string };
    const [row] = await db
      .update(customers)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, id))
      .returning();
    return row;
  });

  app.delete("/customers/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(customers).where(eq(customers.id, id));
    return { ok: true };
  });
}
