import { useMemo } from "react";
import { useSales } from "@/hooks/useSales";
import { formatPrice } from "@/lib/helpers";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const AdminMetrics = () => {
  const { data: sales = [] } = useSales();

  const stats = useMemo(() => {
    const valid = sales.filter((s: any) => s.status !== "cancelada");
    const totalRevenue = valid.reduce((s: number, x: any) => s + Number(x.total), 0);
    const count = valid.length;
    const avg = count ? totalRevenue / count : 0;

    const itemsCount = valid.reduce((s: number, x: any) => s + (x.items?.reduce((a: number, i: any) => a + i.quantity, 0) ?? 0), 0);

    // top 5 products
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    valid.forEach((s: any) => s.items?.forEach((i: any) => {
      const cur = map.get(i.product_name) ?? { name: i.product_name, qty: 0, revenue: 0 };
      cur.qty += i.quantity;
      cur.revenue += Number(i.subtotal);
      map.set(i.product_name, cur);
    }));
    const top = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // last 30 days
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    valid.forEach((s: any) => {
      const k = new Date(s.created_at).toISOString().slice(0, 10);
      if (k in days) days[k] += Number(s.total);
    });
    const chart = Object.entries(days).map(([date, total]) => ({ date: date.slice(5), total }));

    return { totalRevenue, count, avg, itemsCount, top, chart };
  }, [sales]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Métricas</h1>
      <p className="text-muted-foreground">Resumen de ventas (excluye canceladas).</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Ingresos totales</p><p className="mt-1 text-2xl font-bold text-primary">{formatPrice(stats.totalRevenue)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Cantidad de ventas</p><p className="mt-1 text-2xl font-bold">{stats.count}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Ticket promedio</p><p className="mt-1 text-2xl font-bold">{formatPrice(stats.avg)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Productos vendidos</p><p className="mt-1 text-2xl font-bold">{stats.itemsCount}</p></Card>
      </div>

      <Card className="mt-6 p-4">
        <h2 className="mb-4 font-bold">Ventas últimos 30 días</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.chart}>
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
        <h2 className="mb-4 font-bold">Top 5 productos</h2>
        {stats.top.length === 0 && <p className="text-sm text-muted-foreground">Sin datos.</p>}
        <div className="space-y-2">
          {stats.top.map((p) => (
            <div key={p.name} className="flex justify-between rounded border p-2 text-sm">
              <span>{p.name}</span>
              <span><strong>{p.qty}</strong> u · {formatPrice(p.revenue)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminMetrics;
