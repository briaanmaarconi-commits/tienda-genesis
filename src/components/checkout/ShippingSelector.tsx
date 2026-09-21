import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/helpers";
import { AR_PROVINCES, inferProvinceFromCP } from "@/lib/argPostalCodes";
import { useShippingQuotes, type ShippingQuote } from "@/hooks/useShippingQuotes";
import { supabase } from "@/integrations/supabase/client";
import { Truck, MapPin, Store, Bike, Loader2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/useShopData";

type Props = {
  methods: any[];
  items: { product: any; qty: number }[];
  cartTotal: number;
  postalCode: string;
  province: string;
  onPostalCodeChange: (cp: string) => void;
  onProvinceChange: (p: string) => void;
  selectedMethodId: string;
  onSelect: (q: ShippingQuote) => void;
  selectedBranchId: string;
  selectedBranchName: string;
  onBranchChange: (id: string, name: string) => void;
};

const iconFor = (q: ShippingQuote) => {
  if (q.source === "pickup") return <Store size={18} className="text-primary" />;
  if (q.source === "local_zone") return <Bike size={18} className="text-primary" />;
  if (q.needs_branch) return <MapPin size={18} className="text-primary" />;
  return <Truck size={18} className="text-primary" />;
};

const ShippingSelector = ({
  methods, items, cartTotal,
  postalCode, province, onPostalCodeChange, onProvinceChange,
  selectedMethodId, onSelect,
  selectedBranchId, selectedBranchName, onBranchChange,
}: Props) => {
  const { data: settings } = useSiteSettings();
  const { quotes, loading } = useShippingQuotes({ methods, postalCode, province, items, cartTotal });
  const [branches, setBranches] = useState<any[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const selectedQuote = quotes.find((q) => q.method_id === selectedMethodId);
  const needsBranches = selectedQuote?.needs_branch && postalCode.length >= 4;

  // Auto-infer province from CP
  useEffect(() => {
    if (postalCode.length >= 4 && !province) {
      const p = inferProvinceFromCP(postalCode);
      if (p) onProvinceChange(p);
    }
  }, [postalCode]);

  // Cargar sucursales cuando hace falta
  useEffect(() => {
    if (!needsBranches || !selectedQuote) return;
    let cancelled = false;
    setBranchLoading(true);
    setBranches([]);
    const provider = selectedQuote.provider ?? "";
    const methodName = selectedQuote.method_name?.toLowerCase() ?? "";
    const fnName =
      provider === "oca" || methodName.includes("oca") ? "oca-branches" :
      provider === "correo" || methodName.includes("correo") ? "correo-branches" :
      "andreani-branches";
    supabase.functions.invoke(fnName, { body: { postal_code: postalCode, province } })
      .then(({ data, error }) => {
        if (cancelled) return;
        setBranches(!error && Array.isArray(data?.branches) ? data.branches : []);
      })
      .finally(() => !cancelled && setBranchLoading(false));
    return () => { cancelled = true; };
  }, [needsBranches, selectedQuote?.provider, selectedQuote?.method_name, postalCode, province]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Código postal *</Label>
          <Input
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="1414"
            maxLength={8}
            inputMode="numeric"
          />
        </div>
        <div>
          <Label className="text-xs">Provincia</Label>
          <Select value={province} onValueChange={onProvinceChange}>
            <SelectTrigger><SelectValue placeholder="Elegí..." /></SelectTrigger>
            <SelectContent>
              {AR_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold">Opciones de envío *</Label>
        {postalCode.length < 4 ? (
          <p className="mt-2 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Ingresá tu código postal para ver las opciones disponibles.
          </p>
        ) : loading ? (
          <div className="mt-2 space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : quotes.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No hay métodos de envío configurados.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {quotes.map((q) => {
              const active = q.method_id === selectedMethodId;
              return (
                <button
                  type="button"
                  key={q.method_id}
                  onClick={() => onSelect(q)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"}`}
                >
                  <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-primary" : "border-muted-foreground/40"}`}>
                    {active && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </div>
                  {iconFor(q)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {q.method_name}
                      {q.free && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Gratis</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {q.estimated_time && <span>{q.estimated_time}</span>}
                      {q.source === "pickup" && (settings as any)?.address && <span>· {(settings as any).address}</span>}
                      {q.pickup_hours && <span>· {q.pickup_hours}</span>}
                      {q.error && <span className="text-amber-600">· {q.error}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${q.free ? "text-green-600 dark:text-green-400" : "text-primary"}`}>
                      {q.free ? "GRATIS" : formatPrice(q.cost)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {needsBranches && (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
          <Label className="text-xs">Sucursal *</Label>
          {branchLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Buscando sucursales cercanas...
            </div>
          )}
          {!branchLoading && branches.length > 0 && (
            <Select value={selectedBranchId} onValueChange={(id) => {
              const b = branches.find((x) => String(x.id) === id);
              onBranchChange(id, b?.name ?? id);
            }}>
              <SelectTrigger><SelectValue placeholder="Elegí una sucursal..." /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}{b.address ? ` — ${b.address}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!branchLoading && (
            <div className="space-y-1">
              <Input
                placeholder="Escribí la sucursal y dirección (ej: Sucursal Olavarría - Av. Pringles 123)"
                value={selectedBranchName}
                onChange={(e) => onBranchChange(e.target.value ? "manual" : "", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {branches.length === 0
                  ? "No pudimos cargar el listado automático. Indicá la sucursal más cercana a tu CP."
                  : "¿No está en la lista? Escribila acá."}{" "}
                {selectedQuote?.provider === "correo" || selectedQuote?.method_name?.toLowerCase().includes("correo") ? (
                  <a href="https://www.correoargentino.com.ar/formularios/oficinas-postales" target="_blank" rel="noreferrer" className="underline">
                    Buscar sucursales de Correo Argentino
                  </a>
                ) : selectedQuote?.provider === "andreani" || selectedQuote?.method_name?.toLowerCase().includes("andreani") ? (
                  <a href="https://www.andreani.com/sucursales" target="_blank" rel="noreferrer" className="underline">
                    Buscar sucursales de Andreani
                  </a>
                ) : null}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShippingSelector;
