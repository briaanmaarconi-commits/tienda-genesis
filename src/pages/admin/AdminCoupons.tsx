import { useState } from "react";
import { useCoupons } from "@/hooks/useCoupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

const empty = {
  code: "", discount_type: "percentage" as "percentage" | "fixed", discount_value: 10,
  min_order_total: "", starts_at: "", ends_at: "", usage_limit: "", active: true,
};

const AdminCoupons = () => {
  const { data: coupons = [] } = useCoupons();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      code: c.code, discount_type: c.discount_type, discount_value: Number(c.discount_value),
      min_order_total: c.min_order_total ?? "", starts_at: c.starts_at?.slice(0, 16) ?? "",
      ends_at: c.ends_at?.slice(0, 16) ?? "", usage_limit: c.usage_limit ?? "", active: c.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.code.trim()) return toast.error("Código requerido");
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      min_order_total: form.min_order_total === "" ? null : Number(form.min_order_total),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      usage_limit: form.usage_limit === "" ? null : Number(form.usage_limit),
      active: form.active,
    };
    const op = editing ? supabase.from("coupons").update(payload).eq("id", editing.id) : supabase.from("coupons").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cupón actualizado" : "Cupón creado");
    qc.invalidateQueries({ queryKey: ["coupons"] });
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar cupón?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["coupons"] });
  };

  const statusOf = (c: any) => {
    if (!c.active) return "Inactivo";
    if (c.ends_at && new Date(c.ends_at).getTime() < Date.now()) return "Expirado";
    if (c.usage_limit != null && c.times_used >= c.usage_limit) return "Agotado";
    return "Activo";
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Cupones</h1><p className="text-muted-foreground">Códigos de descuento para tus clientes.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus /> Nuevo cupón</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} cupón</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="VERANO25" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                      <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Input type="number" min={0} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} /></div>
              </div>
              <div><Label>Mínimo de compra (opcional)</Label><Input type="number" min={0} value={form.min_order_total} onChange={(e) => setForm({ ...form, min_order_total: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Desde (opcional)</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>Hasta (opcional)</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <div><Label>Límite de usos (opcional)</Label><Input type="number" min={1} value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Activo</Label></div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descuento</TableHead><TableHead>Mín. compra</TableHead><TableHead>Vigencia</TableHead><TableHead>Usos</TableHead><TableHead>Estado</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {coupons.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin cupones.</TableCell></TableRow>}
            {coupons.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-bold">{c.code}</TableCell>
                <TableCell>{c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`}</TableCell>
                <TableCell>{c.min_order_total ? `$${c.min_order_total}` : "—"}</TableCell>
                <TableCell className="text-xs">
                  {c.starts_at ? new Date(c.starts_at).toLocaleDateString("es-AR") : "—"} → {c.ends_at ? new Date(c.ends_at).toLocaleDateString("es-AR") : "—"}
                </TableCell>
                <TableCell>{c.times_used}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</TableCell>
                <TableCell>{statusOf(c)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(c.id)}><Trash2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminCoupons;
