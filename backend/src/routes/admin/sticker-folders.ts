import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { productStickerFolders, productStickers } from "../../db/schema.js";
import { saveUpload, publicUrl } from "../../storage/index.js";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const StickerInput = z.object({
  id: z.string().optional(),
  name: z.string(),
  image_url: z.string().nullable().optional(),
  active: z.boolean(),
});

const FolderInput = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  active: z.boolean(),
  stickers: z.array(StickerInput).default([]),
});

const SaveAllBody = z.object({
  product_id: z.string(),
  folders: z.array(FolderInput),
});

export async function registerAdminStickerFolderRoutes(app: FastifyInstance) {
  app.get("/sticker-folders", async (req) => {
    const { product_id } = req.query as { product_id: string };
    const folders = await db.query.productStickerFolders.findMany({
      where: eq(productStickerFolders.productId, product_id),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
      with: { productStickers: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
    });
    // Matches the old Supabase alias (stickers:product_stickers(...)).
    return folders.map((f) => ({ ...f, stickers: f.productStickers, productStickers: undefined }));
  });

  // Diff-by-id-presence save, mirroring StickerFoldersEditor.saveAll(): rows
  // with an id are updated in place, rows without one are inserted. Deletions
  // happen immediately via the dedicated DELETE routes below, not here.
  app.put("/sticker-folders", async (req, reply) => {
    const parsed = SaveAllBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const { product_id, folders } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const savedFolders = [];
      for (let fi = 0; fi < folders.length; fi++) {
        const f = folders[fi];
        if (!f.name.trim()) continue;

        let folderId = f.id;
        if (folderId) {
          await tx
            .update(productStickerFolders)
            .set({ name: f.name.trim(), slug: f.slug || slugify(f.name), sortOrder: fi, active: f.active, updatedAt: new Date().toISOString() })
            .where(eq(productStickerFolders.id, folderId));
        } else {
          const [created] = await tx
            .insert(productStickerFolders)
            .values({ productId: product_id, name: f.name.trim(), slug: f.slug || slugify(f.name), sortOrder: fi, active: f.active })
            .returning();
          folderId = created.id;
        }

        const savedStickers = [];
        for (let si = 0; si < f.stickers.length; si++) {
          const s = f.stickers[si];
          if (!s.name.trim()) continue;
          if (s.id) {
            const [updated] = await tx
              .update(productStickers)
              .set({ name: s.name.trim(), imageUrl: s.image_url, sortOrder: si, active: s.active, updatedAt: new Date().toISOString() })
              .where(eq(productStickers.id, s.id))
              .returning();
            savedStickers.push(updated);
          } else {
            const [created] = await tx
              .insert(productStickers)
              .values({ folderId, name: s.name.trim(), imageUrl: s.image_url, sortOrder: si, active: s.active })
              .returning();
            savedStickers.push(created);
          }
        }
        savedFolders.push({ folderId, stickers: savedStickers });
      }
      return savedFolders;
    });

    return result;
  });

  app.delete("/sticker-folders/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(productStickerFolders).where(eq(productStickerFolders.id, id));
    return { ok: true };
  });

  app.delete("/stickers/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(productStickers).where(eq(productStickers.id, id));
    return { ok: true };
  });

  // Sequential multi-file upload: one uploaded image -> one product_stickers
  // row per file, named from the filename. Mirrors bulkUploadStickers()'s
  // per-file try/catch (a failed file is skipped, not fatal to the batch).
  app.post("/stickers/bulk-upload", async (req, reply) => {
    const parts = req.parts();
    let folderId: string | undefined;
    const files: { filename: string; buffer: Buffer }[] = [];

    for await (const part of parts) {
      if (part.type === "file") {
        files.push({ filename: part.filename, buffer: await part.toBuffer() });
      } else if (part.fieldname === "folder_id") {
        folderId = part.value as string;
      }
    }

    if (!folderId) {
      reply.code(400).send({ error: "folder_id_required" });
      return;
    }

    files.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));

    let sortCounter = (await db.select().from(productStickers).where(eq(productStickers.folderId, folderId))).length;

    const created: unknown[] = [];
    const errors: { filename: string; error: string }[] = [];

    for (const file of files) {
      try {
        const path = await saveUpload("products", file.filename, file.buffer);
        const url = publicUrl("products", path);
        const name = file.filename.replace(/\.[^.]+$/, "").trim() || `Sticker ${sortCounter + 1}`;
        const [row] = await db
          .insert(productStickers)
          .values({ folderId, name, imageUrl: url, sortOrder: sortCounter, active: true })
          .returning();
        created.push(row);
        sortCounter += 1;
      } catch (err) {
        errors.push({ filename: file.filename, error: err instanceof Error ? err.message : "upload_failed" });
      }
    }

    return { created, errors };
  });
}
