import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/hooks/useShopData";
import { productOnSale, productDiscountPercent } from "@/lib/offers";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const OffersPage = () => {
  const { data: products, isLoading } = useProducts();
  const onSale = useMemo(() => {
    return (products ?? [])
      .filter((p: any) => productOnSale(p))
      .sort((a: any, b: any) => productDiscountPercent(b) - productDiscountPercent(a));
  }, [products]);

  return (
    <div className="container py-10">
      <h1 className="mb-2 text-3xl md:text-4xl">Ofertas</h1>
      <p className="mb-8 text-muted-foreground">Aprovechá los descuentos vigentes.</p>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      ) : onSale.length === 0 ? (
        <div className="rounded-2xl border bg-muted p-10 text-center text-muted-foreground">No hay ofertas activas en este momento.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {onSale.map((p: any) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
};

export default OffersPage;
