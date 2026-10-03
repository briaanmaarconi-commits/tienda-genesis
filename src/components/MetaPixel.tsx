import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { isPixelPage, trackPageView } from "@/lib/metaPixel";

export default function MetaPixel() {
  const { pathname } = useLocation();
  const previousPath = useRef<string>();

  useEffect(() => {
    // Ignore query/hash changes and repeated effects, but count return visits.
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (isPixelPage(pathname)) trackPageView();
  }, [pathname]);

  return null;
}
