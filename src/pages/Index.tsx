import HeroSlider from "@/components/HeroSlider";
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/hooks/useShopData";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, ShieldCheck, CreditCard, Sparkles } from "lucide-react";
import { productOnSale, productDiscountPercent } from "@/lib/offers";
import { Link } from "react-router-dom";
import { useMemo } from "react";

const Index = () => {
  const { data: products, isLoading: lp } = useProducts({ featuredOnly: false });

  const onSale = useMemo(
    () => (products ?? []).filter((p: any) => productOnSale(p))
      .sort((a: any, b: any) => productDiscountPercent(b) - productDiscountPercent(a))
      .slice(0, 8),
    [products]
  );

  return (
    <>
      <HeroSlider />

      {onSale.length > 0 && (
        <section className="container mt-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl">🔥 Ofertas</h2>
            <Link to="/ofertas" className="text-sm font-medium text-primary hover:underline">Ver todas →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {onSale.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section className="container mt-16">
        <h2 className="mb-6 text-2xl md:text-3xl">Productos</h2>
        {lp ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : !products || products.length === 0 ? (
          <p className="rounded-2xl border bg-muted p-8 text-center text-muted-foreground">
            Aún no cargaste productos. Entrá al panel de admin para crearlos.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} product={p as any} />)}
          </div>
        )}
      </section>

      <section className="container mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { Icon: Truck, title: "Envíos a todo el país", text: "Por correo y privados." },
          { Icon: CreditCard, title: "Múltiples pagos", text: "Tarjeta, transferencia o efectivo." },
          { Icon: ShieldCheck, title: "Compra segura", text: "Tus datos siempre protegidos." },
          { Icon: Sparkles, title: "Calidad premium", text: "Productos de primera." },
        ].map(({ Icon, title, text }) => (
          <div key={title} className="rounded-2xl border bg-card p-6 text-center">
            <Icon className="mx-auto text-primary" />
            <h3 className="mt-3 font-bold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </>
  );
};

export default Index;
