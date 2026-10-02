import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSharedCarts } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, PlusCircle, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";
import { computeLineTotal } from "@/contexts/CartContext";

const statusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  completado: "Comprado",
};

const AdminSharedCarts = () => {
  const { data: carts = [], isLoading } = useSharedCarts();
  const qc = useQueryClient();

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/carrito-compartido/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este carrito compartido?")) return;
    await api.delete(`/admin/shared-carts/${id}`);
    qc.invalidateQueries({ queryKey: ["shared_carts"] });
    toast.success("Eliminado");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Carritos compartidos</h1>
        <Button asChild><Link to="/admin/carritos-compartidos/nuevo"><PlusCircle /> Armar carrito</Link></Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Carritos armados para un cliente específico. El cliente elige y paga el envío al abrir su link.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!isLoading && carts.length === 0 && <p className="text-sm text-muted-foreground">Todavía no armaste ninguno.</p>}
        {carts.map((c: any) => {
          const items = (c.items ?? []) as { product: any; qty: number }[];
          const total = items.reduce((s, it) => s + computeLineTotal(it.product, it.qty), 0);
          return (
            <div key={c.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.customer_name || "Sin nombre"} {c.customer_phone ? `(${c.customer_phone})` : ""}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("es-AR")}</p>
                </div>
                <Badge variant={c.status === "completado" ? "default" : "outline"}>
                  {statusLabel[c.status] ?? c.status}
                </Badge>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {items.map((it, i) => (
                  <span key={i}>
                    {it.product?.name}{it.product?.label ? ` (${it.product.label})` : ""} × {it.qty}
                    {i < items.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
              <div className="mt-1 text-sm font-bold">{formatPrice(total)} <span className="font-normal text-muted-foreground">(sin envío)</span></div>
              <div className="mt-3 flex gap-2">
                {c.status === "pendiente" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => copyLink(c.token)}><Copy size={14} /> Copiar link</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 size={14} /></Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSharedCarts;
