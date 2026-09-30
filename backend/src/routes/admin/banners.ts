import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { banners } from "../../db/schema.js";

export async function registerAdminBannerRoutes(app: FastifyInstance) {
  app.get("/banners", async () => {
    return db.select().from(banners).orderBy(asc(banners.sortOrder));
  });

  app.post("/banners", async (req) => {
    const body = req.body as Record<string, unknown>;
    const [row] = await db.insert(banners).values(toValues(body)).returning();
    return row;
  });

  app.put("/banners/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const [row] = await db
      .update(banners)
      .set({ ...toValues(body), updatedAt: new Date().toISOString() })
      .where(eq(banners.id, id))
      .returning();
    return row;
  });

  app.delete("/banners/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(banners).where(eq(banners.id, id));
    return { ok: true };
  });

  // Adjacent-pair sort_order swap, mirroring AdminBanners.tsx's move(): two
  // sequential updates, not a full re-sequence of every row.
  app.post("/banners/:id/swap-with/:otherId", async (req) => {
    const { id, otherId } = req.params as { id: string; otherId: string };
    const [a] = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
    const [b] = await db.select().from(banners).where(eq(banners.id, otherId)).limit(1);
    if (!a || !b) return { ok: false };

    await db.update(banners).set({ sortOrder: b.sortOrder }).where(eq(banners.id, a.id));
    await db.update(banners).set({ sortOrder: a.sortOrder }).where(eq(banners.id, b.id));
    return { ok: true };
  });
}

function toValues(body: Record<string, unknown>) {
  return {
    title: body.title as string,
    subtitle: body.subtitle as string | null,
    ctaText: body.cta_text as string | null,
    ctaHref: body.cta_href as string | null,
    imageUrl: body.image_url as string | null,
    bgColor: body.bg_color as string | null,
    sortOrder: body.sort_order as number,
    active: body.active as boolean,
    focalX: String(body.focal_x ?? 50),
    focalY: String(body.focal_y ?? 50),
    zoom: String(body.zoom ?? 1),
    fit: (body.fit as string) ?? "cover",
    hideTextMobile: (body.hide_text_mobile as boolean) ?? false,
  };
}
