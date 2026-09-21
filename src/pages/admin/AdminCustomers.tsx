import { useState } from "react";
import { useCustomers } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

const empty = { name: "", phone: "", email: "", address: "", notes: "" };

const AdminCustomers = () => {
  const { data: customers = [], isLoading } = useCustomers();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", notes: c.notes ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");
    const op = editing ? supabase.from("customers").update(form).eq("id", editing.id) : supabase.from("customers").insert(form);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cliente actualizado" : "Cliente creado");
    qc.invalidateQueries({ queryKey: ["customers"] });
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    qc.invalidateQueries({ queryKey: ["customers"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Tu base de clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus /> Nuevo cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Dirección</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nombre</TableHead><TableHead>Teléfono</TableHead><TableHead>Email</TableHead><TableHead>Dirección</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!isLoading && customers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin clientes.</TableCell></TableRow>}
            {customers.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.address ?? "—"}</TableCell>
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

export default AdminCustomers;
