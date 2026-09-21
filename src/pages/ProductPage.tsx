import { Link, useParams } from "react-router-dom";
import { useProduct, useSiteSettings } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { useCart, type CartAddon } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/helpers";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import PhotoUploader from "@/components/PhotoUploader";
import { isOnSale, discountPercent } from "@/lib/offers";
import SmartImage from "@/components/SmartImage";
import StickerPicker from "@/components/StickerPicker";
import CustomStickerConfigurator from "@/components/CustomStickerConfigurator";
import ShippingEstimator from "@/components/ShippingEstimator";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";


const variantTitle = (v: any) => {
  if (v.label && String(v.label).trim()) return v.label;
  if (v.units) return `${v.units} unidades`;
  return "Variante";
};

const ProductPage = () => {
  const { slug } = useParams();
  const { data: product, isLoading } = useProduct(slug);
  const { data: site } = useSiteSettings();
  const { add } = useCart();
  const [activeImg, setActiveImg] = useState(0);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [photos, setPhotos] = useState<string[]>([]);

  const unitOf = (v: any) => {
    const n = Number(v.units);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
  };
  const variants = (((product as any)?.packs ?? []) as any[]).slice().sort(
    (a: any, b: any) => {
      const ua = unitOf(a), ub = unitOf(b);
      if (ua !== ub) return ua - ub;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    }
  );

  const singleVariant = variants.length === 1;

  // Con una sola variante no mostramos el selector de packs: el cliente
  // elige directamente los adicionales (ej: tamaño × unidades).
  useEffect(() => {
    if (singleVariant) setQtys((s) => (s[variants[0].id] ? s : { [variants[0].id]: 1 }));
  }, [singleVariant, variants]);

  const selectedPacks = variants
    .map((v: any) => ({ pack: v, qty: qtys[v.id] || 0 }))
    .filter((x) => x.qty > 0);

  const totalPhotosNeeded = selectedPacks.reduce(
    (s, { pack, qty }) => s + (Number(pack.photos_required) || 0) * qty,
    0,
  );
  const totalUnits = selectedPacks.reduce(
    (s, { pack, qty }) => s + ((Number(pack.units) || 1) * qty),
    0,
  );
  const totalItems = selectedPacks.reduce((s, { qty }) => s + qty, 0);

  const addonGroups = useMemo(() => {
    const groups = (((product as any)?.addon_groups ?? []) as any[])
      .filter((g) => g.active)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        ...g,
        options: ((g.options ?? []) as any[]).filter((o) => o.active).slice().sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.options.length > 0);
    return groups;
  }, [product]);

  const [addonSelections, setAddonSelections] = useState<Record<string, string>>({});

  // Default-select the first option for each required group
  useEffect(() => {
    setAddonSelections((prev) => {
      const next = { ...prev };
      addonGroups.forEach((g) => {
        if (!next[g.id] && g.required && g.options[0]) next[g.id] = g.options[0].id;
      });
      return next;
    });
  }, [addonGroups]);

  const chosenAddons: CartAddon[] = useMemo(() => {
    const out: CartAddon[] = [];
    addonGroups.forEach((g) => {
      const optId = addonSelections[g.id];
      if (!optId) return;
      const opt = g.options.find((o: any) => o.id === optId);
      if (opt)
        out.push({
          group_id: g.id,
          group_name: g.name,
          option_id: opt.id,
          option_name: opt.name,
          extra_price: g.is_multiplier ? 0 : Number(opt.extra_price),
          per_unit: !g.is_multiplier && !!g.per_unit,
          multiplier: g.is_multiplier ? Number(opt.price_multiplier) || 1 : undefined,
        });
    });
    return out;
  }, [addonGroups, addonSelections]);

  const packsSubtotal = selectedPacks.reduce(
    (s, { pack, qty }) => s + Number(pack.price) * qty,
    0,
  );
  const addonsPriceExtra = chosenAddons.reduce(
    (s, a) => s + a.extra_price * (a.per_unit ? totalUnits : (totalItems > 0 ? 1 : 0)),
    0,
  );
  const multiplierFactor = chosenAddons.reduce((m, a) => m * (Number(a.multiplier) || 1), 1);
  const addonsExtra = (packsSubtotal + addonsPriceExtra) * multiplierFactor - packsSubtotal;




  if (isLoading) {
    return <div className="container py-10"><Skeleton className="h-96 w-full rounded-3xl" /></div>;
  }
  if (!product) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl">Producto no encontrado</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Volver al inicio</Link>
      </div>
    );
  }

  const images = (product.images ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
  const mainImg = images[activeImg];
  const subtotal = packsSubtotal + addonsExtra;
  const anyPhotoRequired = variants.some((v: any) => (Number(v.photos_required) || 0) > 0);

  const photosOk = true; // foto opcional
  const addonsOk = addonGroups.every((g) => !g.required || !!addonSelections[g.id]);
  const waNum = site?.whatsapp?.replace(/\D/g, "");
  const designProducts = new Set(["pulseras-holograficas", "entradas", "calcos"]);
  const isDesignProduct = designProducts.has(product.slug);
  const waLabel = isDesignProduct ? "Pedir diseño gratis" : "Contactanos";
  const waLink = waNum
    ? `https://wa.me/${waNum}?text=${encodeURIComponent(`Hola! Tengo una consulta sobre el producto: ${product?.name ?? ""}`)}`
    : "#";


  return (
    <div className="container py-10">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Inicio</Link> /{" "}
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-6 md:gap-10 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl">
            <SmartImage
              url={mainImg?.url}
              alt={product.name}
              focal_x={mainImg?.focal_x}
              focal_y={mainImg?.focal_y}
              zoom={mainImg?.zoom}
              fit={mainImg?.fit}
              loading="eager"
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((im: any, i: number) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${i === activeImg ? "border-primary" : "border-transparent"}`}>
                  <SmartImage url={im.url} focal_x={im.focal_x} focal_y={im.focal_y} zoom={im.zoom} fit={im.fit} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl">{product.name}</h1>

          {(product as any).product_type === "custom_sticker" ? (
            <div className="mt-6">
              <CustomStickerConfigurator product={{ slug: product.slug, name: product.name }} />
              {waNum && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[hsl(142_70%_45%)] px-6 py-3 text-sm font-semibold text-[hsl(142_70%_45%)] transition hover:bg-[hsl(142_70%_45%)] hover:text-white">
                  {isDesignProduct ? <MessageCircle className="h-4 w-4" /> : <WhatsAppIcon className="h-4 w-4" />} {waLabel}
                </a>
              )}
            </div>
          ) : (product as any).product_type === "stickers" ? (
            <div className="mt-6">
              <StickerPicker
                product={{ slug: product.slug, name: product.name, price: Number(product.price) }}
                folders={((product as any).sticker_folders ?? []) as any}
              />
              {waNum && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[hsl(142_70%_45%)] px-6 py-3 text-sm font-semibold text-[hsl(142_70%_45%)] transition hover:bg-[hsl(142_70%_45%)] hover:text-white">
                  {isDesignProduct ? <MessageCircle className="h-4 w-4" /> : <WhatsAppIcon className="h-4 w-4" />} {waLabel}
                </a>
              )}
            </div>
          ) : variants.length === 0 ? (
            <p className="mt-6 rounded-lg border bg-muted p-4 text-sm text-muted-foreground">Este producto aún no tiene opciones cargadas.</p>
          ) : (
            <>
              {!singleVariant && (
                <div className="mt-6">
                  <label className="text-sm font-semibold">Elegí cantidad por pack</label>
                  <div className="mt-2 grid gap-2">
                    {variants.map((p: any) => {
                      const q = qtys[p.id] || 0;
                      const sale = isOnSale(p);
                      const setQ = (fn: (n: number) => number) =>
                        setQtys((s) => ({ ...s, [p.id]: Math.max(0, fn(s[p.id] || 0)) }));
                      return (
                        <div
                          key={p.id}
                          className={`relative flex items-center justify-between gap-3 rounded-xl border p-3 transition ${q > 0 ? "border-primary bg-primary/5" : ""}`}
                        >
                          <div className="min-w-0 flex-1">
                            {sale && <span className="absolute right-2 top-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">-{discountPercent(p)}%</span>}
                            <div className="font-bold">{variantTitle(p)}</div>
                            {Number(p.price) > 0 && (
                              <div className="text-sm">
                                {sale && <span className="mr-1 text-muted-foreground line-through text-xs">{formatPrice(Number(p.compare_at_price))}</span>}
                                <span className="text-primary">{formatPrice(Number(p.price))}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center rounded-full border">
                            <Button variant="ghost" size="icon" onClick={() => setQ((n) => n - 1)} disabled={q === 0}><Minus /></Button>
                            <span className="w-8 text-center font-bold">{q}</span>
                            <Button variant="ghost" size="icon" onClick={() => setQ((n) => n + 1)}><Plus /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {anyPhotoRequired && totalPhotosNeeded > 0 && (
                <div className="mt-6">
                  <PhotoUploader required={totalPhotosNeeded} value={photos} onChange={setPhotos} />
                </div>
              )}

              {addonGroups.length > 0 && (
                <div className="mt-6 space-y-4">
                  {addonGroups.map((g: any) => (
                    <div key={g.id} className="rounded-xl border p-4">
                      <p className="text-sm font-semibold">{g.name}{g.required && <span className="text-destructive"> *</span>}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {g.options.map((o: any) => {
                          const active = addonSelections[g.id] === o.id;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setAddonSelections((s) => ({ ...s, [g.id]: o.id }))}
                              className={`rounded-lg border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                            >
                              <div className="text-sm font-medium">{o.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {g.is_multiplier
                                  ? `× ${Number(o.price_multiplier) || 1}`
                                  : Number(o.extra_price) > 0
                                    ? `+ ${formatPrice(Number(o.extra_price))}${g.per_unit ? " x unidad" : ""}`
                                    : "Sin costo adicional"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}


              <ShippingEstimator product={product} totalUnits={totalUnits} cartTotal={subtotal} />

              <Button
                size="lg"
                className="mt-4 rounded-full"
                disabled={!photosOk || !addonsOk || totalItems === 0}
                onClick={() => {
                  if (selectedPacks.length === 0) return;
                  // Adicionales de precio: se cobran una sola vez para todo el producto,
                  // se adjuntan solo a la primera línea (los per_unit pasan a monto fijo).
                  // Multiplicadores: se adjuntan a todas las líneas, porque multiplican
                  // el precio de cada pack.
                  const priceAddons: CartAddon[] = chosenAddons
                    .filter((a) => !a.multiplier)
                    .map((a) => ({
                      ...a,
                      extra_price: a.per_unit ? a.extra_price * totalUnits : a.extra_price,
                      per_unit: false,
                    }));
                  const multiplierAddons: CartAddon[] = chosenAddons.filter((a) => !!a.multiplier);
                  let photoCursor = 0;
                  selectedPacks.forEach(({ pack, qty: q }, idx) => {
                    const needed = (Number(pack.photos_required) || 0) * q;
                    const slice = needed > 0 ? photos.slice(photoCursor, photoCursor + needed) : undefined;
                    photoCursor += needed;
                    add(
                      {
                        slug: product.slug,
                        name: product.name,
                        price: Number(pack.price),
                        units: pack.units ?? null,
                        label: pack.label ?? null,
                        variantId: pack.id,
                        image_url: mainImg?.url,
                        image_focal_x: mainImg?.focal_x,
                        image_focal_y: mainImg?.focal_y,
                        image_zoom: mainImg?.zoom,
                        image_fit: mainImg?.fit,
                        photos: slice,
                        addons: (() => {
                          const list = [...(idx === 0 ? priceAddons : []), ...multiplierAddons];
                          return list.length > 0 ? list : undefined;
                        })(),
                      },
                      q,
                    );
                  });
                  toast.success(`${totalItems} pack${totalItems > 1 ? "s" : ""} agregado${totalItems > 1 ? "s" : ""} al carrito`);
                  setQtys(singleVariant ? { [variants[0].id]: 1 } : {});
                  setPhotos([]);
                }}
              >
                <ShoppingCart /> {!addonsOk ? "Elegí una opción" : totalItems === 0 ? "Elegí cantidad" : "Agregar al carrito"}
              </Button>
              {waNum && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[hsl(142_70%_45%)] px-6 py-3 text-sm font-semibold text-[hsl(142_70%_45%)] transition hover:bg-[hsl(142_70%_45%)] hover:text-white">
                  {isDesignProduct ? <MessageCircle className="h-4 w-4" /> : <WhatsAppIcon className="h-4 w-4" />} {waLabel}
                </a>
              )}

            </>
          )}

          <p className="mt-6 text-3xl font-bold text-primary">
            {formatPrice(subtotal)}
          </p>
          <p className="text-xs text-muted-foreground">
            {singleVariant
              ? `× ${multiplierFactor} unidad${multiplierFactor > 1 ? "es" : ""}`
              : totalItems === 0
                ? "Elegí al menos un pack"
                : `${totalItems} pack${totalItems > 1 ? "s" : ""} · ${totalUnits} unidad${totalUnits > 1 ? "es" : ""}`}
          </p>

          {product.description && <p className="mt-6 whitespace-pre-line text-muted-foreground">{product.description}</p>}
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
