import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShippingMethods } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/helpers";

const PROVINCES = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

const empty = {
  shipping_method_id: "",
  province: "",
  postal_code_from: "",
  postal_code_to: "",
  cost: 0,
  free_from_amount: "",
  active: true,
  sort_order: 0,
};

const AdminShippingRates = () => {
  const { data: methods = [] } = useShippingMethods();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: rates = [] } = useQuery({
    queryKey: ["shipping_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_rates" as any)
        .select("*, shipping_methods(name)")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      shipping_method_id: r.shipping_method_id,
      province: r.province ?? "",
      postal_code_from: r.postal_code_from ?? "",
      postal_code_to: r.postal_code_to ?? "",
      cost: Number(r.cost),
      free_from_amount: r.free_from_amount ?? "",
      active: r.active,
      sort_order: r.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.shipping_method_id) return toast.error("Elegí un método de envío");
    if (!form.province && !form.postal_code_from) return toast.error("Indicá provincia o rango de CP");
    const payload = {
      ...form,
      province: form.province || null,
      postal_code_from: form.postal_code_from || null,
      postal_code_to: form.postal_code_to || null,
      free_from_amount: form.free_from_amount === "" ? null : Number(form.free_from_amount),
    };
    const op = editing
      ? supabase.from("shipping_rates" as any).update(payload).eq("id", editing.id)
      : supabase.from("shipping_rates" as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["shipping_rates"] });
    toast.success("Guardado");
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar tarifa?")) return;
    const { error } = await supabase.from("shipping_rates" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["shipping_rates"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tarifas de envío</h1>
          <p className="text-muted-foreground">Cargá precios manuales por provincia o rango de código postal. Se usan como respaldo del cotizador de Andreani.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus /> Nueva tarifa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nueva"} tarifa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Método de envío</Label>
                <Select value={form.shipping_method_id} onValueChange={(v) => setForm({ ...form, shipping_method_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Elegí..." /></SelectTrigger>
                  <SelectContent>
                    {methods.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Provincia (opcional)</Label>
                <Select value={form.province || "_none"} onValueChange={(v) => setForm({ ...form, province: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Todas / por CP" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— (usar rango de CP)</SelectItem>
                    {PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>CP desde</Label><Input value={form.postal_code_from} onChange={(e) => setForm({ ...form, postal_code_from: e.target.value })} /></div>
                <div><Label>CP hasta</Label><Input value={form.postal_code_to} onChange={(e) => setForm({ ...form, postal_code_to: e.target.value })} /></div>
              </div>
              <div><Label>Costo</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
              <div><Label>Envío gratis desde monto (opcional)</Label><Input type="number" value={form.free_from_amount} onChange={(e) => setForm({ ...form, free_from_amount: e.target.value })} /></div>
              <div><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Activa</Label></div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Método</TableHead><TableHead>Provincia</TableHead><TableHead>CP</TableHead>
            <TableHead>Costo</TableHead><TableHead>Gratis desde</TableHead><TableHead>Activa</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rates.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.shipping_methods?.name}</TableCell>
                <TableCell>{r.province ?? "—"}</TableCell>
                <TableCell>{r.postal_code_from ? `${r.postal_code_from}${r.postal_code_to ? `–${r.postal_code_to}` : ""}` : "—"}</TableCell>
                <TableCell>{formatPrice(Number(r.cost))}</TableCell>
                <TableCell>{r.free_from_amount ? formatPrice(Number(r.free_from_amount)) : "—"}</TableCell>
                <TableCell>{r.active ? "Sí" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rates.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin tarifas cargadas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminShippingRates;
