import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Pencil, Plus, Trash2 } from "lucide-react";

const useProductsList = () =>
  useQuery({
    queryKey: ["admin-products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,slug").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

const useAddonGroups = (productId?: string) =>
  useQuery({
    queryKey: ["addon_groups", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("*, options:product_addon_options(*)")
        .eq("product_id", productId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

const AdminProductAddons = () => {
  const qc = useQueryClient();
  const { data: products = [] } = useProductsList();
  const [productId, setProductId] = useState<string>("");
  const { data: groups = [] } = useAddonGroups(productId);

  useEffect(() => {
    if (!productId && products.length > 0) setProductId((products[0] as any).id);
  }, [products, productId]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["addon_groups", productId] });

  const addGroup = async () => {
    const name = prompt("Nombre del grupo de adicionales (ej: Sistema QR)");
    if (!name) return;
    const { error } = await supabase
      .from("product_addon_groups")
      .insert({ product_id: productId, name, required: true, sort_order: groups.length });
    if (error) return toast.error(error.message);
    toast.success("Grupo creado");
    refresh();
  };

  const updateGroup = async (id: string, patch: any) => {
    const { error } = await supabase.from("product_addon_groups").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("¿Eliminar este grupo y todas sus opciones?")) return;
    await supabase.from("product_addon_options").delete().eq("group_id", id);
    const { error } = await supabase.from("product_addon_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Adicionales de producto</h1>
        <p className="text-sm text-muted-foreground">Definí grupos de opciones (ej: "Sistema QR") y sus precios adicionales. Se suman una sola vez al precio del producto.</p>
      </div>

      <div className="max-w-sm">
        <Label>Producto</Label>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger><SelectValue placeholder="Elegí un producto..." /></SelectTrigger>
          <SelectContent>
            {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {productId && (
        <>
          <Button onClick={addGroup}><Plus className="mr-1" size={16} /> Nuevo grupo</Button>

          {groups.length === 0 ? (
            <p className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">Este producto aún no tiene grupos de adicionales.</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g: any) => (
                <GroupCard key={g.id} group={g} onChange={refresh} onDelete={() => deleteGroup(g.id)} onUpdate={(patch) => updateGroup(g.id, patch)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

function GroupCard({
  group,
  onChange,
  onDelete,
  onUpdate,
}: {
  group: any;
  onChange: () => void;
  onDelete: () => void;
  onUpdate: (patch: any) => void;
}) {
  const [name, setName] = useState(group.name);
  const options = (group.options ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);

  const addOption = async () => {
    const n = prompt("Nombre de la opción");
    if (!n) return;
    const { error } = await supabase
      .from("product_addon_options")
      .insert({ group_id: group.id, name: n, extra_price: 0, sort_order: options.length });
    if (error) return toast.error(error.message);
    onChange();
  };

  const saveOption = async (id: string, patch: any) => {
    const { error } = await supabase.from("product_addon_options").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  const delOption = async (id: string) => {
    if (!confirm("¿Eliminar opción?")) return;
    const { error } = await supabase.from("product_addon_options").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label>Nombre del grupo</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== group.name && onUpdate({ name })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={group.required} onCheckedChange={(v) => onUpdate({ required: v })} />
          <span className="text-sm">Obligatorio</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={!!group.is_multiplier} onCheckedChange={(v) => onUpdate({ is_multiplier: v, ...(v ? { per_unit: false } : {}) })} />
          <span className="text-sm">Multiplicador</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={!!group.per_unit} disabled={!!group.is_multiplier} onCheckedChange={(v) => onUpdate({ per_unit: v })} />
          <span className="text-sm">Por unidad</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={group.active} onCheckedChange={(v) => onUpdate({ active: v })} />
          <span className="text-sm">Activo</span>
        </div>
        <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 size={14} /></Button>
      </div>

      {group.is_multiplier && (
        <p className="mt-2 text-xs text-muted-foreground">
          Este grupo no suma un precio: multiplica el precio del pack y de los adicionales de los grupos anteriores (ej: x50).
        </p>
      )}

      <div className="mt-4 space-y-2">
        {options.map((o: any) => (
          <OptionRow key={o.id} option={o} isMultiplier={!!group.is_multiplier} onSave={(p) => saveOption(o.id, p)} onDelete={() => delOption(o.id)} />
        ))}
        <Button variant="outline" size="sm" onClick={addOption}><Plus size={14} className="mr-1" /> Nueva opción</Button>
      </div>
    </Card>
  );
}

function OptionRow({ option, isMultiplier, onSave, onDelete }: { option: any; isMultiplier: boolean; onSave: (p: any) => void; onDelete: () => void }) {
  const [name, setName] = useState(option.name);
  const [price, setPrice] = useState(String(option.extra_price));
  const [mult, setMult] = useState(String(option.price_multiplier ?? 1));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
      <Input
        className="flex-1 min-w-[180px]"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== option.name && onSave({ name })}
      />
      {isMultiplier ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            className="w-28"
            type="number"
            step="1"
            min="1"
            value={mult}
            onChange={(e) => setMult(e.target.value)}
            onBlur={() => Number(mult) !== Number(option.price_multiplier ?? 1) && onSave({ price_multiplier: Number(mult) || 1 })}
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">+$</span>
          <Input
            className="w-28"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => Number(price) !== Number(option.extra_price) && onSave({ extra_price: Number(price) || 0 })}
          />
        </div>
      )}
      <div className="flex items-center gap-1">
        <Switch checked={option.active} onCheckedChange={(v) => onSave({ active: v })} />
        <span className="text-xs">Activo</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 size={14} /></Button>
    </div>
  );
}

export default AdminProductAddons;
