import { useState } from "react";
import { usePaymentMethods } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const empty = { name: "", surcharge_pct: 0, active: true, sort_order: 0, provider: "manual" };

const AdminPaymentMethods = () => {
  const { data: methods = [] } = usePaymentMethods();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m: any) => { setEditing(m); setForm({ name: m.name, surcharge_pct: Number(m.surcharge_pct), active: m.active, sort_order: m.sort_order, provider: m.provider ?? "manual" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");
    const op = editing ? supabase.from("payment_methods").update(form).eq("id", editing.id) : supabase.from("payment_methods").insert(form);
    const { error } = await op;
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payment_methods"] });
    setOpen(false);
  };
  const del = async (id: string) => {
    if (!confirm("¿Eliminar?")) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payment_methods"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Métodos de pago</h1><p className="text-muted-foreground">Configurá cómo cobrás.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} método</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Proveedor</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (efectivo, transferencia, etc.)</SelectItem>
                    <SelectItem value="mercadopago">Mercado Pago (online)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Recargo (%)</Label><Input type="number" value={form.surcharge_pct} onChange={(e) => setForm({ ...form, surcharge_pct: Number(e.target.value) })} /></div>
              <div><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Activo</Label></div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Proveedor</TableHead><TableHead>Recargo</TableHead><TableHead>Orden</TableHead><TableHead>Activo</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {methods.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell><span className="text-xs rounded bg-muted px-2 py-0.5">{m.provider === "mercadopago" ? "Mercado Pago" : "Manual"}</span></TableCell>
                <TableCell>{m.surcharge_pct}%</TableCell>
                <TableCell>{m.sort_order}</TableCell>
                <TableCell>{m.active ? "Sí" : "No"}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil size={16} /></Button><Button size="icon" variant="ghost" onClick={() => del(m.id)}><Trash2 size={16} /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminPaymentMethods;
