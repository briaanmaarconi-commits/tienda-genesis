import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, productAddonGroups, productAddonOptions } from "../../db/schema.js";

export async function registerAdminProductAddonRoutes(app: FastifyInstance) {
  app.get("/products-list", async () => {
    return db.select({ id: products.id, name: products.name, slug: products.slug }).from(products).orderBy(asc(products.name));
  });

  app.get("/product-addon-groups", async (req) => {
    const { product_id } = req.query as { product_id: string };
    const groups = await db.query.productAddonGroups.findMany({
      where: eq(productAddonGroups.productId, product_id),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
      with: { productAddonOptions: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
    });
    // Matches the old Supabase alias (options:product_addon_options(*)).
    return groups.map((g) => ({ ...g, options: g.productAddonOptions, productAddonOptions: undefined }));
  });

  app.post("/product-addon-groups", async (req) => {
    const { product_id, name, sort_order } = req.body as { product_id: string; name: string; sort_order: number };
    const [group] = await db
      .insert(productAddonGroups)
      .values({ productId: product_id, name, required: true, sortOrder: sort_order })
      .returning();
    return group;
  });

  app.put("/product-addon-groups/:id", async (req) => {
    const { id } = req.params as { id: string };
    const patch = req.body as Partial<{
      name: string;
      required: boolean;
      is_multiplier: boolean;
      per_unit: boolean;
      active: boolean;
    }>;
    const [group] = await db
      .update(productAddonGroups)
      .set({
        name: patch.name,
        required: patch.required,
        isMultiplier: patch.is_multiplier,
        perUnit: patch.per_unit,
        active: patch.active,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(productAddonGroups.id, id))
      .returning();
    return group;
  });

  app.delete("/product-addon-groups/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(productAddonOptions).where(eq(productAddonOptions.groupId, id));
    await db.delete(productAddonGroups).where(eq(productAddonGroups.id, id));
    return { ok: true };
  });

  app.post("/product-addon-options", async (req) => {
    const { group_id, name, sort_order } = req.body as { group_id: string; name: string; sort_order: number };
    const [option] = await db
      .insert(productAddonOptions)
      .values({ groupId: group_id, name, extraPrice: "0", sortOrder: sort_order })
      .returning();
    return option;
  });

  app.put("/product-addon-options/:id", async (req) => {
    const { id } = req.params as { id: string };
    const patch = req.body as Partial<{ name: string; price_multiplier: number; extra_price: number; active: boolean }>;
    const [option] = await db
      .update(productAddonOptions)
      .set({
        name: patch.name,
        priceMultiplier: patch.price_multiplier != null ? String(patch.price_multiplier) : undefined,
        extraPrice: patch.extra_price != null ? String(patch.extra_price) : undefined,
        active: patch.active,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(productAddonOptions.id, id))
      .returning();
    return option;
  });

  app.delete("/product-addon-options/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(productAddonOptions).where(eq(productAddonOptions.id, id));
    return { ok: true };
  });
}
