import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { formatPrice, slugify, uploadImage } from "@/lib/helpers";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X, Crop, FolderOpen } from "lucide-react";
import ImageFocalEditor, { FocalSettings } from "@/components/admin/ImageFocalEditor";
import StickerFoldersEditor from "@/components/admin/StickerFoldersEditor";

const AdminProducts = () => {
  const { data: products, refetch } = useProducts({ activeOnly: false });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [editingImgIdx, setEditingImgIdx] = useState<number | null>(null);
  const [stickersForProductId, setStickersForProductId] = useState<string | null>(null);

  const unitOf = (v: any) => {
    const n = Number(v.units);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
  };
  const sortPacks = (packs: any[]) =>
    (packs ?? []).slice().sort((a: any, b: any) => {
      const ua = unitOf(a), ub = unitOf(b);
      if (ua !== ub) return ua - ub;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["products"] }); };

  const newProduct = () => setEditing({
    name: "", slug: "", description: "", price: 0, category_id: null,
    compare_at_price: null, sale_starts_at: null, sale_ends_at: null,
    stock: 0, featured: false, active: true, product_type: "standard",
    images: [] as { url: string; sort_order: number }[],
    packs: [] as any[],
  });

  const save = async () => {
    if (!editing.name) return toast.error("Nombre requerido");
    const { images, packs, category, sticker_folders, ...rest } = editing;
    const payload: any = {
      ...rest,
      slug: rest.slug || slugify(rest.name),
      price: Number(rest.price) || 0,
      stock: Number(rest.stock) || 0,
      compare_at_price: rest.compare_at_price === "" || rest.compare_at_price == null ? null : Number(rest.compare_at_price),
      sale_starts_at: rest.sale_starts_at || null,
      sale_ends_at: rest.sale_ends_at || null,
    };
    delete payload.created_at; delete payload.updated_at;

    let productId = editing.id;
    if (productId) {
      const { error } = await supabase.from("products").update(payload).eq("id", productId);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select().single();
      if (error) return toast.error(error.message);
      productId = data.id;
    }

    // Sync images
    await supabase.from("product_images").delete().eq("product_id", productId);
    if (images?.length) {
      await supabase.from("product_images").insert(
        images.map((im: any, i: number) => ({
          product_id: productId,
          url: im.url,
          sort_order: i,
          focal_x: typeof im.focal_x === "number" ? im.focal_x : 50,
          focal_y: typeof im.focal_y === "number" ? im.focal_y : 50,
          zoom: typeof im.zoom === "number" ? im.zoom : 1,
          fit: im.fit || "cover",
        }))
      );
    }

    // Sync packs / variants
    await supabase.from("product_packs").delete().eq("product_id", productId);
    if (packs?.length) {
      await supabase.from("product_packs").insert(
        packs
          .filter((p: any) => Number(p.units) > 0 || (p.label && String(p.label).trim()))
          .map((p: any, i: number) => ({
            product_id: productId,
            units: p.units ? Number(p.units) : null,
            label: p.label ? String(p.label).trim() : null,
            price: Number(p.price) || 0,
            photos_required: p.photos_required ? Number(p.photos_required) : null,
            compare_at_price: p.compare_at_price === "" || p.compare_at_price == null ? null : Number(p.compare_at_price),
            sale_starts_at: p.sale_starts_at || null,
            sale_ends_at: p.sale_ends_at || null,
            sort_order: i,
          }))
      );
    }

    toast.success("Guardado");
    setEditing(null); refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Borrar producto?")) return;
    await supabase.from("products").delete().eq("id", id);
    refresh();
  };

  const addImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const url = await uploadImage("products", file);
      setEditing((p: any) => ({
        ...p,
        images: [
          ...(p.images ?? []),
          { url, sort_order: p.images?.length ?? 0, focal_x: 50, focal_y: 50, zoom: 1, fit: "cover" },
        ],
      }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingImg(false);
    }
  };

  const updateImage = (i: number, patch: Partial<FocalSettings>) =>
    setEditing((p: any) => ({
      ...p,
      images: p.images.map((im: any, j: number) => (j === i ? { ...im, ...patch } : im)),
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Productos</h1>
        <Button onClick={newProduct}><Plus /> Nuevo</Button>
      </div>

      <div className="space-y-3">
        {(products ?? []).map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg bg-muted">
              {p.images?.[0]?.url ? <img src={p.images[0].url} alt="" className="h-full w-full object-cover" /> : <span>📦</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.category?.name || "Sin categoría"} · {formatPrice(Number(p.price))}</p>
            </div>
            {!p.active && <span className="text-xs text-muted-foreground">Oculto</span>}
            {p.featured && <span className="text-xs text-secondary-foreground bg-secondary px-2 py-0.5 rounded">Destacado</span>}
            <Button variant="outline" size="sm" onClick={() => setEditing({ ...p, category_id: p.category_id, packs: sortPacks(p.packs) })}>Editar</Button>
            <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 /></Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="mx-auto my-8 w-full max-w-2xl rounded-2xl bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold">{editing.id ? "Editar producto" : "Nuevo producto"}</h2>

            <div><Label>Nombre</Label>
              <Input className="mt-2" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.id ? editing.slug : slugify(e.target.value) })} />
            </div>
            <div><Label>Slug</Label><Input className="mt-2" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} /></div>
            <div><Label>Descripción</Label><Textarea className="mt-2" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>

            <div>
              <Label>Stock total (opcional)</Label>
              <Input className="mt-2" type="number" min="0" value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} />
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Oferta del producto (opcional)</Label>
                {Number(editing.compare_at_price) > Number(editing.price) && (
                  <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                    -{Math.round((1 - Number(editing.price) / Number(editing.compare_at_price)) * 100)}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Precio actual</Label><Input type="number" min="0" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
                <div><Label className="text-xs">Precio anterior (tachado)</Label><Input type="number" min="0" placeholder="Sin oferta" value={editing.compare_at_price ?? ""} onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value })} /></div>
                <div><Label className="text-xs">Vigente desde (opcional)</Label><Input type="datetime-local" value={editing.sale_starts_at?.slice(0, 16) ?? ""} onChange={(e) => setEditing({ ...editing, sale_starts_at: e.target.value })} /></div>
                <div><Label className="text-xs">Vigente hasta (opcional)</Label><Input type="datetime-local" value={editing.sale_ends_at?.slice(0, 16) ?? ""} onChange={(e) => setEditing({ ...editing, sale_ends_at: e.target.value })} /></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Activo</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editing.featured} onCheckedChange={(v) => setEditing({ ...editing, featured: v })} /><Label>Destacado</Label></div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Tipo:</Label>
                <select
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  value={editing.product_type ?? "standard"}
                  onChange={(e) => setEditing({ ...editing, product_type: e.target.value })}
                >
                  <option value="standard">Estándar (variantes/packs)</option>
                  <option value="stickers">Stickers (carpetas)</option>
                </select>
              </div>
            </div>

            {editing.id && editing.product_type === "stickers" && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Carpetas y stickers</p>
                  <p className="text-xs text-muted-foreground">Gestioná las carpetas (ej. Argentina) y los stickers individuales.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setStickersForProductId(editing.id)}>
                  <FolderOpen /> Gestionar
                </Button>
              </div>
            )}
            {!editing.id && editing.product_type === "stickers" && (
              <p className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">Guardá el producto primero para poder gestionar carpetas y stickers.</p>
            )}

            <div className={editing.product_type === "stickers" ? "hidden" : ""}>
              <div className="flex items-center justify-between">
                <Label>Variantes (packs o medidas)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ ...editing, packs: [...(editing.packs ?? []), { units: "", label: "", price: 0 }] })}>
                  <Plus /> Agregar variante
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Usá <b>Etiqueta</b> para medidas (ej: "30x40 cm") o <b>Unidades</b> para packs (ej: 100). <b>Fotos</b>: cantidad de imágenes que el cliente debe subir por unidad de esta variante (dejar vacío si no requiere fotos).</p>
              <div className="mt-2 space-y-2">
                {(editing.packs ?? []).length === 0 && <p className="text-xs text-muted-foreground">Agregá al menos una variante.</p>}
                {(editing.packs ?? []).map((pk: any, i: number) => (
                  <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1"><Label className="text-xs">Etiqueta / medida</Label>
                        <Input placeholder="ej: 30x40 cm" value={pk.label ?? ""} onChange={(e) => {
                          const packs = [...editing.packs];
                          packs[i] = { ...packs[i], label: e.target.value };
                          setEditing({ ...editing, packs });
                        }} />
                      </div>
                      <div className="w-20"><Label className="text-xs">Unidades</Label>
                        <Input type="number" min="0" placeholder="—" value={pk.units ?? ""} onChange={(e) => {
                          const packs = [...editing.packs];
                          packs[i] = { ...packs[i], units: e.target.value };
                          setEditing({ ...editing, packs });
                        }} />
                      </div>
                      <div className="w-28"><Label className="text-xs">Precio</Label>
                        <Input type="number" min="0" value={pk.price} onChange={(e) => {
                          const packs = [...editing.packs];
                          packs[i] = { ...packs[i], price: e.target.value };
                          setEditing({ ...editing, packs });
                        }} />
                      </div>
                      <div className="w-20"><Label className="text-xs">Fotos</Label>
                        <Input type="number" min="0" placeholder="—" value={pk.photos_required ?? ""} onChange={(e) => {
                          const packs = [...editing.packs];
                          packs[i] = { ...packs[i], photos_required: e.target.value };
                          setEditing({ ...editing, packs });
                        }} />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ ...editing, packs: editing.packs.filter((_: any, j: number) => j !== i) })}><Trash2 /></Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t pt-2">
                      <div><Label className="text-xs">Precio anterior (oferta)</Label>
                        <Input type="number" min="0" placeholder="—" value={pk.compare_at_price ?? ""} onChange={(e) => {
                          const packs = [...editing.packs];
                          packs[i] = { ...packs[i], compare_at_price: e.target.value };
                          setEditing({ ...editing, packs });
                        }} />
                      </div>
                      <div><Label className="text-xs">Desde</Label>
                        <Input type="datetime-local" value={pk.sale_starts_at?.slice(0, 16) ?? ""} onChange={(e) => {
                          const packs = [...editing.packs];
                          packs[i] = { ...packs[i], sale_starts_at: e.target.value };
                          setEditing({ ...editing, packs });
                        }} />
                      </div>
                      <div><Label className="text-xs">Hasta</Label>
                        <Input type="datetime-local" value={pk.sale_ends_at?.slice(0, 16) ?? ""} onChange={(e) => {
                          const packs = [...editing.packs];
                          packs[i] = { ...packs[i], sale_ends_at: e.target.value };
                          setEditing({ ...editing, packs });
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Imágenes</Label>
              <p className="text-xs text-muted-foreground mt-1">Tocá <b>Encuadrar</b> para elegir qué parte se ve centrada en la tienda.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(editing.images ?? []).map((im: any, i: number) => (
                  <div key={i} className="relative">
                    <div className="h-20 w-20 overflow-hidden rounded-lg border">
                      <img
                        src={im.url}
                        alt=""
                        className="h-full w-full"
                        style={{
                          objectFit: im.fit === "contain" ? "contain" : "cover",
                          objectPosition: `${im.focal_x ?? 50}% ${im.focal_y ?? 50}%`,
                          transform: im.zoom && im.zoom !== 1 ? `scale(${im.zoom})` : undefined,
                          transformOrigin: `${im.focal_x ?? 50}% ${im.focal_y ?? 50}%`,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingImgIdx(editingImgIdx === i ? null : i)}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow"
                    >
                      <Crop size={10} className="inline" /> Encuadrar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ ...editing, images: editing.images.filter((_: any, j: number) => j !== i) })
                      }
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted">
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingImg} onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])} />
                  <Plus />
                </label>
              </div>

              {editingImgIdx !== null && editing.images?.[editingImgIdx] && (
                <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                  <ImageFocalEditor
                    url={editing.images[editingImgIdx].url}
                    value={{
                      focal_x: editing.images[editingImgIdx].focal_x ?? 50,
                      focal_y: editing.images[editingImgIdx].focal_y ?? 50,
                      zoom: editing.images[editingImgIdx].zoom ?? 1,
                      fit: (editing.images[editingImgIdx].fit as any) || "cover",
                    }}
                    onChange={(v) => updateImage(editingImgIdx, v)}
                    label={`Imagen ${editingImgIdx + 1}`}
                  />
                  <div className="mt-2 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingImgIdx(null)}>
                      Listo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {stickersForProductId && (
        <StickerFoldersEditor
          productId={stickersForProductId}
          onClose={() => setStickersForProductId(null)}
        />
      )}
    </div>
  );
};

export default AdminProducts;
