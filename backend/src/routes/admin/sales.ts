import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sales, saleItems, customers } from "../../db/schema.js";
import { sendShippingEmail } from "../../email/sendShippingEmail.js";

type LineItem = { product_id: string | null; product_name: string; unit_price: number; quantity: number; unit_cost: number };

export async function registerAdminSaleRoutes(app: FastifyInstance) {
  app.get("/sales", async (req) => {
    const { status, from, to } = req.query as { status?: string; from?: string; to?: string };
    const conditions = [];
    if (status) conditions.push(eq(sales.status, status as (typeof sales.status.enumValues)[number]));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));

    const list = await db.query.sales.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: {
        customer: { columns: { id: true, name: true, phone: true, email: true } },
        paymentMethod: { columns: { name: true } },
        shippingMethod: { columns: { name: true } },
        saleItems: {
          columns: { id: true, productId: true, productName: true, unitPrice: true, unitCost: true, quantity: true, subtotal: true },
        },
      },
    });
    // Note: free-text customer search is applied client-side in the admin UI
    // against this same result set, matching the original frontend behavior.
    // `items` matches the old Supabase alias (items:sale_items(...)).
    return list.map((s) => ({ ...s, items: s.saleItems, saleItems: undefined }));
  });

  app.get("/sales/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: { customer: true, paymentMethod: true, shippingMethod: true, saleItems: true },
    });
    if (!sale) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    return { ...sale, items: sale.saleItems, saleItems: undefined };
  });

  app.post("/sales", async (req) => {
    const body = req.body as {
      customer_id: string;
      new_customer?: { name: string; phone?: string; email?: string; address?: string };
      payment_method_id: string | null;
      shipping_method_id: string | null;
      shipping_cost: number;
      surcharge_pct: number;
      status: string;
      notes: string | null;
      items: LineItem[];
    };

    const created = await db.transaction(async (tx) => {
      let customerId = body.customer_id;
      if (customerId === "__new__" && body.new_customer) {
        const [c] = await tx.insert(customers).values(body.new_customer).returning();
        customerId = c.id;
      }

      const subtotal = body.items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);
      const surcharge = body.payment_method_id ? subtotal * (body.surcharge_pct / 100) : 0;
      const shippingCost = body.shipping_method_id ? body.shipping_cost : 0;
      const total = subtotal + surcharge + shippingCost;

      const [sale] = await tx
        .insert(sales)
        .values({
          customerId,
          paymentMethodId: body.payment_method_id,
          shippingMethodId: body.shipping_method_id,
          subtotal: String(subtotal),
          shippingCost: String(shippingCost),
          surcharge: String(surcharge),
          total: String(total),
          status: body.status as (typeof sales.status.enumValues)[number],
          source: "admin",
          notes: body.notes,
        })
        .returning();

      if (body.items.length) {
        await tx.insert(saleItems).values(
          body.items.map((it) => ({
            saleId: sale.id,
            productId: it.product_id,
            productName: it.product_name,
            unitPrice: String(it.unit_price),
            unitCost: String(it.unit_cost),
            quantity: it.quantity,
            subtotal: String(it.unit_price * it.quantity),
          })),
        );
      }

      return sale;
    });

    return created;
  });

  app.put("/sales/:id/status", async (req) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };
    const [row] = await db
      .update(sales)
      .set({ status: status as (typeof sales.status.enumValues)[number], updatedAt: new Date().toISOString() })
      .where(eq(sales.id, id))
      .returning();
    return row;
  });

  // Mirrors AdminSales.tsx's confirmTracking(): sets status to "enviada" +
  // tracking info, then emails the customer only if they have an email.
  app.post("/sales/:id/confirm-tracking", async (req) => {
    const { id } = req.params as { id: string };
    const { tracking_code, tracking_carrier } = req.body as { tracking_code: string; tracking_carrier: string };

    const [row] = await db
      .update(sales)
      .set({ status: "enviada", trackingCode: tracking_code.trim(), trackingCarrier: tracking_carrier, updatedAt: new Date().toISOString() })
      .where(eq(sales.id, id))
      .returning();

    const [withCustomer] = await db
      .select({ email: customers.email })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(sales.id, id))
      .limit(1);

    let emailResult: Awaited<ReturnType<typeof sendShippingEmail>> | null = null;
    if (withCustomer?.email) {
      emailResult = await sendShippingEmail(id);
    }
    return { sale: row, emailResult };
  });

  // Mirrors SaleDetailDialog.tsx's save(): general status/notes/tracking edit,
  // emailing only on a pendiente/confirmada/etc → "enviada" transition with a
  // tracking code and a customer email already on file.
  app.put("/sales/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status: string; notes: string | null; tracking_code: string | null; tracking_carrier: string | null };

    const [before] = await db.select({ status: sales.status }).from(sales).where(eq(sales.id, id)).limit(1);
    const becomesEnviada = body.status === "enviada" && before?.status !== "enviada";

    const [row] = await db
      .update(sales)
      .set({
        status: body.status as (typeof sales.status.enumValues)[number],
        notes: body.notes,
        trackingCode: body.tracking_code || null,
        trackingCarrier: body.tracking_carrier || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sales.id, id))
      .returning();

    let emailResult: Awaited<ReturnType<typeof sendShippingEmail>> | null = null;
    if (becomesEnviada && body.tracking_code?.trim()) {
      const [withCustomer] = await db
        .select({ email: customers.email })
        .from(sales)
        .leftJoin(customers, eq(sales.customerId, customers.id))
        .where(eq(sales.id, id))
        .limit(1);
      if (withCustomer?.email) emailResult = await sendShippingEmail(id);
    }

    return { sale: row, emailResult };
  });

  // Mirrors SaleDetailDialog.tsx's resend(): unconditional resend given a
  // tracking code, regardless of whether it actually changed.
  app.post("/sales/:id/resend-shipping-email", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { tracking_code, tracking_carrier } = req.body as { tracking_code: string; tracking_carrier: string };

    if (!tracking_code?.trim()) {
      reply.code(400).send({ error: "tracking_code_required" });
      return;
    }

    await db
      .update(sales)
      .set({ trackingCode: tracking_code, trackingCarrier: tracking_carrier, updatedAt: new Date().toISOString() })
      .where(eq(sales.id, id));

    return sendShippingEmail(id);
  });

  app.delete("/sales/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(sales).where(eq(sales.id, id));
    return { ok: true };
  });
}
