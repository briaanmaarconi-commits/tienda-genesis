import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useBanners } from "@/hooks/useShopData";
import { Skeleton } from "@/components/ui/skeleton";
import { getImageUrl } from "@/lib/imageUrl";

const HeroSlider = () => {
  const { data: banners, isLoading } = useBanners();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!banners || banners.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % banners.length), 5500);
    return () => clearInterval(t);
  }, [banners]);

  if (isLoading) {
    return (
      <section className="container pt-4 sm:pt-6">
        <Skeleton className="h-[220px] sm:h-[320px] md:h-[420px] lg:h-[480px] w-full rounded-3xl" />
      </section>
    );
  }

  if (!banners || banners.length === 0) {
    return (
      <section className="container pt-4 sm:pt-6">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-glow px-6 py-12 sm:px-10 sm:py-16 md:px-16 md:py-24 text-primary-foreground text-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold">Bienvenido a tu tienda</h1>
          <p className="mt-4 text-base sm:text-lg opacity-95">Cargá tus banners desde el panel de administración.</p>
        </div>
      </section>
    );
  }

  const s: any = banners[i];
  const fx = typeof s.focal_x === "number" ? s.focal_x : 50;
  const fy = typeof s.focal_y === "number" ? s.focal_y : 50;
  const z = typeof s.zoom === "number" && s.zoom > 0 ? s.zoom : 1;
  const fit = s.fit === "contain" ? "contain" : "cover";

  const optimizedBg = s.image_url ? getImageUrl(s.image_url, { width: 1600, quality: 70 }) : null;

  const bg: React.CSSProperties = optimizedBg
    ? {
        backgroundImage: `url(${optimizedBg})`,
        backgroundSize: fit === "contain" ? "contain" : `${z * 100}% auto`,
        backgroundPosition: `${fx}% ${fy}%`,
        backgroundRepeat: "no-repeat",
        backgroundColor: s.bg_color || "hsl(var(--muted))",
      }
    : { background: s.bg_color || "hsl(var(--primary))" };

  const hideTextMobile = !!s.hide_text_mobile;

  return (
    <section className="w-full pt-4 sm:pt-6">
      {/* Preload the current banner image so it counts as LCP and starts early */}
      {optimizedBg && (
        <img
          src={optimizedBg}
          alt=""
          aria-hidden="true"
          // @ts-expect-error fetchpriority is a valid HTML attribute
          fetchpriority="high"
          decoding="async"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      )}
      <div
        className="relative overflow-hidden text-primary-foreground sm:container sm:mx-auto sm:rounded-3xl sm:shadow-[var(--shadow-card)] min-h-[200px] sm:min-h-[320px] md:min-h-[420px] lg:min-h-[480px]"
        style={bg}
      >
        {s.image_url && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        )}
        <div className={`relative flex h-full min-h-[200px] sm:min-h-[320px] md:min-h-[420px] lg:min-h-[480px] items-center px-5 py-8 sm:px-10 sm:py-12 md:px-16 md:py-16 ${hideTextMobile ? "md:flex" : "flex"}`}>
          <div className={`max-w-xl ${hideTextMobile ? "hidden md:block" : ""}`}>
            {s.title && (
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold drop-shadow leading-tight">
                {s.title}
              </h1>
            )}
            {s.subtitle && (
              <p className="mt-3 sm:mt-4 text-sm sm:text-lg md:text-xl opacity-95 drop-shadow line-clamp-3">
                {s.subtitle}
              </p>
            )}
            {s.cta_text && (
              <Button asChild size="lg" variant="secondary" className="mt-4 sm:mt-6 rounded-full font-bold">
                <Link to={s.cta_href || "/"}>{s.cta_text}</Link>
              </Button>
            )}
          </div>
        </div>
        {banners.length > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Slide ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`h-2.5 rounded-full transition-all ${idx === i ? "w-8 bg-white" : "w-2.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroSlider;
