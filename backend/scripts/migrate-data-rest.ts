// One-off: copies the 25 shared business tables from the live Supabase
// project into genesis-db, using the PostgREST API (service_role key) instead
// of a direct Postgres connection — avoids ever handling the Supabase DB's
// own superuser password.
//
// Deliberately excludes `users` and `user_roles`: those reference Supabase's
// auth.users ids, which have no counterpart in genesis-db's new `users` table
// (populated fresh by the first real Google login). `site_settings_public`
// is a view, not a table — skipped.
//
// Run inside the genesis-api container (has DATABASE_URL + network access to
// genesis-db already, plus outbound internet to reach Supabase):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-data-rest.ts

import pg from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL");
  process.exit(1);
}

// Dependency order (parents before children) — belt and suspenders since we
// also run with session_replication_role=replica during load.
const TABLES = [
  "site_settings",
  "categories",
  "payment_methods",
  "customers",
  "shipping_methods",
  "sticker_shapes",
  "sticker_materials",
  "sticker_finishes",
  "sticker_sizes",
  "sticker_quantities",
  "expenses",
  "products",
  "product_packs",
  "product_images",
  "product_sticker_folders",
  "product_stickers",
  "product_addon_groups",
  "product_addon_options",
  "coupons",
  "banners",
  "shipping_rates",
  "free_shipping_rules",
  "local_delivery_zones",
  "sales",
  "sale_items",
];

// jsonb columns need JSON.stringify'd text; everything else (including real
// postgres array columns like local_delivery_zones.postal_codes) is passed
// through as-is and left to pg's own parameter serialization.
const JSONB_COLUMNS: Record<string, string[]> = {
  site_settings: ["info_faqs"],
  sale_items: ["custom_sticker_config", "addons", "photos"],
};

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc`, {
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Range: `${offset}-${offset + pageSize - 1}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok && res.status !== 206) {
      throw new Error(`fetch ${table} failed: ${res.status} ${await res.text()}`);
    }
    const page = (await res.json()) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: false });
  const client = await pool.connect();
  try {
    await client.query("SET session_replication_role = 'replica'");

    for (const table of TABLES) {
      const rows = await fetchAll(table);
      const jsonbCols = new Set(JSONB_COLUMNS[table] ?? []);
      let inserted = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const values = cols.map((c) => {
          const v = row[c];
          if (v !== null && jsonbCols.has(c)) return JSON.stringify(v);
          return v;
        });
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const sql = `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
        await client.query(sql, values);
        inserted++;
      }
      console.log(`${table}: fetched ${rows.length}, inserted ${inserted}`);
    }

    await client.query(
      "SELECT setval(pg_get_serial_sequence('sales','order_number'), COALESCE((SELECT MAX(order_number) FROM sales), 1))"
    );
    console.log("Reset sales.order_number sequence.");
  } finally {
    await client.query("SET session_replication_role = 'origin'");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
