import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { products } from "../db/schema.js";
import { env } from "../env.js";
import { buildMetaCatalog } from "../lib/metaCatalog.js";

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.get("/api/catalog/meta.xml", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const rows = await db.query.products.findMany({
        where: eq(products.active, true),
        orderBy: (t, { asc }) => [asc(t.id)],
        with: {
          productImages: true,
          productPacks: true,
          productAddonGroups: { with: { productAddonOptions: true } },
        },
      });
      const feed = buildMetaCatalog(rows, env.FRONTEND_ORIGIN);
      return reply.type("application/xml; charset=utf-8").send(feed.xml);
    } catch (error) {
      app.log.error({ err: error }, "Meta catalog refresh failed");
      return reply.code(503).header("Retry-After", "300").send({ error: "Catalog temporarily unavailable" });
    }
  });
}
