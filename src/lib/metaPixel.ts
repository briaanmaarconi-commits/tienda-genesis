type PixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: PixelFunction;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: PixelFunction;
    _fbq?: PixelFunction;
  }
}

let initialized = false;

export function isPixelPage(pathname: string): boolean {
  return /^\/$|^\/(ofertas|promos|lista-de-precios|info|nosotros)\/?$|^\/producto\/[^/]+\/?$/.test(pathname);
}

/** Called by the public route tracker, never by the admin or payment flows. */
export function trackPageView(): void {
  const id = import.meta.env.VITE_META_PIXEL_ID?.trim();
  if (!import.meta.env.PROD || !id || !/^\d{5,25}$/.test(id)) return;

  if (!window.fbq) {
    const pixel = function (...args: unknown[]) {
      if (pixel.callMethod) pixel.callMethod(...args);
      else pixel.queue.push(args);
    } as PixelFunction;
    pixel.queue = [];
    pixel.push = pixel;
    pixel.loaded = true;
    pixel.version = "2.0";
    window.fbq = pixel;
    window._fbq = pixel;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  if (!initialized) {
    window.fbq("set", "autoConfig", false, id);
    window.fbq("init", id);
    initialized = true;
  }
  window.fbq("trackSingle", id, "PageView");
}
