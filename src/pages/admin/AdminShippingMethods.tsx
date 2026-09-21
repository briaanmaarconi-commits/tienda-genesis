import { useState } from "react";
import { useShippingMethods } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/helpers";

const empty = {
  name: "",
  cost: 0,
  active: true,
  sort_order: 0,
  rate_mode: "fixed",
  provider: "manual",
  delivery_type: "domicilio",
  estimated_time: "",
  pickup_hours: "",
};

const PROVIDERS = [
  { value: "manual", label: "Manual / Otro" },
  { value: "andreani", label: "Andreani" },
  { value: "oca", label: "OCA" },
  { value: "correo", label: "Correo Argentino" },
  { value: "local", label: "Cadetería local" },
  { value: "pickup", label: "Retiro en local" },
];

const DELIVERY_TYPES = [
  { value: "domicilio", label: "A domicilio" },
  { value: "sucursal", label: "A sucursal" },
  { value: "local_zone", label: "Cadetería por zona" },
  { value: "pickup", label: "Retiro en local" },
];

const AdminShippingMethods = () => {
  const { data: methods = [] } = useShippingMethods();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      name: m.name,
      cost: Number(m.cost),
      active: m.active,
      sort_order: m.sort_order,
      rate_mode: m.rate_mode ?? "fixed",
      provider: m.provider ?? "manual",
      delivery_type: m.delivery_type ?? "domicilio",
      estimated_time: m.estimated_time ?? "",
      pickup_hours: m.pickup_hours ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");
    const payload = {
      ...form,
      estimated_time: form.estimated_time || null,
      pickup_hours: form.pickup_hours || null,
    };
    const op = editing
      ? supabase.from("shipping_methods").update(payload).eq("id", editing.id)
      : supabase.from("shipping_methods").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["shipping_methods"] });
    setOpen(false);
  };
  const del = async (id: string) => {
    if (!confirm("¿Eliminar?")) return;
    const { error } = await supabase.from("shipping_methods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["shipping_methods"] });
  };

  const isPickup = form.provider === "pickup" || form.delivery_type === "pickup";
  const isLocal = form.provider === "local" || form.delivery_type === "local_zone";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Métodos de envío</h1><p className="text-muted-foreground">Configurá cómo entregás.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus /> Nuevo</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} envío</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Andreani a domicilio" /></div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Transportista</Label>
                  <Select value={form.provider} onValueChange={(v) => {
                    const patch: any = { provider: v };
                    if (v === "pickup") { patch.delivery_type = "pickup"; patch.cost = 0; patch.rate_mode = "fixed"; }
                    if (v === "local") { patch.delivery_type = "local_zone"; patch.rate_mode = "manual_table"; }
                    if (v === "andreani") { patch.rate_mode = "andreani_api"; }
                    setForm({ ...form, ...patch });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de entrega</Label>
                  <Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DELIVERY_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {!isPickup && (
                <div>
                  <Label>Modo de cálculo</Label>
                  <Select value={form.rate_mode} onValueChange={(v) => setForm({ ...form, rate_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Costo fijo</SelectItem>
                      <SelectItem value="andreani_api">Cotizador del transportista (Andreani/OCA/Correo)</SelectItem>
                      <SelectItem value="manual_table">Tabla manual por zona / CP local</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.rate_mode === "fixed" && "Se cobra siempre el costo de abajo."}
                    {form.rate_mode === "andreani_api" && "Cotización en tiempo real con el transportista elegido."}
                    {form.rate_mode === "manual_table" && (isLocal ? "Configurá las zonas en Envíos → Zonas locales." : "Configurá tarifas en Envíos → Tarifas por zona.")}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{isPickup ? "Costo (suele ser 0)" : `Costo ${form.rate_mode !== "fixed" ? "(fallback)" : ""}`}</Label>
                  <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Plazo estimado</Label>
                  <Input value={form.estimated_time} onChange={(e) => setForm({ ...form, estimated_time: e.target.value })} placeholder="3-5 días hábiles" />
                </div>
              </div>

              {isPickup && (
                <div>
                  <Label>Horarios de retiro</Label>
                  <Input value={form.pickup_hours} onChange={(e) => setForm({ ...form, pickup_hours: e.target.value })} placeholder="Lun-Vie 10-18hs" />
                </div>
              )}

              <div><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Activo</Label></div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Transportista</TableHead><TableHead>Tipo</TableHead><TableHead>Costo</TableHead><TableHead>Activo</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {methods.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-xs uppercase">{m.provider ?? "manual"}</TableCell>
                <TableCell className="text-xs">{m.delivery_type ?? "—"}</TableCell>
                <TableCell>{formatPrice(Number(m.cost))}</TableCell>
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

export default AdminShippingMethods;
