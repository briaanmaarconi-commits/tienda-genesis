import { supabase } from "@/integrations/supabase/client";

/**
 * Customer uploads live in private buckets. We store the object *path* in the
 * database, but older records may hold a full public URL — this normalises both.
 */
export const toStoragePath = (bucket: string, value: string) => {
  if (!value) return value;
  const publicMarker = `/object/public/${bucket}/`;
  const signMarker = `/object/sign/${bucket}/`;
  const pi = value.indexOf(publicMarker);
  if (pi >= 0) return decodeURIComponent(value.slice(pi + publicMarker.length).split("?")[0]);
  const si = value.indexOf(signMarker);
  if (si >= 0) return decodeURIComponent(value.slice(si + signMarker.length).split("?")[0]);
  return value.startsWith(`${bucket}/`) ? value.slice(bucket.length + 1) : value;
};

/** Returns a map of original value -> temporary signed URL (admins only). */
export const signStorageFiles = async (
  bucket: string,
  values: string[],
  expiresIn = 60 * 60
): Promise<Record<string, string>> => {
  const clean = Array.from(new Set(values.filter(Boolean)));
  if (clean.length === 0) return {};
  const paths = clean.map((v) => toStoragePath(bucket, v));
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach((row, i) => {
    if (row.signedUrl) out[clean[i]] = row.signedUrl;
  });
  return out;
};
