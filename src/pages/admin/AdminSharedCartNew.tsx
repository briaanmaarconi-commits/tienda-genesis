import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useShopData";
import { computeLineTotal, type CartAddon, type CartItem, type CartProduct } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";
import {
  useStickerMaterials, useStickerFinishes, useStickerShapes, useStickerSizes, useStickerQuantities,
  computeStickerPrice,
} from "@/hooks/useCustomSticker";

type StickerSel = { materialId: string; finishId: string; shapeId: string; sizeId: string; quantityId: string };
type Row = { rowId: string; productId: string; packId: string; qty: number; addons: Record<string, string>; sticker?: StickerSel };
const EMPTY_STICKER: StickerSel = { materialId: "", finishId: "", shapeId: "", sizeId: "", quantityId: "" };

// Same semantics as ProductPage.tsx's chosenAddons: one option per group
// (radio-style), required groups default to their first option.
function buildAddons(detail: any, selections: Record<string, string>): CartAddon[] {
  const groups = ((detail?.addon_groups ?? []) as any[])
    .filter((g) => g.active)
    .map((g) => ({ ...g, options: ((g.options ?? []) as any[]).filter((o: any) => o.active) }))
    .filter((g) => g.options.length > 0);

  const out: CartAddon[] = [];
  for (const g of groups) {
    const optId = selections[g.id] ?? (g.required ? g.options[0]?.id : undefined);
    if (!optId) continue;
    const opt = g.options.find((o: any) => o.id === optId);
    if (!opt) continue;
    out.push({
      group_id: g.id,
      group_name: g.name,
      option_id: opt.id,
      option_name: opt.name,
      extra_price: g.is_multiplier ? 0 : Number(opt.extra_price),
      per_unit: !g.is_multiplier && !!g.per_unit,
      multiplier: g.is_multiplier ? Number(opt.price_multiplier) || 1 : undefined,
    });
  }
  return out;
}

const AdminSharedCartNew = () => {
  const nav = useNavigate();
  const { data: products = [] } = useProducts({ activeOnly: false });
  const { data: stMaterials = [] } = useStickerMaterials();
  const { data: stFinishes = [] } = useStickerFinishes();
  const { data: stShapes = [] } = useStickerShapes();
  const { data: stSizes = [] } = useStickerSizes();
  const { data: stQuantities = [] } = useStickerQuantities();
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});

  const [rows, setRows] = useState<Row[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Addon groups/options only come back on the per-product detail endpoint,
  // not the list one — fetch and cache details for whatever products are
  // currently selected across rows.
  useEffect(() => {
    const slugs = new Set<string>();
    for (const row of rows) {
      const product: any = products.find((p: any) => p.id === row.productId);
      if (product?.slug && !productDetails[product.slug]) slugs.add(product.slug);
    }
    slugs.forEach((slug) => {
      api.get<any>(`/products/${slug}`).then((detail) => {
        setProductDetails((prev) => ({ ...prev, [slug]: detail }));
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, products]);

  const addRow = () => setRows([...rows, { rowId: crypto.randomUUID(), productId: "", packId: "", qty: 1, addons: {} }]);
  const updateRow = (rowId: string, patch: Partial<Row>) =>
    setRows(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const removeRow = (rowId: string) => setRows(rows.filter((r) => r.rowId !== rowId));

  const addonGroupsFor = (row: Row) => {
    const product: any = products.find((p: any) => p.id === row.productId);
    const detail = product ? productDetails[product.slug] : null;
    return ((detail?.addon_groups ?? []) as any[])
      .filter((g) => g.active)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        ...g,
        options: ((g.options ?? []) as any[]).filter((o: any) => o.active).slice().sort((a: any, b: any) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.options.length > 0);
  };

  // Calcos personalizados: no tienen packs; el precio sale de material/medida/cantidad
  // (misma fórmula que el configurador público) y el item va con qty 1.
  const toStickerProduct = (product: any, sel: StickerSel): CartProduct | null => {
    const material: any = stMaterials.find((m: any) => m.id === sel.materialId);
    const finish: any = stFinishes.find((f: any) => f.id === sel.finishId) ?? { id: "none", name: "Estándar", surcharge: 0 };
    const shape: any = stShapes.find((x: any) => x.id === sel.shapeId);
    const size: any = stSizes.find((x: any) => x.id === sel.sizeId);
    const quantity: any = stQuantities.find((q: any) => q.id === sel.quantityId);
    if (!material || !shape || !size || !quantity) return null;
    const image = product.images?.[0];
    return {
      slug: product.slug,
      name: product.name,
      price: computeStickerPrice({ material, finish, size, quantity }),
      label: `${material.name} · ${shape.name} · ${size.label} · ${quantity.quantity}u`,
      variantId: `${material.id}-${size.id}-${quantity.id}`,
      image_url: image?.url ?? null,
      image_focal_x: image?.focal_x != null ? Number(image.focal_x) : null,
      image_focal_y: image?.focal_y != null ? Number(image.focal_y) : null,
      image_zoom: image?.zoom != null ? Number(image.zoom) : null,
      image_fit: image?.fit ?? null,
      customStickerConfig: {
        material: { id: material.id, name: material.name, base_price: Number(material.base_price) },
        finish: { id: finish.id, name: finish.name, surcharge: Number(finish.surcharge) },
        shape: { id: shape.id, name: shape.name },
        size: {
          id: size.id, label: size.label, width_cm: Number(size.width_cm), height_cm: Number(size.height_cm),
          price_multiplier: Number(size.price_multiplier),
        },
        quantity: { id: quantity.id, quantity: quantity.quantity, discount_pct: Number(quantity.discount_pct) },
        file_url: null,
        file_name: null,
      },
    };
  };

  const toCartProduct = (row: Row): CartProduct | null => {
    const product: any = products.find((p: any) => p.id === row.productId);
    if (!product) return null;
    if (product.product_type === "custom_sticker") return toStickerProduct(product, row.sticker ?? EMPTY_STICKER);
    const pack = product.packs?.find((pk: any) => pk.id === row.packId);
    const image = product.images?.[0];
    const detail = productDetails[product.slug];
    const addons = detail ? buildAddons(detail, row.addons) : [];
    return {
      slug: product.slug,
      name: product.name,
      price: Number(pack ? pack.price : product.price),
      units: pack?.units ?? null,
      label: pack?.label ?? null,
      variantId: pack?.id,
      image_url: image?.url ?? null,
      image_focal_x: image?.focal_x != null ? Number(image.focal_x) : null,
      image_focal_y: image?.focal_y != null ? Number(image.focal_y) : null,
      image_zoom: image?.zoom != null ? Number(image.zoom) : null,
      image_fit: image?.fit ?? null,
      addons: addons.length ? addons : undefined,
    };
  };

  const items: { row: Row; product: CartProduct | null }[] = rows.map((row) => ({ row, product: toCartProduct(row) }));
  const total = items.reduce((s, { row, product }) => s + (product ? computeLineTotal(product, row.qty) : 0), 0);

  const submit = async () => {
    const validItems = items.filter((i) => i.product);
    if (validItems.length === 0) return toast.error("Agregá al menos un producto");
    setSaving(true);
    try {
      const payload: { customer_name: string | null; customer_phone: string | null; notes: string | null; items: CartItem[] } = {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        notes: notes || null,
        items: validItems.map(({ row, product }) => ({ key: row.rowId, product: product!, qty: row.qty })),
      };
      const res = await api.post<{ url: string }>("/admin/shared-carts", payload);
      setResultUrl(res.url);
      toast.success("Carrito creado");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!resultUrl) return;
    navigator.clipboard.writeText(resultUrl);
    toast.success("Link copiado");
  };

  if (resultUrl) {
    return (
      <div>
        <h1 className="text-3xl font-bold">Carrito listo para compartir</h1>
        <div className="mt-6 rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Mandale este link al cliente. Al abrirlo va a ver estos productos ya cargados en el carrito, y ahí mismo
            elige y paga el envío.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm">{resultUrl}</code>
            <Button size="sm" variant="outline" onClick={copyLink}><Copy size={14} /> Copiar</Button>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => nav("/admin/carritos-compartidos")}>Ver listado</Button>
            <Button onClick={() => { setResultUrl(null); setRows([]); setCustomerName(""); setCustomerPhone(""); setNotes(""); }}>
              Crear otro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Armar carrito para un cliente</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Elegí los productos, cantidades y adicionales. El cliente completa sus datos, elige el envío y paga desde el
        link que le compartas.
      </p>

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Productos</h2>
            <Button size="sm" onClick={addRow}><Plus /> Agregar</Button>
          </div>
          <div className="mt-3 space-y-3">
            {rows.map((row) => {
              const product: any = products.find((p: any) => p.id === row.productId);
              const cartProduct = toCartProduct(row);
              const isSticker = product?.product_type === "custom_sticker";
              const sel = row.sticker ?? EMPTY_STICKER;
              const setSel = (patch: Partial<StickerSel>) => updateRow(row.rowId, { sticker: { ...sel, ...patch } });
              const addonGroups = addonGroupsFor(row);
              return (
                <div key={row.rowId} className="rounded-lg border p-3">
                  <div className="grid gap-2 sm:grid-cols-[2fr_1.5fr_80px_120px_auto] sm:items-end">
                    <div>
                      <Label className="text-xs">Producto</Label>
                      <Select value={row.productId} onValueChange={(v) => {
                        const p: any = products.find((x: any) => x.id === v);
                        updateRow(row.rowId, { productId: v, packId: "", addons: {}, qty: 1, sticker: p?.product_type === "custom_sticker" ? { ...EMPTY_STICKER } : undefined });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Variante</Label>
                      <Select
                        value={row.packId}
                        onValueChange={(v) => updateRow(row.rowId, { packId: v })}
                        disabled={isSticker || !product?.packs?.length}
                      >
                        <SelectTrigger><SelectValue placeholder={isSticker ? "Configurar abajo" : product?.packs?.length ? "Elegir..." : "Base"} /></SelectTrigger>
                        <SelectContent>
                          {(product?.packs ?? []).map((pk: any) => (
                            <SelectItem key={pk.id} value={pk.id}>
                              {pk.label || (pk.units ? `Pack de ${pk.units}` : "Variante")} — {formatPrice(Number(pk.price))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Cant.</Label>
                      <Input
                        type="number"
                        min={1}
                        disabled={isSticker}
                        value={row.qty}
                        onChange={(e) => updateRow(row.rowId, { qty: Math.max(1, Number(e.target.value)) })}
                      />
                    </div>
                    <div className="text-right font-bold">
                      {cartProduct ? formatPrice(computeLineTotal(cartProduct, row.qty)) : "-"}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(row.rowId)}><Trash2 /></Button>
                  </div>

                  {isSticker && (
                    <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-3">
                      {([
                        ["Material", "materialId", stMaterials, (m: any) => m.name],
                        ["Terminación", "finishId", stFinishes, (f: any) => f.name],
                        ["Forma", "shapeId", stShapes, (x: any) => x.name],
                        ["Tamaño", "sizeId", stSizes, (x: any) => x.label],
                        ["Cantidad", "quantityId", stQuantities, (q: any) => `${q.quantity} unidades${Number(q.discount_pct) > 0 ? ` (-${q.discount_pct}%)` : ""}`],
                      ] as [string, keyof StickerSel, any[], (x: any) => string][]).map(([label, field, list, name]) => (
                        <div key={field}>
                          <Label className="text-xs">{label}</Label>
                          <Select value={sel[field]} onValueChange={(v) => setSel({ [field]: v })}>
                            <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                            <SelectContent>
                              {list.map((x: any) => <SelectItem key={x.id} value={x.id}>{name(x)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground sm:col-span-3">
                        El precio es el total para esa cantidad. El cliente no sube archivo desde este link: coordinen el diseño aparte.
                      </p>
                    </div>
                  )}

                  {addonGroups.length > 0 && (
                    <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
                      {addonGroups.map((g: any) => {
                        const selected = row.addons[g.id] ?? (g.required ? g.options[0]?.id : "");
                        return (
                          <div key={g.id}>
                            <Label className="text-xs">
                              {g.name}{g.required ? " *" : " (opcional)"}
                            </Label>
                            <Select
                              value={selected}
                              onValueChange={(v) => updateRow(row.rowId, { addons: { ...row.addons, [g.id]: v } })}
                            >
                              <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                              <SelectContent>
                                {g.options.map((o: any) => (
                                  <SelectItem key={o.id} value={o.id}>
                                    {o.name}
                                    {g.is_multiplier
                                      ? Number(o.price_multiplier) !== 1 ? ` (× ${Number(o.price_multiplier)})` : ""
                                      : Number(o.extra_price) > 0 ? ` (+${formatPrice(Number(o.extra_price))}${g.per_unit ? " c/u" : ""})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin productos todavía.</p>}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <div><Label>Nombre del cliente (opcional)</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div><Label>Teléfono (opcional)</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Notas internas (opcional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </section>

        <section className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex justify-between text-lg font-bold"><span>Subtotal productos</span><span className="text-primary">{formatPrice(total)}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">No incluye envío — lo elige y paga el cliente al abrir el link.</p>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => nav("/admin/carritos-compartidos")}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Generando..." : "Generar link"}</Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSharedCartNew;
