import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { sharedCarts } from "../db/schema.js";
import { env } from "../env.js";

// The WhatsApp agent builds shared carts here, the same ones an admin builds
// from /admin/carritos-compartidos/nuevo. It authenticates with BOT_API_KEY
// (header x-bot-key) instead of an admin session, and it only sends ids:
// names and prices are read from the public catalog here, so a leaked key
// can't create a cart with made-up prices.
const LineInput = z.object({
  slug: z.string().min(1).max(200),
  pack_id: z.string().max(100).nullable().optional(),
  qty: z.number().int().min(1).max(100),
  addon_option_ids: z.array(z.string().max(100)).max(20).default([]),
});
const Body = z.object({
  customer_name: z.string().max(100).nullable().optional(),
  customer_phone: z.string().max(30).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  lines: z.array(LineInput).min(1).max(30),
});

function validKey(req: FastifyRequest): boolean {
  const expected = env.BOT_API_KEY;
  const got = req.headers["x-bot-key"];
  if (!expected || typeof got !== "string") return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function registerBotRoutes(app: FastifyInstance) {
  app.post("/api/bot/shared-carts", async (req, reply) => {
    if (!validKey(req)) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten() });
      return;
    }
    const { customer_name, customer_phone, notes, lines } = parsed.data;

    const products = new Map<string, any>();
    const items = [];
    for (const [index, line] of lines.entries()) {
      if (!products.has(line.slug)) {
        // Same view a customer gets: only active products, packs and addons.
        const res = await app.inject({ method: "GET", url: `/api/products/${encodeURIComponent(line.slug)}` });
        if (res.statusCode !== 200) {
          reply.code(400).send({ error: `unknown_product:${line.slug}` });
          return;
        }
        products.set(line.slug, res.json());
      }
      const product = products.get(line.slug);
      const pack = line.pack_id ? (product.packs ?? []).find((p: any) => p.id === line.pack_id) : null;
      if (line.pack_id && !pack) {
        reply.code(400).send({ error: `unknown_pack:${line.pack_id}` });
        return;
      }

      // One option per group, required groups default to their first option —
      // same rule as the product page and the admin cart builder.
      const addons = [];
      for (const group of product.addon_groups ?? []) {
        const options = group.options ?? [];
        const chosen =
          options.find((o: any) => line.addon_option_ids.includes(o.id)) ?? (group.required ? options[0] : undefined);
        if (!chosen) continue;
        addons.push({
          group_id: group.id,
          group_name: group.name,
          option_id: chosen.id,
          option_name: chosen.name,
          extra_price: group.is_multiplier ? 0 : Number(chosen.extra_price),
          per_unit: !group.is_multiplier && !!group.per_unit,
          multiplier: group.is_multiplier ? Number(chosen.price_multiplier) || 1 : undefined,
        });
      }

      const image = product.images?.[0];
      items.push({
        key: `bot-${index}`,
        qty: line.qty,
        product: {
          slug: product.slug,
          name: product.name,
          price: Number(pack ? pack.price : product.price),
          units: pack?.units ?? null,
          label: pack?.label ?? null,
          variantId: pack?.id,
          image_url: image?.url ?? null,
          image_focal_x: image?.focal_x != null ? Number(image.focal_x) : null,
          image_focal_y: image?.focal_y != null ? Number(image.focal_y) : null,
          image_zoom: image?.zoom != null ? Number(image.zoom) : null,
          image_fit: image?.fit ?? null,
          addons: addons.length ? addons : undefined,
        },
      });
    }

    const token = randomBytes(9).toString("base64url");
    await db.insert(sharedCarts).values({
      token,
      customerName: customer_name || null,
      customerPhone: customer_phone || null,
      notes: notes || null,
      items,
    });
    return { url: `${env.PUBLIC_ORIGIN}/carrito-compartido/${token}`, items };
  });
}
