import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBanners } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ImageUploader from "@/components/admin/ImageUploader";
import ImageFocalEditor from "@/components/admin/ImageFocalEditor";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

const AdminBanners = () => {
  const { data: banners, refetch } = useBanners(false);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["banners"] }); };

  const newBanner = () => setEditing({
    title: "", subtitle: "", cta_text: "", cta_href: "/", image_url: null,
    bg_color: "#0ea5e9", sort_order: (banners?.length ?? 0), active: true,
    focal_x: 50, focal_y: 50, zoom: 1, fit: "cover", hide_text_mobile: false,
  });

  const save = async () => {
    const payload = { ...editing };
    delete payload.created_at; delete payload.updated_at;
    const { error } = editing.id
      ? await supabase.from("banners").update(payload).eq("id", editing.id)
      : await supabase.from("banners").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
    setEditing(null); refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Borrar banner?")) return;
    await supabase.from("banners").delete().eq("id", id);
    refresh();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const list = [...(banners ?? [])];
    const i = list.findIndex((b: any) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    await supabase.from("banners").update({ sort_order: list[j].sort_order }).eq("id", list[i].id);
    await supabase.from("banners").update({ sort_order: list[i].sort_order }).eq("id", list[j].id);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Banners</h1>
        <Button onClick={newBanner}><Plus /> Nuevo</Button>
      </div>

      <div className="space-y-3">
        {(banners ?? []).map((b: any) => (
          <div key={b.id} className="flex items-center gap-4 rounded-2xl border bg-card p-3">
            <div className="grid h-16 w-28 place-items-center overflow-hidden rounded-lg" style={{ background: b.bg_color || "#ddd" }}>
              {b.image_url && <img src={b.image_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold">{b.title || "(sin título)"}</p>
              <p className="truncate text-sm text-muted-foreground">{b.subtitle}</p>
            </div>
            <span className={`text-xs ${b.active ? "text-primary" : "text-muted-foreground"}`}>{b.active ? "Activo" : "Oculto"}</span>
            <Button variant="ghost" size="icon" onClick={() => move(b.id, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" onClick={() => move(b.id, 1)}><ArrowDown /></Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(b)}>Editar</Button>
            <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 /></Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="mx-auto my-8 w-full max-w-lg rounded-2xl bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold">{editing.id ? "Editar banner" : "Nuevo banner"}</h2>
            <ImageUploader bucket="banners" value={editing.image_url} onChange={(url) => setEditing({ ...editing, image_url: url })} />

            {editing.image_url && (
              <ImageFocalEditor
                url={editing.image_url}
                aspect="16 / 9"
                label="Encuadre del banner (lo que verán en la home)"
                value={{
                  focal_x: editing.focal_x ?? 50,
                  focal_y: editing.focal_y ?? 50,
                  zoom: editing.zoom ?? 1,
                  fit: (editing.fit as any) || "cover",
                }}
                onChange={(v) => setEditing({ ...editing, ...v })}
              />
            )}

            <div><Label>Título</Label><Input className="mt-2" value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><Label>Subtítulo</Label><Textarea className="mt-2" value={editing.subtitle || ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Texto del botón</Label><Input className="mt-2" value={editing.cta_text || ""} onChange={(e) => setEditing({ ...editing, cta_text: e.target.value })} /></div>
              <div><Label>Link del botón</Label><Input className="mt-2" value={editing.cta_href || ""} onChange={(e) => setEditing({ ...editing, cta_href: e.target.value })} /></div>
              <div><Label>Color de fondo</Label><Input className="mt-2" type="color" value={editing.bg_color || "#0ea5e9"} onChange={(e) => setEditing({ ...editing, bg_color: e.target.value })} /></div>
              <div className="flex items-center gap-3 pt-6"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Activo</Label></div>
              <div className="flex items-center gap-3 sm:col-span-2"><Switch checked={!!editing.hide_text_mobile} onCheckedChange={(v) => setEditing({ ...editing, hide_text_mobile: v })} /><Label>Ocultar título y texto en celular</Label></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBanners;
