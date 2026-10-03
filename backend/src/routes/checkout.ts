import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { coupons, customers, sales, saleItems, products, productPacks, paymentMethods, siteSettings, sharedCarts } from "../db/schema.js";
import { sendAdminOrderNotification } from "../email/sendAdminOrderNotification.js";
import { purchaseSnapshot } from "../lib/purchaseEvent.js";
import { savePurchaseSnapshot } from "../lib/purchaseTracking.js";
import { env } from "../env.js";

const ItemInput = z.object({
  product_slug: z.string().optional(),
  pack_id: z.string().uuid().nullable().optional(),
  product_name: z.string(),
  unit_price: z.number(),
  quantity: z.number(),
  subtotal: z.number(),
  pack_units: z.number().nullable().optional(),
  custom_sticker_config: z.unknown().nullable().optional(),
  addons: z.unknown().nullable().optional(),
  photos: z.array(z.string()).nullable().optional(),
});

const CheckoutBody = z.object({
  customer: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().min(1).max(30),
    email: z.string().max(255).nullable().optional(),
    address: z.string().max(300).nullable().optional(),
  }),
  sale: z.object({
    payment_method_id: z.string().min(1),
    shipping_method_id: z.string().min(1),
    subtotal: z.number(),
    shipping_cost: z.number().optional().default(0),
    surcharge: z.number().optional().default(0),
    notes: z.string().max(500).nullable().optional(),
    shipping_postal_code: z.string().nullable().optional(),
    shipping_province: z.string().nullable().optional(),
    shipping_locality: z.string().nullable().optional(),
    shipping_branch_id: z.string().nullable().optional(),
    shipping_branch_name: z.string().nullable().optional(),
  }),
  items: z.array(ItemInput).min(1).max(200),
  coupon_code: z.string().max(64).nullable().optional(),
  shared_cart_token: z.string().max(64).nullable().optional(),
  tracking: z.object({ fbp: z.string().max(350).optional(), fbc: z.string().max(350).optional() }).optional(),
});

export async function registerCheckoutRoutes(app: FastifyInstance) {
  app.post("/api/checkout", async (req, reply) => {
    const parsed = CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten() });
      return;
    }
    const { customer, sale, items, coupon_code, shared_cart_token } = parsed.data;

    const subtotal = sale.subtotal || 0;
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;

    if (coupon_code?.trim()) {
      const [c] = await db
        .select()
        .from(coupons)
        .where(and(sql`lower(${coupons.code}) = lower(${coupon_code.trim()})`, eq(coupons.active, true)))
        .limit(1);
      const now = Date.now();
      if (
        c &&
        (!c.startsAt || new Date(c.startsAt).getTime() <= now) &&
        (!c.endsAt || new Date(c.endsAt).getTime() >= now) &&
        (c.usageLimit == null || c.timesUsed < c.usageLimit) &&
        (c.minOrderTotal == null || subtotal >= Number(c.minOrderTotal))
      ) {
        const v = Number(c.discountValue);
        discountAmount = c.discountType === "percentage" ? Math.round(((subtotal * v) / 100) * 100) / 100 : Math.min(v, subtotal);
        appliedCouponCode = c.code;
      }
    }

    const shippingCost = Math.max(0, sale.shipping_cost || 0);
    const surcharge = Math.max(0, sale.surcharge || 0);
    const total = Math.max(0, subtotal - discountAmount) + shippingCost + surcharge;

    const saleId = await db.transaction(async (tx) => {
      if (shared_cart_token?.trim()) {
        const locked = await tx.execute(sql`SELECT id FROM shared_carts WHERE token = ${shared_cart_token.trim()} AND status = 'pendiente' AND (expires_at IS NULL OR expires_at > now()) FOR UPDATE`);
        if (!locked.rows.length) throw Object.assign(new Error("Este enlace ya fue utilizado o venció."), { statusCode: 409 });
      }
      const [customerRow] = await tx
        .insert(customers)
        .values({
          name: customer.name.trim().slice(0, 100),
          phone: customer.phone.trim().slice(0, 30),
          email: customer.email?.trim().slice(0, 255) || null,
          address: customer.address?.trim().slice(0, 300) || null,
        })
        .returning();

      const [saleRow] = await tx
        .insert(sales)
        .values({
          customerId: customerRow.id,
          paymentMethodId: sale.payment_method_id,
          shippingMethodId: sale.shipping_method_id,
          subtotal: String(subtotal),
          shippingCost: String(shippingCost),
          surcharge: String(surcharge),
          discountAmount: String(discountAmount),
          couponCode: appliedCouponCode,
          total: String(total),
          status: "pendiente",
          source: "public",
          notes: sale.notes?.slice(0, 500) || null,
          shippingPostalCode: sale.shipping_postal_code,
          shippingProvince: sale.shipping_province,
          shippingLocality: sale.shipping_locality,
          shippingBranchId: sale.shipping_branch_id,
          shippingBranchName: sale.shipping_branch_name,
        })
        .returning();

      const slugs = Array.from(new Set(items.map((it) => it.product_slug?.trim()).filter((s): s is string => !!s)));
      const productsBySlug = new Map<string, { id: string; cost: number }>();
      if (slugs.length) {
        const rows = await tx.select({ id: products.id, slug: products.slug, cost: products.cost }).from(products).where(inArray(products.slug, slugs));
        for (const p of rows) productsBySlug.set(p.slug, { id: p.id, cost: Number(p.cost) || 0 });
      }

      await tx.insert(saleItems).values(
        items.map((it) => {
          const product = it.product_slug ? productsBySlug.get(it.product_slug.trim()) : undefined;
          const units = it.pack_units && it.pack_units > 0 ? it.pack_units : 1;
          return {
            saleId: saleRow.id,
            productId: product?.id ?? null,
            productName: it.product_name.slice(0, 300),
            unitPrice: String(Math.max(0, it.unit_price || 0)),
            unitCost: String(product ? Math.max(0, product.cost * units) : 0),
            quantity: Math.max(1, Math.floor(it.quantity || 1)),
            subtotal: String(Math.max(0, it.subtotal || 0)),
            customStickerConfig: it.custom_sticker_config ?? null,
            addons: it.addons ?? null,
            photos: it.photos?.slice(0, 500).map((u) => u.slice(0, 1000)) ?? null,
          };
        }),
      );

      if (appliedCouponCode) {
        await tx
          .update(coupons)
          .set({ timesUsed: sql`${coupons.timesUsed} + 1` })
          .where(
            and(
              sql`upper(${coupons.code}) = upper(${appliedCouponCode})`,
              eq(coupons.active, true),
              sql`(${coupons.startsAt} is null or ${coupons.startsAt} <= now())`,
              sql`(${coupons.endsAt} is null or ${coupons.endsAt} >= now())`,
              sql`(${coupons.usageLimit} is null or ${coupons.timesUsed} < ${coupons.usageLimit})`,
            ),
          );
      }

      if (shared_cart_token?.trim()) {
        await tx
          .update(sharedCarts)
          .set({ status: "completado", saleId: saleRow.id, completedAt: new Date().toISOString() })
          .where(and(eq(sharedCarts.token, shared_cart_token.trim()), eq(sharedCarts.status, "pendiente")));
      }

      const requestedPacks = items.map(it => it.pack_id).filter((id): id is string => !!id);
      const packs = requestedPacks.length ? await tx.select({ id: productPacks.id, productId: productPacks.productId }).from(productPacks).where(inArray(productPacks.id, requestedPacks)) : [];
      const contents = items.flatMap(it => {
        const product = it.product_slug ? productsBySlug.get(it.product_slug.trim()) : undefined;
        const pack = packs.find(p => p.id === it.pack_id && p.productId === product?.id);
        return pack ? [{ id: `genesis-pack-${pack.id}`, quantity: Math.max(1, Math.floor(it.quantity || 1)) }] : [];
      });
      await savePurchaseSnapshot(tx, saleRow.id, purchaseSnapshot({
        saleId: saleRow.id, customerId: customerRow.id, email: customer.email, total,
        userAgent: req.headers["user-agent"], fbp: parsed.data.tracking?.fbp, fbc: parsed.data.tracking?.fbc,
        origin: env.FRONTEND_ORIGIN, contents,
      }));

      return saleRow.id;
    });

    try {
      await sendAdminOrderNotification(saleId, "new");
    } catch (err) {
      req.log.error({ err }, "send-admin-order-notification (new) failed");
    }

    let transfer: Record<string, string | null> | null = null;
    try {
      const [pm] = await db.select({ name: paymentMethods.name, provider: paymentMethods.provider }).from(paymentMethods).where(eq(paymentMethods.id, sale.payment_method_id)).limit(1);
      if (pm && pm.provider === "manual" && /transfer/i.test(pm.name ?? "")) {
        const [st] = await db
          .select({
            transfer_alias: siteSettings.transferAlias,
            transfer_holder: siteSettings.transferHolder,
            transfer_cbu: siteSettings.transferCbu,
            transfer_bank: siteSettings.transferBank,
            transfer_notes: siteSettings.transferNotes,
          })
          .from(siteSettings)
          .limit(1);
        if (st) transfer = st;
      }
    } catch (err) {
      req.log.error({ err }, "transfer details lookup failed");
    }

    return { sale_id: saleId, total, discount_amount: discountAmount, coupon_code: appliedCouponCode, transfer };
  });
}
