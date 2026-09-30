import { API_BASE } from "@/lib/api";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

async function upload(path: string, bucket: string, file: File): Promise<{ url?: string; path?: string }> {
  const form = new FormData();
  form.append("bucket", bucket);
  form.append("file", file);
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: form, credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Error al subir el archivo");
  return data;
}

/** Admin-only upload (banners/branding/products catalog images). Returns the public URL. */
export const uploadImage = async (bucket: string, file: File) => {
  const { url } = await upload("/admin/uploads", bucket, file);
  if (!url) throw new Error("Error al subir el archivo");
  return url;
};

/** Unauthenticated customer upload (custom-sticker-uploads / customer-photos). */
export const uploadPublicFile = async (bucket: string, file: File) => {
  return upload("/uploads", bucket, file);
};
