import { useEffect, useRef } from "react";
import { trackProductView, type PixelProduct } from "@/lib/metaPixel";

/** Mount only once the product exists; key by slug to count each new visit. */
export default function ProductPixel({ product }: { product: PixelProduct }) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackProductView(product);
  }, [product]);
  return null;
}
