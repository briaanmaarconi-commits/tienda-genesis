import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "../db/index.js";
import { isAdmin } from "../middleware/auth.js";
import {
  siteSettingsPublic,
  banners,
  categories,
  products,
  paymentMethods,
  shippingMethods,
  shippingRates,
  localDeliveryZones,
  freeShippingRules,
  stickerMaterials,
  stickerFinishes,
  stickerShapes,
  stickerSizes,
  stickerQuantities,
  coupons,
} from "../db/schema.js";

// Replaces `USING (has_role(auth.uid(),'admin') OR active = true)` policies:
// admins see every row, everyone else only sees active=true.
function activeCondition(req: FastifyRequest, activeCol: any) {
  return isAdmin(req) ? undefined : eq(activeCol, true);
}

// The old Supabase queries aliased nested relations to shorter names
// (images/packs/sticker_folders/stickers/addon_groups/options) that don't
// match Drizzle's relation-name-derived output keys — remapped here so the
// frontend's existing field references keep working unchanged.
function remapProduct(p: any) {
  return {
    ...p,
    images: p.productImages,
    packs: p.productPacks,
    sticker_folders: p.productStickerFolders?.map((f: any) => ({ ...f, stickers: f.productStickers })),
    addon_groups: p.productAddonGroups?.map((g: any) => ({ ...g, options: g.productAddonOptions })),
    productImages: undefined,
    productPacks: undefined,
    productStickerFolders: undefined,
    productAddonGroups: undefined,
  };
}

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/api/site-settings", async () => {
    const [row] = await db.select().from(siteSettingsPublic).limit(1);
    return row ?? null;
  });

  app.get("/api/banners", async (req) => {
    const where = activeCondition(req, banners.active);
    const q = db.select().from(banners).orderBy(asc(banners.sortOrder));
    return where ? q.where(where) : q;
  });

  app.get("/api/categories", async () => {
    return db.select().from(categories).orderBy(asc(categories.sortOrder));
  });

  app.get("/api/payment-methods", async (req) => {
    const where = activeCondition(req, paymentMethods.active);
    const q = db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder));
    return where ? q.where(where) : q;
  });

  app.get("/api/shipping-methods", async (req) => {
    const where = activeCondition(req, shippingMethods.active);
    const q = db.select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder));
    return where ? q.where(where) : q;
  });

  app.get("/api/shipping-rates", async (req) => {
    const { method_id } = req.query as { method_id?: string };
    const conditions = [eq(shippingRates.active, true)];
    if (method_id) conditions.push(eq(shippingRates.shippingMethodId, method_id));
    return db.select().from(shippingRates).where(and(...conditions)).orderBy(asc(shippingRates.sortOrder));
  });

  app.get("/api/local-delivery-zones", async (req) => {
    const { method_id } = req.query as { method_id?: string };
    const conditions = [eq(localDeliveryZones.active, true)];
    if (method_id) conditions.push(eq(localDeliveryZones.shippingMethodId, method_id));
    return db.select().from(localDeliveryZones).where(and(...conditions)).orderBy(asc(localDeliveryZones.sortOrder));
  });

  app.get("/api/free-shipping-rules", async () => {
    return db.select().from(freeShippingRules).where(eq(freeShippingRules.active, true));
  });

  app.get("/api/sticker-materials", async (req) => listActive(stickerMaterials, req));
  app.get("/api/sticker-finishes", async (req) => listActive(stickerFinishes, req));
  app.get("/api/sticker-shapes", async (req) => listActive(stickerShapes, req));
  app.get("/api/sticker-sizes", async (req) => listActive(stickerSizes, req));
  app.get("/api/sticker-quantities", async (req) => listActive(stickerQuantities, req));

  app.get("/api/products", async (req) => {
    const { category, featured } = req.query as { category?: string; featured?: string };

    const list = await db.query.products.findMany({
      where: isAdmin(req) ? undefined : eq(products.active, true),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: {
        category: true,
        productImages: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
        productPacks: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
      },
    });

    let result = list;
    if (featured === "true") result = result.filter((p) => p.featured);
    if (category) result = result.filter((p) => p.category?.slug === category);
    return result.map(remapProduct);
  });

  app.get("/api/products/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const product = await db.query.products.findFirst({
      where: isAdmin(req) ? eq(products.slug, slug) : and(eq(products.slug, slug), eq(products.active, true)),
      with: {
        category: true,
        productImages: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
        productPacks: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
        productStickerFolders: {
          where: isAdmin(req) ? undefined : (t: any) => eq(t.active, true),
          orderBy: (t, { asc }) => [asc(t.sortOrder)],
          with: {
            productStickers: {
              where: isAdmin(req) ? undefined : (t: any) => eq(t.active, true),
              orderBy: (t, { asc }) => [asc(t.sortOrder)],
            },
          },
        },
        productAddonGroups: {
          where: isAdmin(req) ? undefined : (t: any) => eq(t.active, true),
          orderBy: (t, { asc }) => [asc(t.sortOrder)],
          with: {
            productAddonOptions: {
              where: isAdmin(req) ? undefined : (t: any) => eq(t.active, true),
              orderBy: (t, { asc }) => [asc(t.sortOrder)],
            },
          },
        },
      },
    });
    if (!product) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    return remapProduct(product);
  });

  app.post("/api/coupons/validate", async (req) => {
    const { code, subtotal } = req.body as { code?: string; subtotal?: number };
    if (typeof code !== "string" || code.trim().length === 0 || code.length > 64) {
      return { valid: false, discount: 0, error: "Ingresá un código" };
    }
    const sub = Number(subtotal) || 0;

    const [row] = await db
      .select()
      .from(coupons)
      .where(and(ilike(coupons.code, code.trim()), eq(coupons.active, true)))
      .limit(1);

    if (!row) return { valid: false, discount: 0, error: "Código inválido" };

    const now = Date.now();
    if (row.startsAt && new Date(row.startsAt).getTime() > now) {
      return { valid: false, discount: 0, error: "El cupón aún no está vigente" };
    }
    if (row.endsAt && new Date(row.endsAt).getTime() < now) {
      return { valid: false, discount: 0, error: "El cupón expiró" };
    }
    if (row.usageLimit != null && row.timesUsed >= row.usageLimit) {
      return { valid: false, discount: 0, error: "El cupón se agotó" };
    }
    if (row.minOrderTotal != null && sub < Number(row.minOrderTotal)) {
      return { valid: false, discount: 0, error: `Mínimo de compra: $${row.minOrderTotal}` };
    }

    const v = Number(row.discountValue);
    const discount = row.discountType === "percentage" ? Math.round(((sub * v) / 100) * 100) / 100 : Math.min(v, sub);
    return { valid: true, discount, code: row.code };
  });
}

async function listActive(table: any, req: FastifyRequest) {
  const where = activeCondition(req, table.active);
  const q = db.select().from(table).orderBy(asc(table.sortOrder));
  return where ? q.where(where) : q;
}
