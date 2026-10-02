import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type StickerMaterial = { id: string; name: string; base_price: number; sort_order: number; active: boolean };
export type StickerFinish = { id: string; name: string; surcharge: number; sort_order: number; active: boolean };
export type StickerShape = { id: string; name: string; icon: string | null; sort_order: number; active: boolean };
export type StickerSize = { id: string; label: string; width_cm: number; height_cm: number; price_multiplier: number; sort_order: number; active: boolean };
export type StickerQuantity = { id: string; quantity: number; discount_pct: number; sort_order: number; active: boolean };

const fetchTable = (path: string, activeOnly: boolean) => () => api.get<any[]>(activeOnly ? `/${path}` : `/admin/${path}`);

export const useStickerMaterials = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_materials", activeOnly], queryFn: fetchTable("sticker-materials", activeOnly) });
export const useStickerFinishes = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_finishes", activeOnly], queryFn: fetchTable("sticker-finishes", activeOnly) });
export const useStickerShapes = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_shapes", activeOnly], queryFn: fetchTable("sticker-shapes", activeOnly) });
export const useStickerSizes = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_sizes", activeOnly], queryFn: fetchTable("sticker-sizes", activeOnly) });
export const useStickerQuantities = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_quantities", activeOnly], queryFn: fetchTable("sticker-quantities", activeOnly) });

export type CustomStickerConfig = {
  material: { id: string; name: string; base_price: number };
  finish: { id: string; name: string; surcharge: number };
  shape: { id: string; name: string };
  size: { id: string; label: string; width_cm: number; height_cm: number; price_multiplier: number };
  quantity: { id: string; quantity: number; discount_pct: number };
  file_url: string | null;
  file_name: string | null;
};

export function computeStickerPrice(c: {
  material: { base_price: number };
  finish: { surcharge: number };
  size: { price_multiplier: number };
  quantity: { quantity: number; discount_pct: number };
}) {
  const unit = (Number(c.material.base_price) + Number(c.finish.surcharge)) * Number(c.size.price_multiplier);
  const gross = unit * Number(c.quantity.quantity);
  return Math.round(gross * (1 - Number(c.quantity.discount_pct) / 100));
}
