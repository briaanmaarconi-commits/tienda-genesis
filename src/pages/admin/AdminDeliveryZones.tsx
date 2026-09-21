import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShippingMethods } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/helpers";
import { toast } from "sonner";

const empty = {
  shipping_method_id: "",
  name: "",
  postal_codes_text: "",
  cost: 0,
  estimated_time: "",
  active: true,
  sort_order: 0,
};

const AdminDeliveryZones = () => {
  const qc = useQueryClient();
  const { data: methods = [] } = useShippingMethods();
  const localMethods = methods.filter((m: any) => m.delivery_type === "local_zone" || m.provider === "local");

  const { data: zones = [] } = useQuery({
    queryKey: ["local_delivery_zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("local_delivery_zones" as any).select("*, shipping_method:shipping_methods(name)").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, shipping_method_id: localMethods[0]?.id ?? "" });
    setOpen(true);
  };
  const openEdit = (z: any) => {
    setEditing(z);
    setForm({
      shipping_method_id: z.shipping_method_id,
      name: z.name,
      postal_codes_text: (z.postal_codes ?? []).join(", "),
      cost: Number(z.cost),
      estimated_time: z.estimated_time ?? "",
      active: z.active,
      sort_order: z.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.shipping_method_id) return toast.error("Elegí un método de envío local");
    if (!form.name.trim()) return toast.error("Nombre requerido");
    const payload = {
      shipping_method_id: form.shipping_method_id,
      name: form.name,
      postal_codes: form.postal_codes_text.split(/[,\s]+/).map((s: string) => s.trim()).filter(Boolean),
      cost: Number(form.cost),
      estimated_time: form.estimated_time || null,
      active: form.active,
      sort_order: Number(form.sort_order),
    };
    const op = editing
      ? supabase.from("local_delivery_zones" as any).update(payload).eq("id", editing.id)
      : supabase.from("local_delivery_zones" as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["local_delivery_zones"] });
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar zona?")) return;
    const { error } = await supabase.from("local_delivery_zones" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["local_delivery_zones"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Zonas de cadetería local</h1>
          <p className="text-muted-foreground">Asigná costo por zona (lista de CPs) para envíos locales.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus /> Nueva zona</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nueva"} zona</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Método de envío local</Label>
                <Select value={form.shipping_method_id} onValueChange={(v) => setForm({ ...form, shipping_method_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Elegí..." /></SelectTrigger>
                  <SelectContent>
                    {localMethods.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Creá primero un método con tipo "Cadetería local"</div>}
                    {localMethods.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Zona Norte" /></div>
              <div>
                <Label>Códigos postales (separados por coma)</Label>
                <Input value={form.postal_codes_text} onChange={(e) => setForm({ ...form, postal_codes_text: e.target.value })} placeholder="1414, 1425, 1426" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Costo</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
                <div><Label>Plazo</Label><Input value={form.estimated_time} onChange={(e) => setForm({ ...form, estimated_time: e.target.value })} placeholder="en el día" /></div>
              </div>
              <div><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Activa</Label></div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Método</TableHead><TableHead>Zona</TableHead><TableHead>CPs</TableHead><TableHead>Costo</TableHead><TableHead>Plazo</TableHead><TableHead>Activa</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {zones.map((z: any) => (
              <TableRow key={z.id}>
                <TableCell>{z.shipping_method?.name ?? "—"}</TableCell>
                <TableCell className="font-medium">{z.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(z.postal_codes ?? []).join(", ")}</TableCell>
                <TableCell>{formatPrice(Number(z.cost))}</TableCell>
                <TableCell>{z.estimated_time ?? "—"}</TableCell>
                <TableCell>{z.active ? "Sí" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(z)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(z.id)}><Trash2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminDeliveryZones;
