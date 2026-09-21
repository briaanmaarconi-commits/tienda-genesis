UPDATE public.product_images
SET url = 'https://ezvbqnpahgelmqvefqsw.supabase.co/storage/v1/object/public/products/stickers-cover-v2.jpg',
    focal_x = 0.5, focal_y = 0.5, zoom = 1, fit = 'cover'
WHERE product_id = (SELECT id FROM public.products WHERE slug = 'stickers')
  AND sort_order = 0;