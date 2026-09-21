import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type CustomStickerConfigCart = {
  material: { id: string; name: string; base_price: number };
  finish: { id: string; name: string; surcharge: number };
  shape: { id: string; name: string };
  size: { id: string; label: string; width_cm: number; height_cm: number; price_multiplier: number };
  quantity: { id: string; quantity: number; discount_pct: number };
  file_url: string;
  file_name: string;
};

export type CartAddon = {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  extra_price: number;
  per_unit?: boolean;
  multiplier?: number; // factor que multiplica (precio del pack + adicionales de precio)
};


export type CartProduct = {
  slug: string;
  name: string;
  price: number; // variant price (sin addons)
  units?: number | null;
  label?: string | null;
  variantId?: string;
  image_url?: string | null;
  image_focal_x?: number | null;
  image_focal_y?: number | null;
  image_zoom?: number | null;
  image_fit?: string | null;
  photos?: string[];
  customStickerConfig?: CustomStickerConfigCart;
  addons?: CartAddon[]; // adicionales (se suman una sola vez al item, no por unidad)
};
export type CartItem = { key: string; product: CartProduct; qty: number };

type CartCtx = {
  items: CartItem[];
  add: (p: CartProduct, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "cart-v4";

const addonsKey = (p: CartProduct) =>
  (p.addons ?? []).map((a) => `${a.group_id}=${a.option_id}`).sort().join("|");

const keyOf = (p: CartProduct) =>
  p.photos && p.photos.length > 0
    ? `${p.slug}::${p.variantId ?? p.label ?? p.units ?? ""}::${crypto.randomUUID()}`
    : p.customStickerConfig
      ? `${p.slug}::custom::${crypto.randomUUID()}`
      : `${p.slug}::${p.variantId ?? p.label ?? p.units ?? ""}::${addonsKey(p)}`;

export const getAddonsMultiplier = (p: CartProduct) =>
  (p.addons ?? []).reduce((m, a) => m * (Number(a.multiplier) || 1), 1);

// Total de la línea: (precio del pack × qty + adicionales de precio) × multiplicadores
export const computeLineTotal = (p: CartProduct, qty: number = 1) => {
  const unitMultiplier = (Number(p.units) || 1) * qty;
  const base = Number(p.price) * qty;
  const priceAddons = (p.addons ?? []).reduce(
    (s, a) => s + Number(a.extra_price || 0) * (a.per_unit ? unitMultiplier : 1),
    0,
  );
  return (base + priceAddons) * getAddonsMultiplier(p);
};

const addonsTotalForQty = (p: CartProduct, qty: number) =>
  computeLineTotal(p, qty) - Number(p.price) * qty;


export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = (p: CartProduct, qty = 1) =>
    setItems((prev) => {
      const k = keyOf(p);
      const ex = prev.find((i) => i.key === k);
      if (ex) return prev.map((i) => (i.key === k ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { key: k, product: p, qty }];
    });
  const remove = (key: string) => setItems((p) => p.filter((i) => i.key !== key));
  const setQty = (key: string, qty: number) =>
    setItems((p) => p.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)));
  const clear = () => setItems([]);

  const total = items.reduce((s, i) => s + computeLineTotal(i.product, i.qty), 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return <Ctx.Provider value={{ items, add, remove, setQty, clear, total, count }}>{children}</Ctx.Provider>;
};

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
};

export { formatPrice } from "@/lib/helpers";

export const getAddonsTotal = (p: CartProduct, qty: number = 1) => addonsTotalForQty(p, qty);

