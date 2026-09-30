/** Returns the image URL as-is; no server-side transform is applied. */
export function getImageUrl(
  url: string | null | undefined,
  _opts: { width?: number; height?: number; quality?: number; resize?: "cover" | "contain" | "fill" } = {},
): string {
  return url ?? "";
}
