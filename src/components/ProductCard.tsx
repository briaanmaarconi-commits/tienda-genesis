import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/helpers";
import { isOnSale, productOnSale, productDiscountPercent } from "@/lib/offers";
import SmartImage from "@/components/SmartImage";

type Img = { url: string; sort_order: number; focal_x?: number; focal_y?: number; zoom?: number; fit?: string };
type P = {
  slug: string;
  name: string;
  price?: number | string;
  compare_at_price?: number | string | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
  images?: Img[];
  packs?: any[];
};

const ProductCard = ({ product }: { product: P }) => {
  const img = product.images?.slice().sort((a, b) => a.sort_order - b.sort_order)[0];
  const onSale = productOnSale(product);
  const pct = onSale ? productDiscountPercent(product) : 0;
  const productSale = isOnSale(product as any);

  return (
    <Link
      to={`/producto/${product.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-[var(--shadow-card)]"
    >
      {onSale && pct > 0 && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground shadow">
          -{pct}%
        </span>
      )}
      <div className="aspect-square">
        <SmartImage
          url={img?.url}
          alt={product.name}
          focal_x={img?.focal_x}
          focal_y={img?.focal_y}
          zoom={img?.zoom}
          fit={img?.fit}
          width={400}
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-center group-hover:text-primary line-clamp-2">{product.name}</h3>
        {productSale && (
          <p className="mt-2 text-center text-sm">
            <span className="mr-1 text-muted-foreground line-through">{formatPrice(Number(product.compare_at_price))}</span>
            <span className="font-bold text-primary">{formatPrice(Number(product.price))}</span>
          </p>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
