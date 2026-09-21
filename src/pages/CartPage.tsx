import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, computeLineTotal, getAddonsTotal } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, CheckCircle2, Tag, X } from "lucide-react";
import { usePaymentMethods, useShippingMethods } from "@/hooks/useSales";
import { validateCoupon } from "@/hooks/useCoupons";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useShopData";
import { toast } from "sonner";
import { z } from "zod";
import SmartImage from "@/components/SmartImage";
import ShippingSelector from "@/components/checkout/ShippingSelector";
import type { ShippingQuote } from "@/hooks/useShippingQuotes";

const customerSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido").max(100),
  phone: z.string().trim().min(6, "Teléfono requerido").max(30),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const CartPage = () => {
  const { items, setQty, remove, total, clear } = useCart();
  const { data: pays = [] } = usePaymentMethods(true);
  const { data: ships = [] } = useShippingMethods(true);
  const { data: settings } = useSiteSettings();
  const nav = useNavigate();

  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [paymentId, setPaymentId] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<ShippingQuote | null>(null);
  const [branchId, setBranchId] = useState("");
  const [branchName, setBranchName] = useState("");
  const isHomeDelivery = !!selectedQuote && !selectedQuote.needs_branch && selectedQuote.source !== "pickup";
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [transfer, setTransfer] = useState<any>(null);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const pay = pays.find((p: any) => p.id === paymentId);
  const discount = coupon?.discount ?? 0;
  const subtotalAfterDiscount = Math.max(0, total - discount);
  const surcharge = pay ? subtotalAfterDiscount * (Number(pay.surcharge_pct) / 100) : 0;
  const shippingCost = selectedQuote?.cost ?? 0;
  const grandTotal = subtotalAfterDiscount + surcharge + shippingCost;

  const applyCoupon = async () => {
    setApplyingCoupon(true);
    const res = await validateCoupon(couponInput, total);
    setApplyingCoupon(false);
    if (!res.valid) { setCoupon(null); return toast.error(res.error ?? "Cupón inválido"); }
    setCoupon({ code: res.coupon.code, discount: res.discount });
    toast.success(`Cupón ${res.coupon.code} aplicado`);
  };
  const removeCoupon = () => { setCoupon(null); setCouponInput(""); };

  const submit = async () => {
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    if (!paymentId) return toast.error("Elegí un método de pago");
    if (!selectedQuote) return toast.error("Elegí un método de envío");
    if (!postalCode) return toast.error("Ingresá tu código postal");
    if (selectedQuote.needs_branch && !branchName) return toast.error("Elegí una sucursal");
    if (isHomeDelivery && !locality.trim()) return toast.error("Ingresá la localidad");
    if (isHomeDelivery && !form.address.trim()) return toast.error("Ingresá la dirección de entrega");

    setSubmitting(true);
    try {
      const orderItems = items.map((it) => {
        const lineSubtotal = computeLineTotal(it.product, it.qty);
        return {
          product_name: `${it.product.name}${it.product.label ? ` (${it.product.label})` : ""}`,
          unit_price: it.product.price,
          quantity: it.qty,
          subtotal: lineSubtotal,
          custom_sticker_config: it.product.customStickerConfig ?? null,
          addons: it.product.addons ?? null,
          photos: it.product.photos ?? null,
        };
      });

      const { data: order, error: orderErr } = await supabase.functions.invoke("create-public-order", {
        body: {
          customer: { name: form.name, phone: form.phone, email: form.email || null, address: form.address || null },
          sale: {
            payment_method_id: paymentId,
            shipping_method_id: selectedQuote.method_id,
            subtotal: total,
            shipping_cost: shippingCost,
            surcharge,
            notes: form.notes || null,
            shipping_postal_code: postalCode || null,
            shipping_province: province || null,
            shipping_locality: locality || null,
            shipping_branch_id: branchId || null,
            shipping_branch_name: branchName || null,
          },
          items: orderItems,
          coupon_code: coupon?.code ?? null,
        },
      });
      if (orderErr || !order?.sale_id) {
        throw orderErr ?? new Error(order?.error || "No se pudo crear el pedido");
      }
      const sale = { id: order.sale_id as string };
      if (order.transfer) setTransfer(order.transfer);

      if (pay?.provider === "mercadopago") {
        const { data: mp, error: mpErr } = await supabase.functions.invoke("mp-create-preference", {
          body: { sale_id: sale.id },
        });
        if (mpErr || !mp?.init_point) {
          toast.error("No se pudo iniciar el pago con Mercado Pago");
          throw mpErr ?? new Error("Sin init_point");
        }
        clear();
        window.location.href = mp.init_point;
        return;
      }

      if (settings?.whatsapp) {
        const lines = items.map((it) => `• ${it.product.name}${it.product.label ? ` (${it.product.label})` : ""} × ${it.qty} = ${formatPrice(it.product.price * it.qty)}`).join("\n");
        const msg = `Nuevo pedido\n${form.name} (${form.phone})\n\n${lines}\n\nEnvío: ${selectedQuote.method_name}${branchName ? ` (${branchName})` : ""}\nTotal: ${formatPrice(grandTotal)}`;
        window.open(`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
      }

      clear();
      setDone(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSubmitting(false); }
  };

  if (done) {
    const isTransfer = pay?.provider === "manual" && /transfer/i.test(pay?.name ?? "");
    const wa = (settings?.whatsapp ?? "").replace(/\D/g, "");
    const waMsg = encodeURIComponent(`Hola! Acabo de hacer un pedido a nombre de ${form.name} por ${formatPrice(grandTotal)}. Te paso el comprobante de transferencia.`);
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-xl text-center">
          <CheckCircle2 className="mx-auto text-green-500" size={64} />
          <h1 className="mt-4 text-3xl font-bold">¡Pedido enviado!</h1>
          <p className="mt-2 text-muted-foreground">Te vamos a contactar para confirmar.</p>
        </div>

        {isTransfer && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border-2 border-primary/30 bg-card p-6 text-left shadow-lg">
            <h2 className="text-xl font-bold">💸 Datos para transferir</h2>
            <p className="mt-1 text-sm text-muted-foreground">Total a transferir: <span className="font-bold text-primary">{formatPrice(grandTotal)}</span></p>
            <div className="mt-4 space-y-3 text-sm">
              {transfer?.transfer_alias && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                  <div><p className="text-xs text-muted-foreground">Alias</p><p className="font-mono text-base font-bold">{transfer.transfer_alias}</p></div>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(transfer.transfer_alias!); toast.success("Alias copiado"); }}>Copiar</Button>
                </div>
              )}
              {transfer?.transfer_cbu && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                  <div><p className="text-xs text-muted-foreground">CBU / CVU</p><p className="font-mono text-sm font-bold break-all">{transfer.transfer_cbu}</p></div>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(transfer.transfer_cbu!); toast.success("CBU copiado"); }}>Copiar</Button>
                </div>
              )}
              {transfer?.transfer_holder && <p><span className="text-muted-foreground">Titular:</span> <span className="font-semibold">{transfer.transfer_holder}</span></p>}
              {transfer?.transfer_bank && <p><span className="text-muted-foreground">Banco:</span> <span className="font-semibold">{transfer.transfer_bank}</span></p>}
              {transfer?.transfer_notes && <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-800 dark:text-yellow-300">{transfer.transfer_notes}</p>}
            </div>
            {wa && (
              <a href={`https://wa.me/${wa}?text=${waMsg}`} target="_blank" rel="noreferrer" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700">
                Confirmar transferencia por WhatsApp
              </a>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button asChild className="rounded-full" size="lg"><Link to="/">Volver al inicio</Link></Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-3xl">Tu carrito está vacío</h1>
        <p className="mt-2 text-muted-foreground">Sumá productos y volvé acá para finalizar.</p>
        <Button asChild className="mt-6 rounded-full" size="lg"><Link to="/">Ver productos</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="mb-8 text-3xl">Tu carrito</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {items.map(({ key, product, qty }) => (
            <div key={key} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl">
                  <SmartImage
                    url={product.image_url}
                    alt={product.name}
                    focal_x={product.image_focal_x}
                    focal_y={product.image_focal_y}
                    zoom={product.image_zoom}
                    fit={product.image_fit}
                  />
                </div>
                <div className="flex-1">
                  <Link to={`/producto/${product.slug}`} className="font-semibold hover:text-primary">{product.name}</Link>
                  <p className="text-xs text-muted-foreground">{product.label || (product.units ? `Pack de ${product.units} u` : "")}</p>
                  {(() => {
                    const addonsExtra = getAddonsTotal(product, qty);
                    const lineTotal = computeLineTotal(product, qty);
                    return (
                      <p className="text-sm text-primary font-bold">
                        {formatPrice(product.price)} × {qty}
                        {addonsExtra > 0 ? ` + ${formatPrice(addonsExtra)}` : ""} = {formatPrice(lineTotal)}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex items-center rounded-full border">
                  <Button variant="ghost" size="icon" onClick={() => setQty(key, qty - 1)} disabled={!!product.photos?.length}><Minus /></Button>
                  <span className="w-8 text-center text-sm font-bold">{qty}</span>
                  <Button variant="ghost" size="icon" onClick={() => setQty(key, qty + 1)} disabled={!!product.photos?.length}><Plus /></Button>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(key)} aria-label="Eliminar"><Trash2 /></Button>
              </div>
              {product.addons && product.addons.length > 0 && (
                <div className="mt-3 border-t pt-3 text-xs">
                  {product.addons.map((a) => (
                    <p key={a.option_id} className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{a.group_name}:</span> {a.option_name}
                      {a.multiplier && Number(a.multiplier) !== 1
                        ? ` (× ${Number(a.multiplier)})`
                        : Number(a.extra_price) > 0
                          ? ` (+${formatPrice(Number(a.extra_price))}${a.per_unit ? " c/u" : ""})`
                          : ""}
                    </p>
                  ))}
                </div>
              )}
              {product.photos && product.photos.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Fotos para imprimir ({product.photos.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {product.photos.map((url, i) => (
                      <div key={i} className="h-14 w-14 overflow-hidden rounded-md border">
                        <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {product.customStickerConfig && (
                <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">Configuración del calco</p>
                  <p>{product.customStickerConfig.material.name} · {product.customStickerConfig.finish.name} · {product.customStickerConfig.shape.name} · {product.customStickerConfig.size.label} · {product.customStickerConfig.quantity.quantity}u</p>
                  <a href={product.customStickerConfig.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-primary underline">
                    📎 {product.customStickerConfig.file_name}
                  </a>
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={clear}>Vaciar carrito</Button>

          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold">Tus datos</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Nombre y apellido *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Teléfono *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Dirección</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold">Envío</h2>
            <ShippingSelector
              methods={ships}
              items={items}
              cartTotal={subtotalAfterDiscount}
              postalCode={postalCode}
              province={province}
              onPostalCodeChange={setPostalCode}
              onProvinceChange={setProvince}
              selectedMethodId={selectedQuote?.method_id ?? ""}
              onSelect={(q) => { setSelectedQuote(q); setBranchId(""); setBranchName(""); }}
              selectedBranchId={branchId}
              selectedBranchName={branchName}
              onBranchChange={(id, name) => { setBranchId(id); setBranchName(name); }}
            />
            {isHomeDelivery && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 border-t pt-4">
                <div className="sm:col-span-2">
                  <p className="text-sm font-semibold">Dirección de entrega</p>
                  <p className="text-xs text-muted-foreground">Completá los datos para que podamos enviarte el pedido.</p>
                </div>
                <div>
                  <Label>Localidad *</Label>
                  <Input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Ej: Olavarría" />
                </div>
                <div>
                  <Label>Dirección (calle, altura, piso y dpto) *</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ej: Av. Belgrano 1234, 2°B" />
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-bold">Resumen</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Método de pago *</Label>
                <Select value={paymentId} onValueChange={setPaymentId}>
                  <SelectTrigger><SelectValue placeholder="Elegí..." /></SelectTrigger>
                  <SelectContent>{pays.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}{Number(p.surcharge_pct) > 0 ? ` (+${p.surcharge_pct}%)` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 border-t pt-4">
              <Label className="flex items-center gap-1 text-sm"><Tag size={14} /> Código de descuento</Label>
              {coupon ? (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
                  <span className="font-mono font-bold text-green-700 dark:text-green-400">{coupon.code}</span>
                  <button onClick={removeCoupon} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="CÓDIGO" />
                  <Button onClick={applyCoupon} disabled={applyingCoupon} variant="outline">Aplicar</Button>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(total)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600 dark:text-green-400"><span>Descuento ({coupon?.code})</span><span>-{formatPrice(discount)}</span></div>}
              <div className="flex justify-between">
                <span>Envío {selectedQuote ? `(${selectedQuote.method_name})` : ""}</span>
                <span>{selectedQuote?.free ? "GRATIS" : formatPrice(shippingCost)}</span>
              </div>
              <div className="flex justify-between"><span>Recargo</span><span>{formatPrice(surcharge)}</span></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span className="text-primary">{formatPrice(grandTotal)}</span></div>
            </div>
            <Button size="lg" className="mt-6 w-full rounded-full" onClick={submit} disabled={submitting}>
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CartPage;
