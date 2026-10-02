import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sharedCarts } from "../db/schema.js";

// Public lookup for a cart link the admin built for a specific client
// (see routes/admin/shared-carts.ts). No auth: the token itself is the
// capability — same trust model as a Mercado Pago payment link.
export async function registerSharedCartRoutes(app: FastifyInstance) {
  app.get("/api/shared-carts/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const [row] = await db.select().from(sharedCarts).where(eq(sharedCarts.token, token)).limit(1);
    if (!row) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    if (row.status !== "pendiente") {
      reply.code(410).send({ error: "already_used" });
      return;
    }
    return {
      token: row.token,
      customer_name: row.customerName,
      customer_phone: row.customerPhone,
      items: row.items,
    };
  });
}
