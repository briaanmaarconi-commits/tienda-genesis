-- Run once, right after migrate-storage.ts finishes copying files into
-- genesis-api's volume, against genesis-db. Public-bucket columns stored the
-- *full* Supabase public URL (confirmed in the old src/lib/helpers.ts), so
-- every reference needs rewriting to the new backend's /files/public/ path.
-- Private-bucket columns (sale_items.photos, custom_sticker_config->>file_url)
-- already store bare object paths and need no rewrite.
--
-- Replace <OLD_SUPABASE_HOST> with the live project's storage host, e.g.
-- fshtsltrorevykpwhnbu.supabase.co, and <NEW_PUBLIC_ORIGIN> with genesis-api's
-- real public origin (https://genesisqr.com once nginx is proxying).

UPDATE banners
SET image_url = replace(image_url, 'https://<OLD_SUPABASE_HOST>/storage/v1/object/public/banners/', '<NEW_PUBLIC_ORIGIN>/files/public/banners/')
WHERE image_url LIKE 'https://<OLD_SUPABASE_HOST>%';

UPDATE product_images
SET url = replace(url, 'https://<OLD_SUPABASE_HOST>/storage/v1/object/public/products/', '<NEW_PUBLIC_ORIGIN>/files/public/products/')
WHERE url LIKE 'https://<OLD_SUPABASE_HOST>%';

UPDATE product_stickers
SET image_url = replace(image_url, 'https://<OLD_SUPABASE_HOST>/storage/v1/object/public/products/', '<NEW_PUBLIC_ORIGIN>/files/public/products/')
WHERE image_url LIKE 'https://<OLD_SUPABASE_HOST>%';

UPDATE site_settings
SET logo_url = replace(logo_url, 'https://<OLD_SUPABASE_HOST>/storage/v1/object/public/branding/', '<NEW_PUBLIC_ORIGIN>/files/public/branding/')
WHERE logo_url LIKE 'https://<OLD_SUPABASE_HOST>%';

-- Sanity check after running: should return 0 rows.
-- SELECT 'banners' t, count(*) FROM banners WHERE image_url LIKE '%supabase.co%'
-- UNION ALL SELECT 'product_images', count(*) FROM product_images WHERE url LIKE '%supabase.co%'
-- UNION ALL SELECT 'product_stickers', count(*) FROM product_stickers WHERE image_url LIKE '%supabase.co%'
-- UNION ALL SELECT 'site_settings', count(*) FROM site_settings WHERE logo_url LIKE '%supabase.co%';
