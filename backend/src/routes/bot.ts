import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { customers, paymentMethods, products as catalogProducts, saleItems, sales, sharedCarts } from "../db/schema.js";
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
  // The checkout sends customers to WhatsApp with "pedido #N"; the agent looks
  // the order up here to check a transfer receipt against it. Read-only: the
  // team still marks the sale as paid in the admin.
  app.get<{ Params: { number: string } }>("/api/bot/orders/:number", async (req, reply) => {
    if (!validKey(req)) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const number = Number(req.params.number);
    if (!Number.isInteger(number) || number < 1) {
      reply.code(400).send({ error: "invalid_number" });
      return;
    }
    const [sale] = await db
      .select({
        id: sales.id,
        orderNumber: sales.orderNumber,
        status: sales.status,
        total: sales.total,
        shippingCost: sales.shippingCost,
        createdAt: sales.createdAt,
        mpStatus: sales.mpStatus,
        customerName: customers.name,
        customerPhone: customers.phone,
        paymentMethod: paymentMethods.name,
        paymentProvider: paymentMethods.provider,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(paymentMethods, eq(paymentMethods.id, sales.paymentMethodId))
      .where(eq(sales.orderNumber, number))
      .limit(1);
    if (!sale) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    const items = await db
      .select({ name: saleItems.productName, quantity: saleItems.quantity, subtotal: saleItems.subtotal })
      .from(saleItems)
      .where(eq(saleItems.saleId, sale.id));
    const { id: _id, ...order } = sale;
    return { ...order, items };
  });


  // Private operational digest for the owner's WhatsApp report. Never exposes
  // addresses, payment credentials, costs or customer documents.
  app.get<{ Querystring: { from: string; to: string } }>("/api/bot/daily-summary", async (req, reply) => {
    if (!validKey(req)) return reply.code(401).send({ error: "unauthorized" });
    const parsed = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_period" });
    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    if (to <= from || to.getTime() - from.getTime() > 48 * 3600000)
      return reply.code(400).send({ error: "invalid_period" });
    const rows = await db.select({
      id: sales.id, orderNumber: sales.orderNumber, status: sales.status,
      total: sales.total, createdAt: sales.createdAt, updatedAt: sales.updatedAt,
      customerName: customers.name,
    }).from(sales).leftJoin(customers, eq(customers.id, sales.customerId))
      .where(and(lt(sales.createdAt, to.toISOString()), or(
        and(gte(sales.createdAt, from.toISOString()), lt(sales.createdAt, to.toISOString())),
        and(gte(sales.updatedAt, from.toISOString()), lt(sales.updatedAt, to.toISOString())),
        inArray(sales.status, ["pendiente", "abonado", "confirmada"])
      ))).orderBy(asc(sales.orderNumber)).limit(501);
    const selected = rows.slice(0, 500);
    const items = selected.length ? await db.select({
      saleId: saleItems.saleId, name: saleItems.productName, quantity: saleItems.quantity,
    }).from(saleItems).where(inArray(saleItems.saleId, selected.map(s => s.id))) : [];
    return {
      from: from.toISOString(), to: to.toISOString(), truncated: rows.length > 500,
      orders: selected.map(({ id, ...sale }) => ({
        ...sale, items: items.filter(i => i.saleId === id).map(({ saleId, ...item }) => item)
      }))
    };
  });

  // Read-only purchase guard: do not send sales reminders to an existing buyer.
  app.get<{ Querystring: { phone: string } }>("/api/bot/follow-up-status", async (req, reply) => {
    if (!validKey(req)) return reply.code(401).send({ error: "unauthorized" });
    const phone = String(req.query.phone || "").replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) return reply.code(400).send({ error: "invalid_phone" });
    const [purchase] = await db.select({ id: sales.id }).from(sales)
      .innerJoin(customers, eq(customers.id, sales.customerId))
      .where(and(
        sql`right(regexp_replace(coalesce(${customers.phone}, ''), '[^0-9]', '', 'g'), 10) = ${phone}`,
        or(inArray(sales.status, ["abonado", "confirmada", "enviada", "entregada"]),
           eq(sales.mpStatus, "approved"))
      )).limit(1);
    return { has_purchase: !!purchase };
  });


  // The exact checkout linked to a bot cart, not an unrelated order number.
  app.get<{ Params: { token: string } }>("/api/bot/shared-carts/:token/status", async (req, reply) => {
    if (!validKey(req)) return reply.code(401).send({ error: "unauthorized" });
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(req.params.token))
      return reply.code(400).send({ error: "invalid_token" });
    const [cart] = await db.select().from(sharedCarts).where(eq(sharedCarts.token, req.params.token)).limit(1);
    if (!cart) return reply.code(404).send({ error: "not_found" });
    if (!cart.saleId) return { purchased: false, paid: false, cart_status: cart.status };
    const [order] = await db.select({
      number: sales.orderNumber, status: sales.status, total: sales.total,
      mpStatus: sales.mpStatus, phone: customers.phone,
    }).from(sales).leftJoin(customers, eq(customers.id, sales.customerId))
      .where(eq(sales.id, cart.saleId)).limit(1);
    if (!order) return reply.code(409).send({ error: "order_missing" });
    const sold = await db.select({
      slug: catalogProducts.slug, name: saleItems.productName, price: saleItems.unitPrice, qty: saleItems.quantity,
      addons: saleItems.addons,
    }).from(saleItems).leftJoin(catalogProducts, eq(catalogProducts.id, saleItems.productId))
      .where(eq(saleItems.saleId, cart.saleId));
    const options = (addons: unknown): string[] => Array.isArray(addons)
      ? addons.map((a: any) => String(a.option_id || "")).sort() : [];
    const key = (slug: unknown, price: unknown, qty: unknown, addons: unknown, name: unknown) =>
      JSON.stringify([slug, Number(price).toFixed(2), Number(qty), options(addons), name]);
    const expected = (Array.isArray(cart.items) ? cart.items : []).map((i: any) =>
      key(i.product?.slug, i.product?.price, i.qty, i.product?.addons, `${i.product?.name}${i.product?.label ? ` (${i.product.label})` : ""}`)).sort();
    const actual = sold.map(i => key(i.slug, i.price, i.qty, i.addons, i.name)).sort();
    return {
      purchased: true,
      paid: order.status !== "cancelada" && (order.status === "abonado" || order.mpStatus === "approved"),
      items_match: expected.length > 0 && JSON.stringify(expected) === JSON.stringify(actual),
      order_number: order.number, status: order.status, total: order.total, customer_phone: order.phone,
    };
  });

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
