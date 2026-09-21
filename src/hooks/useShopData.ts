import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSiteSettings = () =>
  useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings_public" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

/** Full row including private fields (bank transfer data). Admins only. */
export const useSiteSettingsAdmin = () =>
  useQuery({
    queryKey: ["site_settings_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });


export const useBanners = (onlyActive = true) =>
  useQuery({
    queryKey: ["banners", onlyActive],
    queryFn: async () => {
      let q = supabase.from("banners").select("*").order("sort_order");
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useProducts = (opts?: { categorySlug?: string; featuredOnly?: boolean; activeOnly?: boolean }) =>
  useQuery({
    queryKey: ["products", opts],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*, category:categories(slug,name), images:product_images(url,sort_order,focal_x,focal_y,zoom,fit), packs:product_packs(id,units,label,price,photos_required,sort_order,compare_at_price,sale_starts_at,sale_ends_at)")
        .order("created_at", { ascending: false });
      if (opts?.activeOnly !== false) q = q.eq("active", true);
      if (opts?.featuredOnly) q = q.eq("featured", true);
      const { data, error } = await q;
      if (error) throw error;
      let list = data ?? [];
      if (opts?.categorySlug) list = list.filter((p: any) => p.category?.slug === opts.categorySlug);
      return list;
    },
  });

export const useProduct = (slug?: string) =>
  useQuery({
    queryKey: ["product", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(slug,name), images:product_images(url,sort_order,focal_x,focal_y,zoom,fit), packs:product_packs(id,units,label,price,photos_required,sort_order,compare_at_price,sale_starts_at,sale_ends_at), sticker_folders:product_sticker_folders(id,name,slug,sort_order,active,stickers:product_stickers(id,name,image_url,sort_order,active)), addon_groups:product_addon_groups(id,name,required,per_unit,is_multiplier,sort_order,active,options:product_addon_options(id,name,extra_price,price_multiplier,sort_order,active))")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
