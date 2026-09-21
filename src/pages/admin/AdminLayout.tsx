import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { Image, LayoutDashboard, Package, Settings, Home, DollarSign, ChevronDown, ListOrdered, PlusCircle, Users, BarChart3, CreditCard, Truck, Tag, Sparkles, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const topItems = [
  { to: "/admin", end: true, label: "Inicio", Icon: LayoutDashboard },
  { to: "/admin/sitio", label: "Marca / Sitio", Icon: Settings },
  { to: "/admin/banners", label: "Banners", Icon: Image },
  { to: "/admin/productos", label: "Productos", Icon: Package },
  { to: "/admin/calcos-personalizados", label: "Calcos personalizados", Icon: Sparkles },
  { to: "/admin/adicionales", label: "Adicionales de producto", Icon: Sparkles },
];

const salesItems = [
  { to: "/admin/ventas", end: true, label: "Listado de ventas", Icon: ListOrdered },
  { to: "/admin/ventas/nueva", label: "Agregar venta", Icon: PlusCircle, badge: "¡Nuevo!" },
  { to: "/admin/clientes", label: "Clientes", Icon: Users },
  { to: "/admin/cupones", label: "Cupones", Icon: Tag },
  { to: "/admin/metricas", label: "Métricas", Icon: BarChart3 },
  { to: "/admin/gastos", label: "Gastos", Icon: Receipt },
  { to: "/admin/metodos-pago", label: "Métodos de pago", Icon: CreditCard },
  { to: "/admin/metodos-envio", label: "Métodos de envío", Icon: Truck },
  { to: "/admin/envios/tarifas", label: "Tarifas por zona", Icon: Truck },
  { to: "/admin/envios/zonas", label: "Cadetería local", Icon: Truck },
  { to: "/admin/envios/gratis", label: "Envío gratis", Icon: Truck },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`;

const AdminLayout = () => {
  const { pathname } = useLocation();
  const salesActive = salesItems.some((i) => i.end ? pathname === i.to : pathname.startsWith(i.to));
  const [salesOpen, setSalesOpen] = useState(salesActive);

  return (
    <AdminGuard>
      <div className="container py-8">
        <div className="grid gap-8 md:grid-cols-[240px_1fr]">
          <aside className="space-y-1">
            <Link to="/" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
              <Home size={16} /> Volver a la tienda
            </Link>
            {topItems.map(({ to, end, label, Icon }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}

            <button
              type="button"
              onClick={() => setSalesOpen(!salesOpen)}
              className={`mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${salesActive ? "text-primary" : ""} hover:bg-muted`}
            >
              <DollarSign size={16} /> Gestión de ventas
              <ChevronDown size={16} className={`ml-auto transition-transform ${salesOpen ? "rotate-180" : ""}`} />
            </button>
            {salesOpen && (
              <div className="ml-2 space-y-1 border-l pl-2">
                {salesItems.map(({ to, end, label, Icon, badge }) => (
                  <NavLink key={to} to={to} end={end} className={linkClass}>
                    <Icon size={16} /> <span className="flex-1">{label}</span>
                    {badge && <Badge className="bg-primary text-primary-foreground">{badge}</Badge>}
                  </NavLink>
                ))}
              </div>
            )}
          </aside>
          <main><Outlet /></main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default AdminLayout;
