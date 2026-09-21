import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Truck, Loader2 } from "lucide-react";
import { useShippingMethods } from "@/hooks/useSales";
import { useShippingQuotes } from "@/hooks/useShippingQuotes";
import { inferProvinceFromCP } from "@/lib/argPostalCodes";
import { formatPrice } from "@/lib/helpers";

type Props = {
  product: any;
  totalUnits: number;
  cartTotal: number;
};

const ShippingEstimator = ({ product, totalUnits, cartTotal }: Props) => {
  const [cp, setCp] = useState("");
  const [submittedCp, setSubmittedCp] = useState("");
  const { data: methods = [] } = useShippingMethods(true);

  const province = useMemo(() => inferProvinceFromCP(submittedCp) ?? "", [submittedCp]);

  const items = useMemo(
    () => [{ product, qty: Math.max(1, totalUnits || 1) }],
    [product, totalUnits],
  );

  const { quotes, loading } = useShippingQuotes({
    methods,
    postalCode: submittedCp,
    province,
    items,
    cartTotal: Math.max(1000, cartTotal || 0),
  });

  const sorted = [...quotes].sort((a, b) => Number(a.cost) - Number(b.cost));

  return (
    <div className="mt-6 rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4" /> Calcular costo de envío
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedCp(cp.trim());
        }}
        className="flex gap-2"
      >
        <Input
          inputMode="numeric"
          placeholder="Tu código postal"
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 8))}
        />
        <Button type="submit" disabled={cp.length < 4} variant="secondary">
          Calcular
        </Button>
      </form>

      {submittedCp && (
        <div className="mt-3 space-y-2 text-sm">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cotizando…
            </div>
          )}
          {!loading && sorted.length === 0 && (
            <p className="text-muted-foreground">No hay envíos disponibles para ese CP.</p>
          )}
          {!loading &&
            sorted.map((q) => (
              <div
                key={q.method_id}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium">{q.method_name}</div>
                  {q.estimated_time && (
                    <div className="text-xs text-muted-foreground">{q.estimated_time}</div>
                  )}
                  {q.error && <div className="text-xs text-destructive">{q.error}</div>}
                </div>
                <div className="whitespace-nowrap font-semibold text-primary">
                  {q.free ? "Gratis" : formatPrice(Number(q.cost))}
                </div>
              </div>
            ))}
          {province && (
            <p className="text-xs text-muted-foreground">Provincia detectada: {province}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ShippingEstimator;
