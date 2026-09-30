import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, extname } from "node:path";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import { env } from "../env.js";

// Mirrors the 6 Supabase Storage buckets. Public buckets are served straight
// off disk; private buckets are only reachable via a signed URL.
// `custom-sticker-uploads` is private — the original frontend stored the bare
// object path and only ever resolved it to a signed URL for admin viewing
// (see SaleDetailDialog.tsx's signStorageFiles), same as customer-photos.
export const PUBLIC_BUCKETS = ["banners", "branding", "products"] as const;
export const PRIVATE_BUCKETS = ["customer-photos", "custom-sticker-uploads"] as const;

export type Bucket = (typeof PUBLIC_BUCKETS)[number] | (typeof PRIVATE_BUCKETS)[number];

const ALL_BUCKETS: readonly string[] = [...PUBLIC_BUCKETS, ...PRIVATE_BUCKETS];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB, matches CustomStickerConfigurator's client-side cap
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
// custom-sticker-uploads also accepts print-ready artwork (matches the old
// frontend's ACCEPTED list in CustomStickerConfigurator.tsx).
const ARTWORK_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ".svg", ".pdf", ".ai", ".eps"]);

function allowedExtensions(bucket: Bucket): Set<string> {
  return bucket === "custom-sticker-uploads" ? ARTWORK_EXTENSIONS : IMAGE_EXTENSIONS;
}

export function isValidBucket(bucket: string): bucket is Bucket {
  return ALL_BUCKETS.includes(bucket);
}

export function isPublicBucket(bucket: string): boolean {
  return (PUBLIC_BUCKETS as readonly string[]).includes(bucket);
}

function bucketDir(bucket: string): string {
  return join(env.STORAGE_DIR, bucket);
}

// Server-side replacement for the size/type checks the old client only
// enforced in the browser — there's no Storage-RLS safety net anymore.
export async function saveUpload(bucket: Bucket, filename: string, data: Buffer): Promise<string> {
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("file_too_large");
  }
  const ext = extname(filename).toLowerCase();
  if (!allowedExtensions(bucket).has(ext)) {
    throw new Error("unsupported_file_type");
  }

  const dir = bucketDir(bucket);
  await mkdir(dir, { recursive: true });
  const path = `${randomUUID()}${ext}`;
  await writeFile(join(dir, path), data);
  return path;
}

export function publicUrl(bucket: Bucket, path: string): string {
  return `${env.PUBLIC_ORIGIN}/files/public/${bucket}/${path}`;
}

// HMAC-signed URL scheme replacing Supabase's createSignedUrls() for the
// private customer-photos bucket.
export function signPrivateUrl(bucket: Bucket, path: string, ttlSeconds = 60 * 60): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(bucket, path, exp);
  return `${env.PUBLIC_ORIGIN}/files/private/${bucket}/${path}?exp=${exp}&sig=${sig}`;
}

function sign(bucket: string, path: string, exp: number): string {
  return createHmac("sha256", env.FILE_SIGNING_SECRET).update(`${bucket}:${path}:${exp}`).digest("hex");
}

// Replaces `storageFiles.ts`'s `signStorageFiles()`: bulk-sign a list of
// stored values (paths or legacy full URLs) for a private bucket, admin-only.
export function signPrivateUrls(bucket: Bucket, values: string[], ttlSeconds = 60 * 60): Record<string, string> {
  const clean = Array.from(new Set(values.filter(Boolean)));
  const out: Record<string, string> = {};
  for (const value of clean) {
    const path = toStoragePath(bucket, value);
    out[value] = signPrivateUrl(bucket, path, ttlSeconds);
  }
  return out;
}

export function verifyPrivateUrl(bucket: string, path: string, exp: number, sig: string): boolean {
  if (Date.now() / 1000 > exp) return false;
  const expected = Buffer.from(sign(bucket, path, exp));
  const provided = Buffer.from(sig);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

// Replaces `storageFiles.ts`'s `toStoragePath()`: old DB rows may hold a full
// Supabase public/signed URL rather than a bare object path — normalise both
// down to the path this backend expects.
export function toStoragePath(bucket: string, value: string): string {
  if (!value) return value;
  try {
    const url = new URL(value);
    const marker = `/${bucket}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx >= 0) return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    // not a URL — fall through to bare-path handling below
  }
  return value.startsWith(`${bucket}/`) ? value.slice(bucket.length + 1) : value;
}

export async function registerStorage(app: FastifyInstance) {
  await mkdir(env.STORAGE_DIR, { recursive: true });

  // Registered only to get the `reply.sendFile()` decorator; its own prefix
  // is never linked anywhere so it serves nothing on its own. Each call to
  // sendFile() below passes an explicit root to serve from instead.
  app.register(fastifyStatic, {
    root: env.STORAGE_DIR,
    prefix: "/files/_internal/",
  });

  for (const bucket of PUBLIC_BUCKETS) {
    const dir = bucketDir(bucket);
    await mkdir(dir, { recursive: true });
    app.register(fastifyStatic, {
      root: dir,
      prefix: `/files/public/${bucket}/`,
      decorateReply: false,
      immutable: true,
      maxAge: "30d",
    });
  }

  app.get("/files/private/:bucket/:path", async (req, reply) => {
    const { bucket, path } = req.params as { bucket: string; path: string };
    const { exp, sig } = req.query as { exp?: string; sig?: string };

    if (!isValidBucket(bucket) || isPublicBucket(bucket) || !exp || !sig) {
      reply.code(404).send();
      return;
    }
    if (!verifyPrivateUrl(bucket, path, Number(exp), sig)) {
      reply.code(403).send({ error: "expired_or_invalid_signature" });
      return;
    }
    return reply.sendFile(path, bucketDir(bucket));
  });

  // Unauthenticated uploads, matching the exact whitelist RLS used to enforce
  // on storage.objects for anon inserts: only these two buckets, nothing else.
  app.post("/api/uploads", async (req, reply) => uploadHandler(req, reply, ["custom-sticker-uploads", "customer-photos"]));
}

export async function uploadHandler(req: FastifyRequest, reply: FastifyReply, allowedBuckets: readonly string[]) {
  const file = await req.file();
  if (!file) {
    reply.code(400).send({ error: "no_file" });
    return;
  }
  const bucketField = file.fields?.bucket as { value?: string } | { value?: string }[] | undefined;
  const bucket = Array.isArray(bucketField) ? bucketField[0]?.value : bucketField?.value;

  if (!bucket || !allowedBuckets.includes(bucket) || !isValidBucket(bucket)) {
    reply.code(400).send({ error: "invalid_bucket" });
    return;
  }

  try {
    const buf = await file.toBuffer();
    const path = await saveUpload(bucket, file.filename, buf);
    if (isPublicBucket(bucket)) {
      reply.send({ url: publicUrl(bucket, path) });
    } else {
      reply.send({ path });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload_failed";
    reply.code(400).send({ error: message });
  }
}
