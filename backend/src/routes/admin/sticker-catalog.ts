import type { FastifyInstance } from "fastify";
import { asc, eq, type AnyColumn } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "../../db/index.js";
import { stickerMaterials, stickerFinishes, stickerShapes, stickerSizes, stickerQuantities } from "../../db/schema.js";

// Direct port of AdminCustomStickers.tsx's generic CrudSection: one table,
// list + save (insert/update) + delete, no bespoke logic per resource.
function genericCrud(path: string, table: PgTable & { id: AnyColumn; sortOrder: AnyColumn }, toValues: (body: Record<string, unknown>) => Record<string, unknown>) {
  return async (app: FastifyInstance) => {
    app.get(`/${path}`, async () => {
      return db.select().from(table).orderBy(asc(table.sortOrder));
    });

    app.post(`/${path}`, async (req) => {
      const [row] = await db.insert(table).values(toValues(req.body as Record<string, unknown>)).returning();
      return row;
    });

    app.put(`/${path}/:id`, async (req) => {
      const { id } = req.params as { id: string };
      const [row] = await db
        .update(table)
        .set({ ...toValues(req.body as Record<string, unknown>), updatedAt: new Date().toISOString() })
        .where(eq(table.id, id))
        .returning();
      return row;
    });

    app.delete(`/${path}/:id`, async (req) => {
      const { id } = req.params as { id: string };
      await db.delete(table).where(eq(table.id, id));
      return { ok: true };
    });
  };
}

export async function registerAdminStickerCatalogRoutes(app: FastifyInstance) {
  await genericCrud("sticker-materials", stickerMaterials, (b) => ({
    name: b.name as string,
    basePrice: String(b.base_price ?? 0),
    sortOrder: b.sort_order as number,
    active: b.active as boolean,
  }))(app);

  await genericCrud("sticker-finishes", stickerFinishes, (b) => ({
    name: b.name as string,
    surcharge: String(b.surcharge ?? 0),
    sortOrder: b.sort_order as number,
    active: b.active as boolean,
  }))(app);

  await genericCrud("sticker-shapes", stickerShapes, (b) => ({
    name: b.name as string,
    icon: (b.icon as string) || null,
    sortOrder: b.sort_order as number,
    active: b.active as boolean,
  }))(app);

  await genericCrud("sticker-sizes", stickerSizes, (b) => ({
    label: b.label as string,
    widthCm: String(b.width_cm ?? 0),
    heightCm: String(b.height_cm ?? 0),
    priceMultiplier: String(b.price_multiplier ?? 1),
    sortOrder: b.sort_order as number,
    active: b.active as boolean,
  }))(app);

  await genericCrud("sticker-quantities", stickerQuantities, (b) => ({
    quantity: b.quantity as number,
    discountPct: String(b.discount_pct ?? 0),
    sortOrder: b.sort_order as number,
    active: b.active as boolean,
  }))(app);
}
