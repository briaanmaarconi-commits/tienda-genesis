import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, productImages, productPacks } from "../../db/schema.js";

const ImageInput = z.object({
  url: z.string(),
  focal_x: z.number().nullable().optional(),
  focal_y: z.number().nullable().optional(),
  zoom: z.number().nullable().optional(),
  fit: z.string().nullable().optional(),
});

const PackInput = z.object({
  units: z.number().nullable().optional(),
  label: z.string().nullable().optional(),
  price: z.number(),
  photos_required: z.number().nullable().optional(),
  compare_at_price: z.number().nullable().optional(),
  sale_starts_at: z.string().nullable().optional(),
  sale_ends_at: z.string().nullable().optional(),
});

const ProductBody = z.object({
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  price: z.number(),
  cost: z.number().optional().default(0),
  category_id: z.string().nullable().optional(),
  compare_at_price: z.number().nullable().optional(),
  sale_starts_at: z.string().nullable().optional(),
  sale_ends_at: z.string().nullable().optional(),
  stock: z.number(),
  featured: z.boolean(),
  active: z.boolean(),
  product_type: z.enum(["standard", "stickers"]),
  images: z.array(ImageInput).default([]),
  packs: z.array(PackInput).default([]),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export async function registerAdminProductRoutes(app: FastifyInstance) {
  app.get("/products", async () => {
    const list = await db.query.products.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: {
        category: true,
        productImages: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
        productPacks: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
      },
    });
    // Matches the old Supabase alias names (images/packs) the frontend expects.
    return list.map((p) => ({ ...p, images: p.productImages, packs: p.productPacks, productImages: undefined, productPacks: undefined }));
  });

  app.post("/products", async (req, reply) => {
    const parsed = ProductBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const p = parsed.data;

    const created = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: p.name,
          slug: p.slug?.trim() || slugify(p.name),
          description: p.description ?? "",
          price: String(p.price),
          cost: String(p.cost),
          categoryId: p.category_id,
          compareAtPrice: p.compare_at_price != null ? String(p.compare_at_price) : null,
          saleStartsAt: p.sale_starts_at,
          saleEndsAt: p.sale_ends_at,
          stock: p.stock,
          featured: p.featured,
          active: p.active,
          productType: p.product_type,
        })
        .returning();

      await insertImagesAndPacks(tx, product.id, p.images, p.packs);
      return product;
    });

    return created;
  });

  app.put("/products/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ProductBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const p = parsed.data;

    const updated = await db.transaction(async (tx) => {
      const [product] = await tx
        .update(products)
        .set({
          name: p.name,
          slug: p.slug?.trim() || slugify(p.name),
          description: p.description ?? "",
          price: String(p.price),
          cost: String(p.cost),
          categoryId: p.category_id,
          compareAtPrice: p.compare_at_price != null ? String(p.compare_at_price) : null,
          saleStartsAt: p.sale_starts_at,
          saleEndsAt: p.sale_ends_at,
          stock: p.stock,
          featured: p.featured,
          active: p.active,
          productType: p.product_type,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(products.id, id))
        .returning();

      await tx.delete(productImages).where(eq(productImages.productId, id));
      await tx.delete(productPacks).where(eq(productPacks.productId, id));
      await insertImagesAndPacks(tx, id, p.images, p.packs);
      return product;
    });

    return updated;
  });

  app.delete("/products/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(products).where(eq(products.id, id));
    return { ok: true };
  });
}

async function insertImagesAndPacks(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  images: z.infer<typeof ImageInput>[],
  packs: z.infer<typeof PackInput>[],
) {
  if (images.length) {
    await tx.insert(productImages).values(
      images.map((img, i) => ({
        productId,
        url: img.url,
        sortOrder: i,
        focalX: String(img.focal_x ?? 50),
        focalY: String(img.focal_y ?? 50),
        zoom: String(img.zoom ?? 1),
        fit: img.fit ?? "cover",
      })),
    );
  }

  const validPacks = packs.filter((p) => (p.units ?? 0) > 0 || !!p.label?.trim());
  if (validPacks.length) {
    await tx.insert(productPacks).values(
      validPacks.map((pack, i) => ({
        productId,
        units: pack.units ?? null,
        label: pack.label?.trim() || null,
        price: String(pack.price || 0),
        photosRequired: pack.photos_required ?? null,
        compareAtPrice: pack.compare_at_price != null ? String(pack.compare_at_price) : null,
        saleStartsAt: pack.sale_starts_at ?? null,
        saleEndsAt: pack.sale_ends_at ?? null,
        sortOrder: i,
      })),
    );
  }
}
