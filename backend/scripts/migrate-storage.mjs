// Runnable (plain JS) counterpart of migrate-storage.ts — the production
// container only ships runtime deps (no tsx), so this is what actually runs
// inside genesis-api. Keep in sync with the .ts version.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT_DIR = process.env.OUT_DIR ?? "./storage-copy";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BUCKETS = ["banners", "branding", "products", "customer-photos", "custom-sticker-uploads"];

async function listAll(bucket) {
  const paths = [];
  async function walk(prefix) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix} failed: ${res.status} ${await res.text()}`);
    const items = await res.json();
    for (const item of items) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        await walk(fullPath);
      } else {
        paths.push(fullPath);
      }
    }
  }
  await walk("");
  return paths;
}

async function downloadTo(bucket, path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`download ${bucket}/${path} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = join(OUT_DIR, bucket, path);
  await mkdir(join(dest, ".."), { recursive: true });
  await writeFile(dest, buf);
}

async function main() {
  let total = 0;
  const failures = [];
  for (const bucket of BUCKETS) {
    const paths = await listAll(bucket);
    console.log(`${bucket}: ${paths.length} files`);
    for (const path of paths) {
      try {
        await downloadTo(bucket, path);
        total++;
      } catch (err) {
        failures.push(`${bucket}/${path}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  console.log(`Downloaded ${total} files to ${OUT_DIR}`);
  if (failures.length) {
    console.log(`${failures.length} failures:`);
    for (const f of failures) console.log(`  ${f}`);
  }
}

main();
