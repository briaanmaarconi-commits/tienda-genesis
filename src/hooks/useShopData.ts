import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useSiteSettings = () =>
  useQuery({
    queryKey: ["site_settings"],
    queryFn: () => api.get<any>("/site-settings"),
  });

/** Full row including private fields (bank transfer data). Admins only. */
export const useSiteSettingsAdmin = () =>
  useQuery({
    queryKey: ["site_settings_admin"],
    queryFn: () => api.get<any>("/admin/site-settings"),
  });

export const useBanners = (onlyActive = true) =>
  useQuery({
    queryKey: ["banners", onlyActive],
    queryFn: () => api.get<any[]>(onlyActive ? "/banners" : "/admin/banners"),
  });

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<any[]>("/categories"),
  });

export const useProducts = (opts?: { categorySlug?: string; featuredOnly?: boolean; activeOnly?: boolean }) =>
  useQuery({
    queryKey: ["products", opts],
    queryFn: async () => {
      const list = await api.get<any[]>(opts?.activeOnly === false ? "/admin/products" : "/products", {
        featured: opts?.featuredOnly ? "true" : undefined,
      });
      return opts?.categorySlug ? list.filter((p) => p.category?.slug === opts.categorySlug) : list;
    },
  });

export const useProduct = (slug?: string) =>
  useQuery({
    queryKey: ["product", slug],
    enabled: !!slug,
    queryFn: () => api.get<any>(`/products/${slug}`),
  });
