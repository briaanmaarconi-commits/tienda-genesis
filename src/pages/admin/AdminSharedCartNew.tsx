import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useShopData";
import { computeLineTotal, type CartItem, type CartProduct } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";

type Row = { rowId: string; productId: string; packId: string; qty: number };

const AdminSharedCartNew = () => {
  const nav = useNavigate();
  const { data: products = [] } = useProducts({ activeOnly: false });

  const [rows, setRows] = useState<Row[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const addRow = () => setRows([...rows, { rowId: crypto.randomUUID(), productId: "", packId: "", qty: 1 }]);
  const updateRow = (rowId: string, patch: Partial<Row>) =>
    setRows(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const removeRow = (rowId: string) => setRows(rows.filter((r) => r.rowId !== rowId));

  const toCartProduct = (row: Row): CartProduct | null => {
    const product: any = products.find((p: any) => p.id === row.productId);
    if (!product) return null;
    const pack = product.packs?.find((pk: any) => pk.id === row.packId);
    const image = product.images?.[0];
    return {
      slug: product.slug,
      name: product.name,
      price: Number(pack ? pack.price : product.price),
      units: pack?.units ?? null,
      label: pack?.label ?? null,
      variantId: pack?.id,
      image_url: image?.url ?? null,
      image_focal_x: image?.focal_x != null ? Number(image.focal_x) : null,
      image_focal_y: image?.focal_y != null ? Number(image.focal_y) : null,
      image_zoom: image?.zoom != null ? Number(image.zoom) : null,
      image_fit: image?.fit ?? null,
    };
  };

  const items: { row: Row; product: CartProduct | null }[] = rows.map((row) => ({ row, product: toCartProduct(row) }));
  const total = items.reduce((s, { row, product }) => s + (product ? computeLineTotal(product, row.qty) : 0), 0);

  const submit = async () => {
    const validItems = items.filter((i) => i.product);
    if (validItems.length === 0) return toast.error("Agregá al menos un producto");
    setSaving(true);
    try {
      const payload: { customer_name: string | null; customer_phone: string | null; notes: string | null; items: CartItem[] } = {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        notes: notes || null,
        items: validItems.map(({ row, product }) => ({ key: row.rowId, product: product!, qty: row.qty })),
      };
      const res = await api.post<{ url: string }>("/admin/shared-carts", payload);
      setResultUrl(res.url);
      toast.success("Carrito creado");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!resultUrl) return;
    navigator.clipboard.writeText(resultUrl);
    toast.success("Link copiado");
  };

  if (resultUrl) {
    return (
      <div>
        <h1 className="text-3xl font-bold">Carrito listo para compartir</h1>
        <div className="mt-6 rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Mandale este link al cliente. Al abrirlo va a ver estos productos ya cargados en el carrito, y ahí mismo
            elige y paga el envío.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm">{resultUrl}</code>
            <Button size="sm" variant="outline" onClick={copyLink}><Copy size={14} /> Copiar</Button>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => nav("/admin/carritos-compartidos")}>Ver listado</Button>
            <Button onClick={() => { setResultUrl(null); setRows([]); setCustomerName(""); setCustomerPhone(""); setNotes(""); }}>
              Crear otro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Armar carrito para un cliente</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Elegí los productos y cantidades. El cliente completa sus datos, elige el envío y paga desde el link que le
        compartas.
      </p>

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Productos</h2>
            <Button size="sm" onClick={addRow}><Plus /> Agregar</Button>
          </div>
          <div className="mt-3 space-y-3">
            {rows.map((row) => {
              const product: any = products.find((p: any) => p.id === row.productId);
              const cartProduct = toCartProduct(row);
              return (
                <div key={row.rowId} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1.5fr_80px_120px_auto] sm:items-end">
                  <div>
                    <Label className="text-xs">Producto</Label>
                    <Select value={row.productId} onValueChange={(v) => updateRow(row.rowId, { productId: v, packId: "" })}>
                      <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Variante</Label>
                    <Select
                      value={row.packId}
                      onValueChange={(v) => updateRow(row.rowId, { packId: v })}
                      disabled={!product?.packs?.length}
                    >
                      <SelectTrigger><SelectValue placeholder={product?.packs?.length ? "Elegir..." : "Base"} /></SelectTrigger>
                      <SelectContent>
                        {(product?.packs ?? []).map((pk: any) => (
                          <SelectItem key={pk.id} value={pk.id}>
                            {pk.label || (pk.units ? `Pack de ${pk.units}` : "Variante")} — {formatPrice(Number(pk.price))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Cant.</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.qty}
                      onChange={(e) => updateRow(row.rowId, { qty: Math.max(1, Number(e.target.value)) })}
                    />
                  </div>
                  <div className="text-right font-bold">
                    {cartProduct ? formatPrice(computeLineTotal(cartProduct, row.qty)) : "-"}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeRow(row.rowId)}><Trash2 /></Button>
                </div>
              );
            })}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin productos todavía.</p>}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <div><Label>Nombre del cliente (opcional)</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div><Label>Teléfono (opcional)</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Notas internas (opcional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </section>

        <section className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex justify-between text-lg font-bold"><span>Subtotal productos</span><span className="text-primary">{formatPrice(total)}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">No incluye envío — lo elige y paga el cliente al abrir el link.</p>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => nav("/admin/carritos-compartidos")}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Generando..." : "Generar link"}</Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSharedCartNew;
