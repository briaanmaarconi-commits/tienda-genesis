#!/usr/bin/env bash
# Superseded by migrate-data-rest.ts: resetting/handling the Supabase DB
# password directly (needed for pg_dump) is blocked in this environment, so
# the actual Fase 5 migration goes through the PostgREST API instead. Kept
# here for reference / for running by hand with your own credentials.
#
# One-off: copies the 25 shared business tables from live Supabase into
# genesis-db. Run this from anywhere with network access to both databases
# (the Supabase side is public; genesis-db is reached via SSH + docker exec
# on the VPS, same pattern used throughout this migration — never exposed
# publicly).
#
# Deliberately excludes `users` and `user_roles` — those reference Supabase's
# auth.users ids, which have no counterpart in genesis-db's new `users` table
# (populated fresh by the first real Google login post-cutover).
#
# Usage: SUPABASE_DB_URL='postgres://postgres:...@db.xxx.supabase.co:5432/postgres' ./migrate-data.sh

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Set SUPABASE_DB_URL (Supabase dashboard -> Settings -> Database -> Connection string, URI, non-pooled)"
  exit 1
fi

VPS="root@177.7.37.52"
VPS_KEY="$HOME/.ssh/mesa_order_vps_ed25519"
CONTAINER="bflpom14uayafubmrn6fiy5j"

TABLES=(
  banners categories coupons customers expenses free_shipping_rules
  local_delivery_zones payment_methods product_addon_groups
  product_addon_options product_images product_packs
  product_sticker_folders product_stickers products sale_items sales
  shipping_methods shipping_rates site_settings sticker_finishes
  sticker_materials sticker_quantities sticker_shapes sticker_sizes
)
# Note: site_settings_public is a VIEW (updates itself), not a table — excluded.

TABLE_ARGS=()
for t in "${TABLES[@]}"; do
  TABLE_ARGS+=(--table="public.$t")
done

echo "Dumping ${#TABLES[@]} tables from Supabase (data only)..."
pg_dump "$SUPABASE_DB_URL" --data-only --disable-triggers "${TABLE_ARGS[@]}" -f /tmp/genesis-data.sql

echo "Copying dump to VPS..."
scp -i "$VPS_KEY" /tmp/genesis-data.sql "$VPS:/tmp/genesis-data.sql"

echo "Restoring into genesis-db..."
ssh -i "$VPS_KEY" "$VPS" "docker cp /tmp/genesis-data.sql $CONTAINER:/tmp/genesis-data.sql && docker exec $CONTAINER psql -U postgres -d genesis -v ON_ERROR_STOP=1 -f /tmp/genesis-data.sql"

echo "Resetting sales.order_number sequence to avoid collisions with new orders..."
ssh -i "$VPS_KEY" "$VPS" "docker exec $CONTAINER psql -U postgres -d genesis -c \"SELECT setval(pg_get_serial_sequence('sales','order_number'), COALESCE((SELECT MAX(order_number) FROM sales), 1))\""

echo "Row counts (genesis-db):"
ssh -i "$VPS_KEY" "$VPS" "docker exec $CONTAINER psql -U postgres -d genesis -c \"
  SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname;
\""

echo "Done. Compare these counts against the same query run on Supabase's SQL editor before trusting the cutover."
