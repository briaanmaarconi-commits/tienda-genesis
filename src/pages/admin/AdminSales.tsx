import { useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { Plus, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useSales } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatPrice } from "@/lib/helpers";
import SaleDetailDialog from "@/components/admin/SaleDetailDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STATUSES = ["pendiente", "abonado", "confirmada", "enviada", "entregada", "cancelada"];
const CARRIERS = ["Correo Argentino", "Andreani", "Otro"];

const statusPill = (status: string) => {
  const map: Record<string, string> = {
    pendiente: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    abonado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    confirmada: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    enviada: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
    entregada: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
    cancelada: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  };
  return cn("inline-flex rounded-full border px-3 py-0.5 text-xs font-medium", map[status] ?? "");
};

const orderNumber = (n?: number | null) => (n ? `#${n}` : "—");

const AdminSales = () => {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: sales = [], isLoading } = useSales({ status, search, from, to });
  const qc = useQueryClient();
  const [trackingFor, setTrackingFor] = useState<any | null>(null);
  const [trkCode, setTrkCode] = useState("");
  const [trkCarrier, setTrkCarrier] = useState("Correo Argentino");
  const [savingTrk, setSavingTrk] = useState(false);

  const updateStatus = async (sale: any, newStatus: string) => {
    if (newStatus === sale.status) return;
    const { error } = await supabase.from("sales").update({ status: newStatus as any }).eq("id", sale.id);
    if (error) return toast.error(error.message);
    toast.success("Estado actualizado");
    qc.invalidateQueries({ queryKey: ["sales"] });
  };

  const openShipping = (sale: any) => {
    setTrackingFor(sale);
    setTrkCode((sale as any).tracking_code ?? "");
    setTrkCarrier((sale as any).tracking_carrier ?? "Correo Argentino");
  };

  const confirmTracking = async () => {
    if (!trackingFor) return;
    if (!trkCode.trim()) return toast.error("Ingresá el código de seguimiento");
    setSavingTrk(true);
    const { error } = await supabase.from("sales").update({
      status: "enviada" as any,
      tracking_code: trkCode.trim(),
      tracking_carrier: trkCarrier,
    } as any).eq("id", trackingFor.id);
    if (error) { setSavingTrk(false); return toast.error(error.message); }
    if (trackingFor.customer?.email) {
      const { error: mailErr } = await supabase.functions.invoke("send-shipping-email", { body: { sale_id: trackingFor.id } });
      if (mailErr) toast.error("Envío guardado pero falló el email: " + mailErr.message);
      else toast.success("Envío guardado y email enviado");
    } else {
      toast.success("Envío actualizado (cliente sin email)");
    }
    setSavingTrk(false);
    setTrackingFor(null);
    qc.invalidateQueries({ queryKey: ["sales"] });
  };

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Listado de ventas</h1>
          <p className="text-muted-foreground">Todas las ventas de tu tienda.</p>
        </div>
        <Button asChild><Link to="/admin/ventas/nueva"><Plus /> Agregar venta</Link></Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="abonado">Abonado</SelectItem>
            <SelectItem value="confirmada">Confirmada</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="entregada">Entregada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Orden</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Envío</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="py-8 text-center">Cargando...</TableCell></TableRow>}
            {!isLoading && sales.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No hay ventas todavía.</TableCell></TableRow>}
            {sales.map((s: any) => {
              const isOpen = expanded.has(s.id);
              const date = new Date(s.created_at);
              const customerPhone = (s.customer?.phone ?? "").replace(/\D/g, "");
              return (
                <Fragment key={s.id}>
                  <TableRow className="border-b">
                    <TableCell>
                      <span className="font-bold text-primary">{orderNumber(s.order_number)}</span>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggle(s.id)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Ver {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {s.customer?.name ?? "—"}
                        {customerPhone && (
                          <a
                            href={`https://wa.me/${customerPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Enviar WhatsApp"
                            className="inline-flex text-green-600 hover:text-green-700"
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{date.toLocaleDateString("es-AR")}</div>
                      <div className="text-xs">{date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs</div>
                    </TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={(v) => updateStatus(s, v)}>
                        <SelectTrigger className={cn("h-8 w-[140px] text-xs", statusPill(s.status))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="mt-1 text-xs text-muted-foreground">{s.payment_method?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openShipping(s)}
                        className={cn(
                          "inline-flex flex-col items-start gap-0.5 rounded-lg border px-3 py-1.5 text-left transition-colors hover:bg-accent",
                          s.status === "entregada" ? "border-green-500/40 bg-green-500/10" : s.status === "enviada" ? "border-purple-500/40 bg-purple-500/10" : "border-yellow-500/40 bg-yellow-500/10"
                        )}
                      >
                        <span className={cn("text-xs font-medium", s.status === "entregada" ? "text-green-700 dark:text-green-400" : s.status === "enviada" ? "text-purple-700 dark:text-purple-400" : "text-yellow-700 dark:text-yellow-400")}>
                          {s.status === "entregada" ? "Entregado" : s.status === "enviada" ? "Enviado" : "Pendiente"}
                        </span>
                        {s.tracking_code ? (
                          <span className="text-[10px] text-muted-foreground">{s.tracking_code}</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{s.shipping_method?.name ?? "Cargar envío"}</span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatPrice(Number(s.total))}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setOpenId(s.id)}><Eye size={16} /></Button></TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={8} className="p-0">
                        <div className="px-6 py-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-center">Cantidad</TableHead>
                                <TableHead className="text-right">Precio unitario</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {s.items?.map((it: any) => (
                                <TableRow key={it.id}>
                                  <TableCell className="font-medium">{it.product_name}</TableCell>
                                  <TableCell className="text-center">{it.quantity}</TableCell>
                                  <TableCell className="text-right">{formatPrice(Number(it.unit_price))}</TableCell>
                                  <TableCell className="text-right font-bold">{formatPrice(Number(it.subtotal))}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <SaleDetailDialog id={openId} onOpenChange={(o) => !o && setOpenId(null)} />

      <Dialog open={!!trackingFor} onOpenChange={(o) => !o && setTrackingFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cargar envío</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ingresá el transporte y código de seguimiento. Al guardar se marcará como enviada y se le enviará el email al cliente.
            </p>
            <div>
              <label className="text-sm font-medium">Transporte</label>
              <Select value={trkCarrier} onValueChange={setTrkCarrier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Código de seguimiento</label>
              <Input value={trkCode} onChange={(e) => setTrkCode(e.target.value)} placeholder="Ej: 00008695850PTGM1L4T1501" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingFor(null)} disabled={savingTrk}>Cancelar</Button>
            <Button onClick={confirmTracking} disabled={savingTrk}>{savingTrk ? "Enviando..." : "Guardar envío + email"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSales;
