import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { siteSettings } from "../../db/schema.js";

const UpdateBody = z.object({
  site_name: z.string(),
  logo_url: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  facebook_url: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  shipping_origin_postal_code: z.string().nullable().optional(),
  about_content: z.string().nullable().optional(),
  info_content: z.string().nullable().optional(),
  info_faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  admin_notify_email: z.string().nullable().optional(),
  transfer_alias: z.string().nullable().optional(),
  transfer_holder: z.string().nullable().optional(),
  transfer_cbu: z.string().nullable().optional(),
  transfer_bank: z.string().nullable().optional(),
  transfer_notes: z.string().nullable().optional(),
});

export async function registerAdminSiteSettingsRoutes(app: FastifyInstance) {
  app.get("/site-settings", async () => {
    const [row] = await db.select().from(siteSettings).limit(1);
    return row ?? null;
  });

  app.put("/site-settings", async (req, reply) => {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const { id } = req.body as { id?: string };
    if (!id) {
      reply.code(400).send({ error: "id_required" });
      return;
    }

    const [updated] = await db
      .update(siteSettings)
      .set({
        siteName: parsed.data.site_name,
        logoUrl: parsed.data.logo_url,
        phone: parsed.data.phone,
        email: parsed.data.email,
        whatsapp: parsed.data.whatsapp,
        instagramUrl: parsed.data.instagram_url,
        facebookUrl: parsed.data.facebook_url,
        address: parsed.data.address,
        shippingOriginPostalCode: parsed.data.shipping_origin_postal_code,
        aboutContent: parsed.data.about_content,
        infoContent: parsed.data.info_content,
        infoFaqs: parsed.data.info_faqs,
        adminNotifyEmail: parsed.data.admin_notify_email,
        transferAlias: parsed.data.transfer_alias,
        transferHolder: parsed.data.transfer_holder,
        transferCbu: parsed.data.transfer_cbu,
        transferBank: parsed.data.transfer_bank,
        transferNotes: parsed.data.transfer_notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(siteSettings.id, id))
      .returning();

    return updated;
  });

  // AdminMetrics.tsx's saveEmployeePct(): a lone, single-field write separate
  // from the main site-settings form above.
  app.put("/site-settings/employee-profit-pct", async (req) => {
    const { id, employee_profit_pct } = req.body as { id: string; employee_profit_pct: number };
    const [row] = await db
      .update(siteSettings)
      .set({ employeeProfitPct: String(employee_profit_pct) })
      .where(eq(siteSettings.id, id))
      .returning();
    return row;
  });
}
