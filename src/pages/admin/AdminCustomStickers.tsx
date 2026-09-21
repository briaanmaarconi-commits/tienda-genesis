import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  useStickerMaterials,
  useStickerFinishes,
  useStickerShapes,
  useStickerSizes,
  useStickerQuantities,
} from "@/hooks/useCustomSticker";

type FieldDef = { key: string; label: string; type?: "text" | "number"; step?: string };

function CrudSection({
  title,
  table,
  data,
  fields,
  emptyForm,
  display,
}: {
  title: string;
  table: string;
  data: any[];
  fields: FieldDef[];
  emptyForm: Record<string, any>;
  display: (row: any) => React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    const f: any = {};
    for (const k of Object.keys(emptyForm)) f[k] = row[k];
    setForm(f);
    setOpen(true);
  };
  const save = async () => {
    const payload: any = { ...form };
    for (const fd of fields) {
      if (fd.type === "number") payload[fd.key] = Number(payload[fd.key]) || 0;
    }
    const op = editing
      ? supabase.from(table as any).update(payload).eq("id", editing.id)
      : supabase.from(table as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [table] });
    setOpen(false);
    toast.success("Guardado");
  };
  const del = async (id: string) => {
    if (!confirm("¿Eliminar?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [table] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew} size="sm"><Plus size={16} /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {fields.map((fd) => (
                <div key={fd.key}>
                  <Label>{fd.label}</Label>
                  <Input
                    type={fd.type === "number" ? "number" : "text"}
                    step={fd.step}
                    value={form[fd.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [fd.key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Activo</Label>
              </div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
              <TableHead>Activo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                {display(row)}
                <TableCell>{row.active ? "Sí" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(row)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(row.id)}><Trash2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const AdminCustomStickers = () => {
  const { data: materials = [] } = useStickerMaterials(false);
  const { data: finishes = [] } = useStickerFinishes(false);
  const { data: shapes = [] } = useStickerShapes(false);
  const { data: sizes = [] } = useStickerSizes(false);
  const { data: quantities = [] } = useStickerQuantities(false);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Calcos personalizados</h1>
        <p className="text-muted-foreground">
          Configurá las opciones del configurador. Precio final = (precio base + recargo terminación) × multiplicador tamaño × cantidad × (1 - descuento %).
        </p>
      </div>
      <Tabs defaultValue="materials">
        <TabsList className="flex-wrap">
          <TabsTrigger value="materials">Materiales</TabsTrigger>
          <TabsTrigger value="finishes">Terminaciones</TabsTrigger>
          <TabsTrigger value="shapes">Formas</TabsTrigger>
          <TabsTrigger value="sizes">Tamaños</TabsTrigger>
          <TabsTrigger value="quantities">Cantidades</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="mt-4">
          <CrudSection
            title="Materiales"
            table="sticker_materials"
            data={materials}
            emptyForm={{ name: "", base_price: 0, sort_order: 0, active: true }}
            fields={[
              { key: "name", label: "Nombre" },
              { key: "base_price", label: "Precio base", type: "number", step: "0.01" },
              { key: "sort_order", label: "Orden", type: "number" },
            ]}
            display={(r) => (
              <>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.base_price}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="finishes" className="mt-4">
          <CrudSection
            title="Terminaciones"
            table="sticker_finishes"
            data={finishes}
            emptyForm={{ name: "", surcharge: 0, sort_order: 0, active: true }}
            fields={[
              { key: "name", label: "Nombre" },
              { key: "surcharge", label: "Recargo $", type: "number", step: "0.01" },
              { key: "sort_order", label: "Orden", type: "number" },
            ]}
            display={(r) => (
              <>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.surcharge}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="shapes" className="mt-4">
          <CrudSection
            title="Formas"
            table="sticker_shapes"
            data={shapes}
            emptyForm={{ name: "", icon: "", sort_order: 0, active: true }}
            fields={[
              { key: "name", label: "Nombre" },
              { key: "icon", label: "Ícono (opcional)" },
              { key: "sort_order", label: "Orden", type: "number" },
            ]}
            display={(r) => (
              <>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.icon ?? "-"}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="sizes" className="mt-4">
          <CrudSection
            title="Tamaños"
            table="sticker_sizes"
            data={sizes}
            emptyForm={{ label: "", width_cm: 0, height_cm: 0, price_multiplier: 1, sort_order: 0, active: true }}
            fields={[
              { key: "label", label: "Etiqueta" },
              { key: "width_cm", label: "Ancho (cm)", type: "number", step: "0.1" },
              { key: "height_cm", label: "Alto (cm)", type: "number", step: "0.1" },
              { key: "price_multiplier", label: "Multiplicador precio", type: "number", step: "0.01" },
              { key: "sort_order", label: "Orden", type: "number" },
            ]}
            display={(r) => (
              <>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell>{r.width_cm}</TableCell>
                <TableCell>{r.height_cm}</TableCell>
                <TableCell>x{r.price_multiplier}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="quantities" className="mt-4">
          <CrudSection
            title="Cantidades"
            table="sticker_quantities"
            data={quantities}
            emptyForm={{ quantity: 0, discount_pct: 0, sort_order: 0, active: true }}
            fields={[
              { key: "quantity", label: "Cantidad", type: "number" },
              { key: "discount_pct", label: "Descuento %", type: "number", step: "0.01" },
              { key: "sort_order", label: "Orden", type: "number" },
            ]}
            display={(r) => (
              <>
                <TableCell className="font-medium">{r.quantity}</TableCell>
                <TableCell>{r.discount_pct}%</TableCell>
                <TableCell>{r.sort_order}</TableCell>
              </>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCustomStickers;
