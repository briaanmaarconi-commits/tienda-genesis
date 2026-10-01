// Runnable (plain JS) counterpart of migrate-data-rest.ts — the production
// container only ships runtime deps (no tsx), so this is what actually runs
// inside genesis-api. Keep in sync with the .ts version.
import pg from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL");
  process.exit(1);
}

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

const JSONB_COLUMNS = {
  site_settings: ["info_faqs"],
  sale_items: ["custom_sticker_config", "addons", "photos"],
};

async function fetchAll(table) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Range: `${offset}-${offset + pageSize - 1}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok && res.status !== 206) {
      throw new Error(`fetch ${table} failed: ${res.status} ${await res.text()}`);
    }
    const page = await res.json();
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
