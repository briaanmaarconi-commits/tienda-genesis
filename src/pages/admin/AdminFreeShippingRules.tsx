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
import { AR_PROVINCES } from "@/lib/argPostalCodes";
import { toast } from "sonner";

const ANY = "__any__";
const empty = {
  shipping_method_id: ANY,
  min_amount: 0,
  province: ANY,
  postal_code_from: "",
  postal_code_to: "",
  active: true,
};

const AdminFreeShippingRules = () => {
  const qc = useQueryClient();
  const { data: methods = [] } = useShippingMethods();

  const { data: rules = [] } = useQuery({
    queryKey: ["free_shipping_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("free_shipping_rules" as any).select("*, shipping_method:shipping_methods(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      shipping_method_id: r.shipping_method_id ?? ANY,
      min_amount: Number(r.min_amount),
      province: r.province ?? ANY,
      postal_code_from: r.postal_code_from ?? "",
      postal_code_to: r.postal_code_to ?? "",
      active: r.active,
    });
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      shipping_method_id: form.shipping_method_id === ANY ? null : form.shipping_method_id,
      min_amount: Number(form.min_amount),
      province: form.province === ANY ? null : form.province,
      postal_code_from: form.postal_code_from || null,
      postal_code_to: form.postal_code_to || null,
      active: form.active,
    };
    const op = editing
      ? supabase.from("free_shipping_rules" as any).update(payload).eq("id", editing.id)
      : supabase.from("free_shipping_rules" as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["free_shipping_rules"] });
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar regla?")) return;
    const { error } = await supabase.from("free_shipping_rules" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["free_shipping_rules"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Envío gratis</h1>
          <p className="text-muted-foreground">Si una regla matchea, el costo de envío se fuerza a 0.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus /> Nueva regla</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nueva"} regla</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Aplica a método</Label>
                <Select value={form.shipping_method_id} onValueChange={(v) => setForm({ ...form, shipping_method_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Todos los métodos</SelectItem>
                    {methods.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Monto mínimo del carrito</Label><Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: Number(e.target.value) })} /></div>
              <div>
                <Label>Provincia (opcional)</Label>
                <Select value={form.province} onValueChange={(v) => setForm({ ...form, province: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Todas</SelectItem>
                    {AR_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CP desde</Label><Input value={form.postal_code_from} onChange={(e) => setForm({ ...form, postal_code_from: e.target.value })} /></div>
                <div><Label>CP hasta</Label><Input value={form.postal_code_to} onChange={(e) => setForm({ ...form, postal_code_to: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Activa</Label></div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Método</TableHead><TableHead>Mínimo</TableHead><TableHead>Provincia</TableHead><TableHead>CP</TableHead><TableHead>Activa</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rules.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.shipping_method?.name ?? <em className="text-muted-foreground">Todos</em>}</TableCell>
                <TableCell>{formatPrice(Number(r.min_amount))}</TableCell>
                <TableCell>{r.province ?? <em className="text-muted-foreground">Todas</em>}</TableCell>
                <TableCell className="text-xs">{r.postal_code_from || r.postal_code_to ? `${r.postal_code_from ?? ""} - ${r.postal_code_to ?? ""}` : "—"}</TableCell>
                <TableCell>{r.active ? "Sí" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminFreeShippingRules;
