import { api } from "@/lib/api";

/** Returns a map of original value -> temporary signed URL (admins only). */
export const signStorageFiles = async (
  bucket: string,
  values: string[],
  expiresIn = 60 * 60
): Promise<Record<string, string>> => {
  const clean = Array.from(new Set(values.filter(Boolean)));
  if (clean.length === 0) return {};
  try {
    return await api.post<Record<string, string>>("/admin/storage/sign", { bucket, paths: clean, expires_in: expiresIn });
  } catch {
    return {};
  }
};
