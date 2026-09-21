import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomers, usePaymentMethods, useShippingMethods } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";
import { useQueryClient } from "@tanstack/react-query";

type LineItem = { product_id: string | null; product_name: string; unit_price: number; quantity: number; unit_cost: number };

const AdminSaleNew = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: customers = [] } = useCustomers();
  const { data: pays = [] } = usePaymentMethods();
  const { data: ships = [] } = useShippingMethods();
  const { data: products = [] } = useProducts({ activeOnly: false });

  const [customerId, setCustomerId] = useState<string>("__new__");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [paymentId, setPaymentId] = useState<string>("");
  const [shippingId, setShippingId] = useState<string>("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [status, setStatus] = useState("confirmada");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const pay = pays.find((p: any) => p.id === paymentId);
  const ship = ships.find((s: any) => s.id === shippingId);
  const surcharge = pay ? subtotal * (Number(pay.surcharge_pct) / 100) : 0;
  const shippingCost = ship ? Number(ship.cost) : 0;
  const total = subtotal + surcharge + shippingCost;

  const addItem = () => setItems([...items, { product_id: null, product_name: "", unit_price: 0, quantity: 1, unit_cost: 0 }]);
  const updateItem = (idx: number, patch: Partial<LineItem>) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const pickProduct = (idx: number, productId: string) => {
    const p: any = products.find((x: any) => x.id === productId);
    if (!p) return;
    updateItem(idx, { product_id: p.id, product_name: p.name, unit_price: Number(p.price), unit_cost: Number(p.cost) || 0 });
  };

  const submit = async () => {
    if (items.length === 0) return toast.error("Agregá al menos un item");
    setSaving(true);
    try {
      let custId = customerId === "__new__" ? null : customerId;
      if (customerId === "__new__") {
        if (!newCustomer.name.trim()) { setSaving(false); return toast.error("Nombre del cliente requerido"); }
        const { data: c, error } = await supabase.from("customers").insert(newCustomer).select().single();
        if (error) throw error;
        custId = c.id;
      }
      const { data: sale, error: e1 } = await supabase.from("sales").insert({
        customer_id: custId,
        payment_method_id: paymentId || null,
        shipping_method_id: shippingId || null,
        subtotal, shipping_cost: shippingCost, surcharge, total,
        status: status as any, source: "admin", notes,
      }).select().single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("sale_items").insert(
        items.map((it) => ({ sale_id: sale.id, product_id: it.product_id, product_name: it.product_name, unit_price: it.unit_price, unit_cost: it.unit_cost, quantity: it.quantity, subtotal: it.unit_price * it.quantity }))
      );
      if (e2) throw e2;
      toast.success("Venta creada");
      qc.invalidateQueries({ queryKey: ["sales"] });
      nav("/admin/ventas");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Nueva venta</h1>

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-bold">Cliente</h2>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__new__">+ Nuevo cliente</SelectItem>
              {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          {customerId === "__new__" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label>Nombre *</Label><Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></div>
              <div><Label>Dirección</Label><Input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} /></div>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Productos</h2>
            <Button size="sm" onClick={addItem}><Plus /> Agregar</Button>
          </div>
          <div className="mt-3 space-y-3">
            {items.map((it, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_80px_120px_auto] sm:items-end">
                <div>
                  <Label className="text-xs">Producto</Label>
                  <Select value={it.product_id ?? ""} onValueChange={(v) => pickProduct(i, v)}>
                    <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!it.product_id && <Input className="mt-1" placeholder="o nombre libre" value={it.product_name} onChange={(e) => updateItem(i, { product_name: e.target.value })} />}
                </div>
                <div><Label className="text-xs">Precio</Label><Input type="number" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Cant.</Label><Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(i, { quantity: Math.max(1, Number(e.target.value)) })} /></div>
                <div className="text-right font-bold">{formatPrice(it.unit_price * it.quantity)}</div>
                <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 /></Button>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Sin items.</p>}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <div>
            <Label>Método de pago</Label>
            <Select value={paymentId} onValueChange={setPaymentId}>
              <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
              <SelectContent>{pays.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}{Number(p.surcharge_pct) > 0 ? ` (+${p.surcharge_pct}%)` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Método de envío</Label>
            <Select value={shippingId} onValueChange={setShippingId}>
              <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
              <SelectContent>{ships.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}{Number(s.cost) > 0 ? ` (${formatPrice(Number(s.cost))})` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pendiente", "abonado", "confirmada", "enviada", "entregada", "cancelada"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </section>

        <section className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
          <div className="flex justify-between"><span>Envío</span><span>{formatPrice(shippingCost)}</span></div>
          <div className="flex justify-between"><span>Recargo</span><span>{formatPrice(surcharge)}</span></div>
          <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span className="text-primary">{formatPrice(total)}</span></div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => nav("/admin/ventas")}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando..." : "Crear venta"}</Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSaleNew;
