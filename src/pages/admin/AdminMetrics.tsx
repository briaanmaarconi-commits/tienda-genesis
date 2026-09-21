import { useMemo, useState } from "react";
import { useSales, useExpenses } from "@/hooks/useSales";
import { useSiteSettingsAdmin } from "@/hooks/useShopData";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowDown, ArrowUp } from "lucide-react";
import PeriodPicker, { PeriodRange, previousPeriod } from "@/components/admin/PeriodPicker";

const inRange = (d: Date, r: PeriodRange) => d >= r.from && d <= r.to;

const computeStats = (sales: any[], expenses: any[], range: PeriodRange) => {
  const salesInRange = sales.filter((s: any) => s.status !== "cancelada" && inRange(new Date(s.created_at), range));
  const revenue = salesInRange.reduce((s: number, x: any) => s + Number(x.total), 0);
  const count = salesInRange.length;
  const avg = count ? revenue / count : 0;
  const itemsCount = salesInRange.reduce((s: number, x: any) => s + (x.items?.reduce((a: number, i: any) => a + i.quantity, 0) ?? 0), 0);
  const cost = salesInRange.reduce(
    (s: number, x: any) => s + (x.items?.reduce((a: number, i: any) => a + Number(i.unit_cost ?? 0) * i.quantity, 0) ?? 0),
    0
  );
  const expensesInRange = expenses.filter((e: any) => inRange(new Date(`${e.expense_date}T12:00:00`), range));
  const expensesTotal = expensesInRange.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const profit = revenue - cost - expensesTotal;

  const map = new Map<string, { name: string; qty: number; revenue: number }>();
  salesInRange.forEach((s: any) => s.items?.forEach((i: any) => {
    const cur = map.get(i.product_name) ?? { name: i.product_name, qty: 0, revenue: 0 };
    cur.qty += i.quantity;
    cur.revenue += Number(i.subtotal);
    map.set(i.product_name, cur);
  }));
  const top = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  return { revenue, count, avg, itemsCount, cost, expensesTotal, profit, top };
};

const pctChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const Delta = ({ current, previous }: { current: number; previous: number }) => {
  const pct = pctChange(current, previous);
  const up = pct >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon size={12} /> {Math.abs(pct).toFixed(0)}%
    </span>
  );
};

const StatCard = ({ label, value, previousValue, hint }: { label: string; value: number; previousValue: number; hint?: string }) => (
  <Card className="p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-bold">{formatPrice(value)}</p>
    <div className="mt-1 flex items-center gap-2">
      <Delta current={value} previous={previousValue} />
      <span className="text-[11px] text-muted-foreground">vs. período anterior</span>
    </div>
    {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
  </Card>
);

const AdminMetrics = () => {
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();
  const { data: settings } = useSiteSettingsAdmin();
  const qc = useQueryClient();

  const [range, setRange] = useState<PeriodRange | null>(null);
  const [employeePct, setEmployeePct] = useState<string | null>(null);

  const current = useMemo(() => range ? computeStats(sales, expenses, range) : null, [sales, expenses, range]);
  const previous = useMemo(() => {
    if (!range) return null;
    return computeStats(sales, expenses, previousPeriod(range.from, range.to));
  }, [sales, expenses, range]);

  const chart = useMemo(() => {
    if (!range) return [];
    const days: Record<string, number> = {};
    const cursor = new Date(range.from);
    while (cursor <= range.to) {
      days[cursor.toISOString().slice(0, 10)] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    sales.forEach((s: any) => {
      if (s.status === "cancelada") return;
      const d = new Date(s.created_at);
      if (!inRange(d, range)) return;
      const k = d.toISOString().slice(0, 10);
      if (k in days) days[k] += Number(s.total);
    });
    return Object.entries(days).map(([date, total]) => ({ date: date.slice(5), total }));
  }, [sales, range]);

  const pct = Number(settings?.employee_profit_pct ?? 0);
  const employeeShare = current ? Math.max(0, current.profit) * pct / 100 : 0;

  const saveEmployeePct = async () => {
    if (employeePct === null || !settings?.id) return;
    const v = Number(employeePct);
    if (!Number.isFinite(v) || v < 0 || v > 100) return toast.error("Ingresá un porcentaje entre 0 y 100");
    const { error } = await supabase.from("site_settings").update({ employee_profit_pct: v } as any).eq("id", settings.id);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
    setEmployeePct(null);
    qc.invalidateQueries({ queryKey: ["site_settings_admin"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Métricas</h1>
          <p className="text-muted-foreground">Ventas, costos y ganancia (excluye ventas canceladas).</p>
        </div>
        <PeriodPicker onChange={setRange} />
      </div>

      {current && previous && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Ingresos" value={current.revenue} previousValue={previous.revenue} />
            <StatCard label="Costo de productos" value={current.cost} previousValue={previous.cost} />
            <StatCard label="Gastos" value={current.expensesTotal} previousValue={previous.expensesTotal} />
            <StatCard label="Ganancia" value={current.profit} previousValue={previous.profit} hint="Ingresos − costo de productos − gastos" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4"><p className="text-xs text-muted-foreground">Cantidad de ventas</p><p className="mt-1 text-2xl font-bold">{current.count}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Ticket promedio</p><p className="mt-1 text-2xl font-bold">{formatPrice(current.avg)}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Productos vendidos</p><p className="mt-1 text-2xl font-bold">{current.itemsCount}</p></Card>
            <Card className="p-4 bg-primary/5">
              <p className="text-xs text-muted-foreground">Parte del empleado ({pct}% de la ganancia)</p>
              <p className="mt-1 text-2xl font-bold text-primary">{formatPrice(employeeShare)}</p>
            </Card>
          </div>

          <Card className="mt-6 p-4">
            <h2 className="mb-2 font-bold">Porcentaje de ganancia para empleado</h2>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">% de la ganancia</Label>
                <Input
                  className="mt-1 w-32"
                  type="number" min="0" max="100" step="0.1"
                  value={employeePct ?? pct}
                  onChange={(e) => setEmployeePct(e.target.value)}
                />
              </div>
              <Button onClick={saveEmployeePct} disabled={employeePct === null}>Guardar</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Se aplica a la ganancia del período que estés viendo arriba (si la ganancia es negativa, la parte del empleado es $0).</p>
          </Card>

          <Card className="mt-6 p-4">
            <h2 className="mb-4 font-bold">Ventas del período</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => formatPrice(Number(v))} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="mt-6 p-4">
            <h2 className="mb-4 font-bold">Top 5 productos del período</h2>
            {current.top.length === 0 && <p className="text-sm text-muted-foreground">Sin datos.</p>}
            <div className="space-y-2">
              {current.top.map((p) => (
                <div key={p.name} className="flex justify-between rounded border p-2 text-sm">
                  <span>{p.name}</span>
                  <span><strong>{p.qty}</strong> u · {formatPrice(p.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminMetrics;
