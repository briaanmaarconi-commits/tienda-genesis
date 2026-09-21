import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StickerMaterial = { id: string; name: string; base_price: number; sort_order: number; active: boolean };
export type StickerFinish = { id: string; name: string; surcharge: number; sort_order: number; active: boolean };
export type StickerShape = { id: string; name: string; icon: string | null; sort_order: number; active: boolean };
export type StickerSize = { id: string; label: string; width_cm: number; height_cm: number; price_multiplier: number; sort_order: number; active: boolean };
export type StickerQuantity = { id: string; quantity: number; discount_pct: number; sort_order: number; active: boolean };

const fetchTable = (table: string, activeOnly: boolean) => async () => {
  let q = supabase.from(table as any).select("*").order("sort_order");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
};

export const useStickerMaterials = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_materials", activeOnly], queryFn: fetchTable("sticker_materials", activeOnly) });
export const useStickerFinishes = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_finishes", activeOnly], queryFn: fetchTable("sticker_finishes", activeOnly) });
export const useStickerShapes = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_shapes", activeOnly], queryFn: fetchTable("sticker_shapes", activeOnly) });
export const useStickerSizes = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_sizes", activeOnly], queryFn: fetchTable("sticker_sizes", activeOnly) });
export const useStickerQuantities = (activeOnly = true) =>
  useQuery({ queryKey: ["sticker_quantities", activeOnly], queryFn: fetchTable("sticker_quantities", activeOnly) });

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
  const unit = (c.material.base_price + c.finish.surcharge) * c.size.price_multiplier;
  const gross = unit * c.quantity.quantity;
  return Math.round(gross * (1 - c.quantity.discount_pct / 100));
}
