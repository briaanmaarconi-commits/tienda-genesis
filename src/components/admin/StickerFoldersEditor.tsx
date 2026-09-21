import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { slugify, uploadImage } from "@/lib/helpers";

type Sticker = { id?: string; name: string; image_url: string | null; sort_order: number; active: boolean; _new?: boolean };
type Folder = {
  id?: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
  stickers: Sticker[];
  _new?: boolean;
};

export default function StickerFoldersEditor({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: fd } = await supabase
      .from("product_sticker_folders")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order");
    const ids = (fd ?? []).map((f) => f.id);
    let stickers: any[] = [];
    if (ids.length) {
      const { data: sd } = await supabase
        .from("product_stickers")
        .select("*")
        .in("folder_id", ids)
        .order("sort_order");
      stickers = sd ?? [];
    }
    setFolders(
      (fd ?? []).map((f: any) => ({
        ...f,
        stickers: stickers.filter((s) => s.folder_id === f.id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [productId]);

  const addFolder = () =>
    setFolders((p) => [
      ...p,
      { name: "", slug: "", sort_order: p.length, active: true, stickers: [], _new: true },
    ]);

  const updateFolder = (i: number, patch: Partial<Folder>) =>
    setFolders((p) => p.map((f, j) => (i === j ? { ...f, ...patch } : f)));

  const removeFolder = async (i: number) => {
    if (!confirm("¿Borrar carpeta y todos sus stickers?")) return;
    const f = folders[i];
    if (f.id) await supabase.from("product_sticker_folders").delete().eq("id", f.id);
    setFolders((p) => p.filter((_, j) => j !== i));
  };

  const addSticker = (fi: number) =>
    setFolders((p) =>
      p.map((f, j) =>
        j === fi
          ? {
              ...f,
              stickers: [
                ...f.stickers,
                { name: "", image_url: null, sort_order: f.stickers.length, active: true, _new: true },
              ],
            }
          : f,
      ),
    );

  const updateSticker = (fi: number, si: number, patch: Partial<Sticker>) =>
    setFolders((p) =>
      p.map((f, j) =>
        j === fi
          ? { ...f, stickers: f.stickers.map((s, k) => (k === si ? { ...s, ...patch } : s)) }
          : f,
      ),
    );

  const removeSticker = async (fi: number, si: number) => {
    const s = folders[fi].stickers[si];
    if (s.id) await supabase.from("product_stickers").delete().eq("id", s.id);
    setFolders((p) =>
      p.map((f, j) => (j === fi ? { ...f, stickers: f.stickers.filter((_, k) => k !== si) } : f)),
    );
  };

  const uploadStickerImg = async (fi: number, si: number, file: File) => {
    const key = `${fi}-${si}`;
    setUploading(key);
    try {
      const url = await uploadImage("products", file);
      updateSticker(fi, si, { image_url: url });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(null);
    }
  };

  const bulkUploadStickers = async (fi: number, files: FileList) => {
    const f = folders[fi];
    if (!f.id) {
      toast.error("Guardá la carpeta antes de subir imágenes masivamente");
      return;
    }
    const arr = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
    );
    setUploading(`bulk-${fi}`);
    let ok = 0;
    let baseSort = f.stickers.length;
    try {
      for (const file of arr) {
        try {
          const url = await uploadImage("products", file);
          const name = file.name.replace(/\.[^.]+$/, "").trim() || `Sticker ${baseSort + 1}`;
          const { data, error } = await supabase
            .from("product_stickers")
            .insert({
              folder_id: f.id,
              name,
              image_url: url,
              sort_order: baseSort,
              active: true,
            })
            .select()
            .single();
          if (error) throw error;
          baseSort++;
          ok++;
          setFolders((p) =>
            p.map((ff, j) =>
              j === fi
                ? {
                    ...ff,
                    stickers: [
                      ...ff.stickers,
                      {
                        id: data.id,
                        name: data.name,
                        image_url: data.image_url,
                        sort_order: data.sort_order,
                        active: data.active,
                      },
                    ],
                  }
                : ff,
            ),
          );
        } catch (e: any) {
          toast.error(`${file.name}: ${e.message}`);
        }
      }
      if (ok > 0) toast.success(`${ok} sticker${ok === 1 ? "" : "s"} subido${ok === 1 ? "" : "s"}`);
    } finally {
      setUploading(null);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (let fi = 0; fi < folders.length; fi++) {
        const f = folders[fi];
        if (!f.name.trim()) continue;
        const folderPayload = {
          product_id: productId,
          name: f.name.trim(),
          slug: f.slug || slugify(f.name),
          sort_order: fi,
          active: f.active,
        };
        let folderId = f.id;
        if (folderId) {
          await supabase.from("product_sticker_folders").update(folderPayload).eq("id", folderId);
        } else {
          const { data, error } = await supabase
            .from("product_sticker_folders")
            .insert(folderPayload)
            .select()
            .single();
          if (error) throw error;
          folderId = data.id;
        }

        for (let si = 0; si < f.stickers.length; si++) {
          const s = f.stickers[si];
          if (!s.name.trim()) continue;
          const stickerPayload = {
            folder_id: folderId,
            name: s.name.trim(),
            image_url: s.image_url,
            sort_order: si,
            active: s.active,
          };
          if (s.id) {
            await supabase.from("product_stickers").update(stickerPayload).eq("id", s.id);
          } else {
            await supabase.from("product_stickers").insert(stickerPayload);
          }
        }
      }
      toast.success("Carpetas y stickers guardados");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        className="mx-auto my-8 w-full max-w-3xl rounded-2xl bg-background p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Carpetas y stickers</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-4">
            {folders.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay carpetas. Agregá la primera.</p>
            )}
            {folders.map((f, fi) => (
              <div key={fi} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Nombre carpeta</Label>
                    <Input
                      value={f.name}
                      onChange={(e) =>
                        updateFolder(fi, {
                          name: e.target.value,
                          slug: f.id ? f.slug : slugify(e.target.value),
                        })
                      }
                      placeholder="Argentina"
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      checked={f.active}
                      onCheckedChange={(v) => updateFolder(fi, { active: v })}
                    />
                    <Label className="text-xs">Activa</Label>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFolder(fi)}>
                    <Trash2 />
                  </Button>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Stickers</Label>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
                        {uploading === `bulk-${fi}` ? "Subiendo…" : "📁 Subir varias"}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={uploading === `bulk-${fi}`}
                          onChange={(e) => {
                            if (e.target.files?.length) bulkUploadStickers(fi, e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button type="button" variant="outline" size="sm" onClick={() => addSticker(fi)}>
                        <Plus /> Agregar sticker
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {f.stickers.map((s, si) => (
                      <div key={si} className="flex items-center gap-2 rounded-lg border bg-background p-2">
                        <label className="grid h-14 w-14 flex-shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed bg-muted text-muted-foreground hover:bg-muted/70">
                          {s.image_url ? (
                            <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                          ) : uploading === `${fi}-${si}` ? (
                            <span className="text-[10px]">…</span>
                          ) : (
                            <Plus size={16} />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              e.target.files?.[0] && uploadStickerImg(fi, si, e.target.files[0])
                            }
                          />
                        </label>
                        <div className="min-w-0 flex-1 space-y-1">
                          <Input
                            value={s.name}
                            onChange={(e) => updateSticker(fi, si, { name: e.target.value })}
                            placeholder="Nombre"
                            className="h-8"
                          />
                          <div className="flex items-center gap-2 text-xs">
                            <Switch
                              checked={s.active}
                              onCheckedChange={(v) => updateSticker(fi, si, { active: v })}
                            />
                            <span className="text-muted-foreground">Activo</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeSticker(fi, si)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addFolder}>
              <Plus /> Agregar carpeta
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? "Guardando…" : "Guardar todo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
