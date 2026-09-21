import { CSSProperties } from "react";
import { getImageUrl } from "@/lib/imageUrl";

type Props = {
  url?: string | null;
  alt?: string;
  focal_x?: number | null;
  focal_y?: number | null;
  zoom?: number | null;
  fit?: string | null;
  className?: string;
  containerClassName?: string;
  fallback?: React.ReactNode;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  /** Target rendered width in CSS px (used to request a smaller image from the CDN). */
  width?: number;
};

/**
 * Renders an image with custom focal point, zoom, and fit (cover/contain).
 * Container should set its own aspect-ratio + size.
 */
const SmartImage = ({
  url,
  alt = "",
  focal_x,
  focal_y,
  zoom,
  fit,
  className = "",
  containerClassName = "",
  fallback,
  loading = "lazy",
  fetchPriority,
  width,
}: Props) => {
  const fx = typeof focal_x === "number" ? focal_x : 50;
  const fy = typeof focal_y === "number" ? focal_y : 50;
  const z = typeof zoom === "number" && zoom > 0 ? zoom : 1;
  const objectFit = fit === "contain" ? "contain" : "cover";

  const style: CSSProperties = {
    objectFit,
    objectPosition: `${fx}% ${fy}%`,
    transform: z !== 1 ? `scale(${z})` : undefined,
    transformOrigin: `${fx}% ${fy}%`,
  };

  const src = url ? getImageUrl(url, width ? { width: Math.round(width * (window.devicePixelRatio || 1)) } : {}) : "";

  return (
    <div className={`relative h-full w-full overflow-hidden bg-muted ${containerClassName}`}>
      {url ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          // @ts-expect-error fetchpriority is a valid HTML attribute, not yet in React types
          fetchpriority={fetchPriority}
          className={`h-full w-full ${className}`}
          style={style}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          {fallback ?? <span className="text-5xl">📦</span>}
        </div>
      )}
    </div>
  );
};

export default SmartImage;
