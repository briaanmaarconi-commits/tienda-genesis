import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { expenses } from "../../db/schema.js";

export async function registerAdminExpenseRoutes(app: FastifyInstance) {
  app.get("/expenses", async () => {
    return db.select().from(expenses).orderBy(desc(expenses.expenseDate));
  });

  app.post("/expenses", async (req) => {
    const [row] = await db.insert(expenses).values(toValues(req.body as Record<string, unknown>)).returning();
    return row;
  });

  app.put("/expenses/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(expenses)
      .set(toValues(req.body as Record<string, unknown>))
      .where(eq(expenses.id, id))
      .returning();
    return row;
  });

  app.delete("/expenses/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(expenses).where(eq(expenses.id, id));
    return { ok: true };
  });
}

function toValues(body: Record<string, unknown>) {
  return {
    category: (body.category as string).trim(),
    description: (body.description as string)?.trim() || null,
    amount: String(body.amount ?? 0),
    expenseDate: (body.expense_date as string) || new Date().toISOString().slice(0, 10),
  };
}
