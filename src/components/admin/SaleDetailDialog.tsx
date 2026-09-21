import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSale } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";
import { Trash2, Send, Download } from "lucide-react";
import JSZip from "jszip";
import { signStorageFiles } from "@/lib/storageFiles";

const STATUSES = ["pendiente", "abonado", "confirmada", "enviada", "entregada", "cancelada"];
const CARRIERS = ["Correo Argentino", "Andreani", "Otro"];

const SaleDetailDialog = ({ id, onOpenChange }: { id: string | null; onOpenChange: (o: boolean) => void }) => {
  const { data: sale } = useSale(id ?? undefined);
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("Correo Argentino");
  const [sending, setSending] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});

  // Customer uploads live in private buckets — resolve temporary signed URLs.
  useEffect(() => {
    const items: any[] = (sale as any)?.items ?? (sale as any)?.sale_items ?? [];
    if (!items.length) return;
    const photos = items.flatMap((it: any) => (Array.isArray(it.photos) ? it.photos : []));
    const files = items
      .map((it: any) => it.custom_sticker_config?.file_url)
      .filter((v: any): v is string => typeof v === "string" && !!v);
    (async () => {
      const [a, b] = await Promise.all([
        signStorageFiles("customer-photos", photos),
        signStorageFiles("custom-sticker-uploads", files),
      ]);
      setSigned({ ...a, ...b });
    })();
  }, [sale]);

  const src = (v: string) => signed[v] ?? v;

  useEffect(() => {
    if (sale) {
      setStatus(sale.status);
      setNotes(sale.notes ?? "");
      setTrackingCode((sale as any).tracking_code ?? "");
      setTrackingCarrier((sale as any).tracking_carrier ?? "Correo Argentino");
    }
  }, [sale]);

  const save = async () => {
    if (!id) return;
    const wasEnviada = sale?.status === "enviada";
    const becomesEnviada = status === "enviada" && !wasEnviada;
    const { error } = await supabase.from("sales").update({
      status: status as any,
      notes,
      tracking_code: trackingCode || null,
      tracking_carrier: trackingCarrier || null,
    } as any).eq("id", id);
    if (error) return toast.error(error.message);

    if (becomesEnviada && trackingCode.trim() && (sale as any)?.customer?.email) {
      const { error: mailErr } = await supabase.functions.invoke("send-shipping-email", { body: { sale_id: id } });
      if (mailErr) toast.error("Venta guardada pero falló el email: " + mailErr.message);
      else toast.success("Venta actualizada y email enviado al cliente");
    } else if (becomesEnviada && !trackingCode.trim()) {
      toast.success("Venta marcada como enviada (sin código de seguimiento, no se envió email)");
    } else {
      toast.success("Venta actualizada");
    }
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["sale", id] });
  };

  const resend = async () => {
    if (!id) return;
    if (!trackingCode.trim()) return toast.error("Falta código de seguimiento");
    setSending(true);
    await supabase.from("sales").update({ tracking_code: trackingCode, tracking_carrier: trackingCarrier } as any).eq("id", id);
    const { error } = await supabase.functions.invoke("send-shipping-email", { body: { sale_id: id } });
    setSending(false);
    if (error) toast.error(error.message); else toast.success("Email reenviado");
  };

  const del = async () => {
    if (!id || !confirm("¿Eliminar esta venta?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Venta eliminada");
    qc.invalidateQueries({ queryKey: ["sales"] });
    onOpenChange(false);
  };

  const downloadAllPhotos = async (photos: string[]) => {
    if (!photos.length || !id) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("fotos");
      const extFromType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      await Promise.all(
        photos.map(async (url, i) => {
          const res = await fetch(src(url));
          if (!res.ok) throw new Error(`No se pudo descargar la foto ${i + 1}`);
          const blob = await res.blob();
          let ext = extFromType[blob.type];
          if (!ext) {
            const parsed = url.split("?")[0].split(".").pop();
            ext = parsed && parsed.length <= 5 ? parsed : "jpg";
          }
          folder?.file(`foto_${i + 1}.${ext}`, blob);
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const objUrl = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `fotos_pedido_${id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("ZIP descargado");
    } catch (e: any) {
      toast.error(e.message || "Error al generar el ZIP");
    } finally {
      setZipping(false);
    }
  };

  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de venta</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p><strong>Fecha:</strong> {new Date(sale.created_at).toLocaleString("es-AR")}</p>
              <p><strong>Origen:</strong> {sale.source}</p>
            </div>
            {sale.customer && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-bold">Cliente</p>
                <p>{sale.customer.name}</p>
                {sale.customer.phone && <p>📱 {sale.customer.phone}</p>}
                {sale.customer.email && <p>✉️ {sale.customer.email}</p>}
              </div>
            )}
            {(() => {
              const s: any = sale;
              const methodName = s.shipping_method?.name;
              const hasShipping = s.shipping_postal_code || s.shipping_province || s.shipping_locality || s.shipping_branch_name || sale.customer?.address || methodName;
              if (!hasShipping) return null;
              const isBranch = !!s.shipping_branch_name;
              return (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
                  <p className="font-bold">📦 Datos de envío {isBranch ? "(Sucursal)" : "(Domicilio)"}</p>
                  {methodName && <p><strong>Método:</strong> {methodName}</p>}
                  {s.shipping_postal_code && <p><strong>CP:</strong> {s.shipping_postal_code}</p>}
                  {s.shipping_province && <p><strong>Provincia:</strong> {s.shipping_province}</p>}
                  {s.shipping_locality && <p><strong>Localidad:</strong> {s.shipping_locality}</p>}
                  {sale.customer?.address && <p><strong>Dirección:</strong> {sale.customer.address}</p>}
                  {isBranch && (
                    <>
                      <p><strong>Sucursal:</strong> {s.shipping_branch_name}</p>
                      {s.shipping_branch_id && <p><strong>ID sucursal:</strong> {s.shipping_branch_id}</p>}
                    </>
                  )}
                  {s.payment_method?.name && <p className="pt-1 border-t mt-2"><strong>💳 Pago:</strong> {s.payment_method.name}</p>}
                </div>
              );
            })()}
            <div>
              <p className="mb-2 font-bold">Items</p>
              <div className="space-y-2">
                {sale.items?.map((it: any) => {
                  const addons = Array.isArray(it.addons) ? it.addons : [];
                  const unitPrice = Number(it.unit_price) || 0;
                  const qty = Number(it.quantity) || 0;
                  const baseTotal = unitPrice * qty;
                  const cfg = it.custom_sticker_config;
                  return (
                    <div key={it.id} className="rounded border p-2 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold">{it.product_name}</span>
                        <span className="font-bold">{formatPrice(Number(it.subtotal))}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(unitPrice)} × {qty} = {formatPrice(baseTotal)}
                      </div>
                      {addons.length > 0 && (
                        <div className="pl-2 border-l-2 border-primary/30 text-xs space-y-0.5">
                          {addons.map((a: any, i: number) => {
                            const price = Number(a.extra_price) || 0;
                            const mult = a.per_unit ? (Number(it.quantity) || 1) : 1;
                            const addonTotal = price * mult;
                            return (
                              <div key={i} className="flex justify-between">
                                <span>
                                  <span className="text-muted-foreground">{a.group_name}:</span> {a.option_name}
                                  {a.per_unit && price > 0 ? ` (${formatPrice(price)} c/u)` : ""}
                                </span>
                                {addonTotal > 0 && <span>+{formatPrice(addonTotal)}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {cfg && (
                        <div className="pl-2 border-l-2 border-primary/30 text-xs text-muted-foreground">
                          {cfg.material?.name} · {cfg.finish?.name} · {cfg.shape?.name} · {cfg.size?.label} · {cfg.quantity?.quantity}u
                          {cfg.file_url && (
                            <> · <a href={src(cfg.file_url)} target="_blank" rel="noreferrer" className="text-primary underline">archivo</a></>
                          )}
                        </div>
                      )}
                      {Array.isArray(it.photos) && it.photos.length > 0 && (
                        <div className="pt-2 border-t mt-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold">📸 Fotos del cliente ({it.photos.length})</p>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                disabled={zipping}
                                onClick={() => downloadAllPhotos(it.photos)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                {zipping ? "Generando..." : "Descargar todo"}
                              </Button>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(it.photos.map((p: string) => src(p)).join("\n"))}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary underline"
                              >
                                Copiar links
                              </a>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
                            {it.photos.map((url: string, i: number) => (
                              <a
                                key={i}
                                href={src(url)}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="relative aspect-square overflow-hidden rounded border hover:opacity-80"
                                title={`Descargar foto ${i + 1}`}
                              >
                                <img src={src(url)} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                                <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">{i + 1}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(Number(sale.subtotal))}</span></div>
              {Number(sale.discount_amount) > 0 && <div className="flex justify-between text-green-600 dark:text-green-400"><span>Descuento{sale.coupon_code ? ` (${sale.coupon_code})` : ""}</span><span>-{formatPrice(Number(sale.discount_amount))}</span></div>}
              <div className="flex justify-between"><span>Envío</span><span>{formatPrice(Number(sale.shipping_cost))}</span></div>
              <div className="flex justify-between"><span>Recargo</span><span>{formatPrice(Number(sale.surcharge))}</span></div>
              <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span className="text-primary">{formatPrice(Number(sale.total))}</span></div>
            </div>
            <div>
              <label className="text-sm font-bold">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-bold">📦 Seguimiento de envío</p>
              <div className="grid grid-cols-2 gap-2">
                <Select value={trackingCarrier} onValueChange={setTrackingCarrier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Código de seguimiento" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Al cambiar el estado a "enviada" se envía un email automático al cliente con el código.</p>
              {(sale as any).tracking_code && (
                <Button variant="outline" size="sm" onClick={resend} disabled={sending}>
                  <Send className="h-3 w-3 mr-1" /> Reenviar email
                </Button>
              )}
            </div>
            <div>
              <label className="text-sm font-bold">Notas</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-between">
              <Button variant="destructive" size="sm" onClick={del}><Trash2 /> Eliminar</Button>
              <Button onClick={save}>Guardar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaleDetailDialog;

