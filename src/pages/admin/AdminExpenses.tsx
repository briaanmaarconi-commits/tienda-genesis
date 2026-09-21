import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/helpers";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["Publicidad", "Alquiler", "Luz", "Varios"];

const todayInput = () => new Date().toISOString().slice(0, 10);

const AdminExpenses = () => {
  const { data: expenses = [], refetch } = useExpenses();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [customCategory, setCustomCategory] = useState(false);

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["expenses"] }); };

  const newExpense = () => {
    setCustomCategory(false);
    setEditing({ category: CATEGORIES[0], description: "", amount: "", expense_date: todayInput() });
  };

  const save = async () => {
    if (!editing.category?.trim()) return toast.error("Elegí una categoría");
    if (!editing.amount || Number(editing.amount) <= 0) return toast.error("Ingresá un monto válido");

    const payload = {
      category: editing.category.trim(),
      description: editing.description?.trim() || null,
      amount: Number(editing.amount),
      expense_date: editing.expense_date || todayInput(),
    };

    const { error } = editing.id
      ? await supabase.from("expenses").update(payload).eq("id", editing.id)
      : await supabase.from("expenses").insert(payload);
    if (error) return toast.error(error.message);

    toast.success("Guardado");
    setEditing(null);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Borrar gasto?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    refresh();
  };

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gastos</h1>
          <p className="text-sm text-muted-foreground">Publicidad, alquiler, luz y otros gastos del negocio.</p>
        </div>
        <Button onClick={newExpense}><Plus /> Nuevo gasto</Button>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Total registrado</p>
        <p className="text-2xl font-bold">{formatPrice(total)}</p>
      </div>

      <div className="space-y-2">
        {expenses.length === 0 && <p className="text-sm text-muted-foreground">Sin gastos cargados.</p>}
        {expenses.map((e: any) => (
          <div key={e.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold">{e.category}{e.description ? ` · ${e.description}` : ""}</p>
              <p className="truncate text-xs text-muted-foreground">{new Date(`${e.expense_date}T00:00:00`).toLocaleDateString("es-AR")}</p>
            </div>
            <p className="font-bold">{formatPrice(Number(e.amount))}</p>
            <Button variant="outline" size="sm" onClick={() => { setCustomCategory(!CATEGORIES.includes(e.category)); setEditing(e); }}>Editar</Button>
            <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 /></Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="mx-auto my-8 w-full max-w-md rounded-2xl bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold">{editing.id ? "Editar gasto" : "Nuevo gasto"}</h2>

            <div>
              <Label>Categoría</Label>
              {!customCategory ? (
                <select
                  className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={CATEGORIES.includes(editing.category) ? editing.category : ""}
                  onChange={(e) => {
                    if (e.target.value === "__other__") { setCustomCategory(true); setEditing({ ...editing, category: "" }); }
                    else setEditing({ ...editing, category: e.target.value });
                  }}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__other__">Otra…</option>
                </select>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Input autoFocus placeholder="Nombre de la categoría" value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                  <Button type="button" variant="outline" onClick={() => { setCustomCategory(false); setEditing({ ...editing, category: CATEGORIES[0] }); }}>Volver</Button>
                </div>
              )}
            </div>

            <div><Label>Descripción (opcional)</Label>
              <Input className="mt-2" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Monto</Label>
                <Input className="mt-2" type="number" min="0" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
              </div>
              <div><Label>Fecha</Label>
                <Input className="mt-2" type="date" value={editing.expense_date} onChange={(e) => setEditing({ ...editing, expense_date: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExpenses;
