// Pure helpers for sale/offer pricing logic.

export type Saleable = {
  price: number | string;
  compare_at_price?: number | string | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
};

export const isOnSale = (item?: Saleable | null): boolean => {
  if (!item) return false;
  const price = Number(item.price);
  const cmp = item.compare_at_price != null ? Number(item.compare_at_price) : 0;
  if (!cmp || cmp <= price) return false;
  const now = Date.now();
  if (item.sale_starts_at && new Date(item.sale_starts_at).getTime() > now) return false;
  if (item.sale_ends_at && new Date(item.sale_ends_at).getTime() < now) return false;
  return true;
};

export const discountPercent = (item?: Saleable | null): number => {
  if (!isOnSale(item)) return 0;
  const price = Number(item!.price);
  const cmp = Number(item!.compare_at_price);
  return Math.round((1 - price / cmp) * 100);
};

// For products: consider on sale if the product itself is on sale OR any pack is on sale.
export const productOnSale = (product: any): boolean => {
  if (isOnSale(product)) return true;
  return (product?.packs ?? []).some((p: any) => isOnSale(p));
};

export const productDiscountPercent = (product: any): number => {
  const pcts = [discountPercent(product), ...((product?.packs ?? []).map((p: any) => discountPercent(p)))];
  return Math.max(0, ...pcts);
};
