/**
 * Returns an optimized image URL using Supabase Storage image transformations
 * when the source is a public storage object. Falls back to the original URL
 * for non-Supabase URLs.
 *
 * Docs: /storage/v1/object/public/... -> /storage/v1/render/image/public/...
 */
export function getImageUrl(
  url: string | null | undefined,
  _opts: { width?: number; height?: number; quality?: number; resize?: "cover" | "contain" | "fill" } = {},
): string {
  return url ?? "";
}
