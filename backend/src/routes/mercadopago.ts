import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { sales, customers, saleItems } from "../db/schema.js";
import { sendOrderConfirmation } from "../email/sendOrderConfirmation.js";
import { sendAdminOrderNotification } from "../email/sendAdminOrderNotification.js";
import { markPurchasePaid } from "../lib/purchaseTracking.js";
import { verifiedMpPurchase } from "../lib/purchaseEvent.js";

type MpItem = { title: string; quantity: number; unit_price: number; currency_id: "ARS" };

export async function registerMercadoPagoRoutes(app: FastifyInstance) {
  app.post("/api/mercadopago/create-preference", async (req, reply) => {
    const { sale_id } = req.body as { sale_id?: string };
    if (!sale_id) {
      reply.code(400).send({ error: "sale_id requerido" });
      return;
    }

    const [sale] = await db
      .select({
        id: sales.id,
        shippingCost: sales.shippingCost,
        surcharge: sales.surcharge,
        discountAmount: sales.discountAmount,
        customerName: customers.name,
        customerEmail: customers.email,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(sales.id, sale_id))
      .limit(1);
    if (!sale) {
      reply.code(404).send({ error: "Venta no encontrada" });
      return;
    }

    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, sale_id));

    const origin = (req.headers.origin as string) || env.FRONTEND_ORIGIN;
    const mpItems: MpItem[] = [];
    for (const it of items) {
      const qty = it.quantity || 1;
      const unit = Number(it.unitPrice) || 0;
      const subtotal = Number(it.subtotal) || unit * qty;
      mpItems.push({ title: it.productName.slice(0, 250), quantity: qty, unit_price: unit, currency_id: "ARS" });

      const extras = Math.max(0, Math.round((subtotal - unit * qty) * 100) / 100);
      if (extras > 0) {
        const addons = Array.isArray(it.addons) ? (it.addons as Array<{ option_name?: string; group_name?: string }>) : [];
        const addonLabels = addons.map((a) => a?.option_name || a?.group_name).filter(Boolean).join(", ");
        mpItems.push({ title: `Adicionales${addonLabels ? ` - ${addonLabels}` : ""} (${it.productName})`.slice(0, 250), quantity: 1, unit_price: extras, currency_id: "ARS" });
      }
    }

    const shippingCost = Number(sale.shippingCost ?? 0);
    if (shippingCost > 0) mpItems.push({ title: "Envío", quantity: 1, unit_price: shippingCost, currency_id: "ARS" });
    const surcharge = Number(sale.surcharge ?? 0);
    if (surcharge > 0) mpItems.push({ title: "Recargo", quantity: 1, unit_price: surcharge, currency_id: "ARS" });
    const discount = Number(sale.discountAmount ?? 0);
    if (discount > 0) mpItems.push({ title: "Descuento", quantity: 1, unit_price: -discount, currency_id: "ARS" });

    const body = {
      items: mpItems,
      payer: sale.customerEmail ? { name: sale.customerName, email: sale.customerEmail } : { name: sale.customerName },
      external_reference: sale.id,
      back_urls: {
        success: `${origin}/pago/exito?sale_id=${sale.id}`,
        failure: `${origin}/pago/error?sale_id=${sale.id}`,
        pending: `${origin}/pago/pendiente?sale_id=${sale.id}`,
      },
      auto_return: "approved",
      notification_url: `${env.PUBLIC_ORIGIN}/api/mercadopago/webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
      body: JSON.stringify(body),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      reply.code(502).send({ error: `MP error: ${JSON.stringify(mpData)}` });
      return;
    }

    await db.update(sales).set({ mpPreferenceId: mpData.id }).where(eq(sales.id, sale.id));

    return { init_point: mpData.init_point, sandbox_init_point: mpData.sandbox_init_point, preference_id: mpData.id };
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/mercadopago/webhook",
    handler: async (req, reply) => {
      const query = req.query as Record<string, string>;
      let paymentId: string | undefined = query["data.id"] || query.id;
      let topic: string | undefined = query.type || query.topic;

      if (req.method === "POST") {
        const body = req.body as { data?: { id?: string }; id?: string; type?: string; topic?: string } | undefined;
        paymentId = paymentId || body?.data?.id || body?.id;
        topic = topic || body?.type || body?.topic;
      }

      req.log.info({ topic, paymentId }, "mp-webhook");

      if (topic !== "payment" || !paymentId) {
        reply.send("ok");
        return;
      }

      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const pay = await payRes.json();
      if (!payRes.ok) {
        reply.code(502).send({ error: `MP get payment failed: ${JSON.stringify(pay)}` });
        return;
      }

      const saleId: string | undefined = pay.external_reference;
      const status: string = pay.status;
      if (!saleId) {
        reply.send("ok no ref");
        return;
      }

      const newStatus = status === "approved" ? "abonado" : status === "rejected" || status === "cancelled" ? "cancelada" : undefined;

      if (!/^[0-9a-f-]{36}$/i.test(saleId)) return reply.send("ok invalid ref");
      const prev = await db.transaction(async tx => {
        const [before] = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1).for("update");
        if (!before) return undefined;
        const confirmed = verifiedMpPurchase(pay, Number(before.total));
        if (status === "approved" && !confirmed) {
          req.log.warn({ saleId }, "MP approved payment does not match a live ARS order total");
          return undefined;
        }
        // Old notifications for another payment attempt must not cancel a paid order.
        if (before.mpStatus === "approved" && !confirmed) return undefined;
        const keepFulfillment = ["confirmada", "enviada", "entregada"].includes(before.status);
        await tx.update(sales).set({ mpPaymentId: String(paymentId), mpStatus: status,
          ...(newStatus && !(confirmed && keepFulfillment) ? { status: newStatus } : {}),
        }).where(eq(sales.id, saleId));
        if (confirmed) await markPurchasePaid(tx, saleId);
        return before;
      });

      if (prev && newStatus === "abonado" && prev.mpStatus !== "approved") {
        try {
          await sendOrderConfirmation(saleId);
        } catch (err) {
          req.log.error({ err }, "send-order-confirmation failed");
        }
        try {
          await sendAdminOrderNotification(saleId, "paid");
        } catch (err) {
          req.log.error({ err }, "send-admin-order-notification (paid) failed");
        }
      }

      reply.send("ok");
    },
  });
}
