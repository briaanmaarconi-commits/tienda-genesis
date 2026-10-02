import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sharedCarts } from "../../db/schema.js";
import { env } from "../../env.js";

// Mirrors the frontend's CartItem/CartProduct shape (src/contexts/CartContext.tsx)
// so the item array can be written straight into cart state on the client side,
// with no server-side reshaping.
const CartAddonInput = z.object({
  group_id: z.string(),
  group_name: z.string(),
  option_id: z.string(),
  option_name: z.string(),
  extra_price: z.number(),
  per_unit: z.boolean().optional(),
  multiplier: z.number().optional(),
});
const CartProductInput = z.object({
  slug: z.string(),
  name: z.string(),
  price: z.number(),
  units: z.number().nullable().optional(),
  label: z.string().nullable().optional(),
  variantId: z.string().optional(),
  image_url: z.string().nullable().optional(),
  image_focal_x: z.number().nullable().optional(),
  image_focal_y: z.number().nullable().optional(),
  image_zoom: z.number().nullable().optional(),
  image_fit: z.string().nullable().optional(),
  addons: z.array(CartAddonInput).optional(),
});
const CartItemInput = z.object({
  key: z.string(),
  product: CartProductInput,
  qty: z.number().int().min(1),
});

const CreateBody = z.object({
  customer_name: z.string().max(100).nullable().optional(),
  customer_phone: z.string().max(30).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(CartItemInput).min(1).max(100),
});

export async function registerAdminSharedCartRoutes(app: FastifyInstance) {
  app.get("/shared-carts", async () => {
    return db.select().from(sharedCarts).orderBy(desc(sharedCarts.createdAt));
  });

  app.post("/shared-carts", async (req, reply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten() });
      return;
    }
    const { customer_name, customer_phone, notes, items } = parsed.data;
    const token = randomBytes(9).toString("base64url");

    const [row] = await db
      .insert(sharedCarts)
      .values({
        token,
        customerName: customer_name || null,
        customerPhone: customer_phone || null,
        notes: notes || null,
        items,
      })
      .returning();

    return { ...row, url: `${env.PUBLIC_ORIGIN}/carrito-compartido/${token}` };
  });

  app.delete("/shared-carts/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(sharedCarts).where(eq(sharedCarts.id, id));
    return { ok: true };
  });
}
