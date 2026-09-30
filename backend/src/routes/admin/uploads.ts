import type { FastifyInstance } from "fastify";
import { uploadHandler, signPrivateUrls, isValidBucket, PRIVATE_BUCKETS } from "../../storage/index.js";

export async function registerAdminUploadRoutes(app: FastifyInstance) {
  // Admin panel's ImageUploader (banners/branding/products catalog images).
  app.post("/uploads", async (req, reply) => uploadHandler(req, reply, ["banners", "branding", "products"]));

  // Bulk-sign private customer-uploaded files for admin viewing (sale detail,
  // custom sticker review) — replaces storageFiles.ts's signStorageFiles().
  app.post("/storage/sign", async (req, reply) => {
    const { bucket, paths } = req.body as { bucket?: string; paths?: string[] };
    if (!bucket || !isValidBucket(bucket) || !(PRIVATE_BUCKETS as readonly string[]).includes(bucket) || !Array.isArray(paths)) {
      reply.code(400).send({ error: "invalid_request" });
      return;
    }
    return signPrivateUrls(bucket as (typeof PRIVATE_BUCKETS)[number], paths);
  });
}
