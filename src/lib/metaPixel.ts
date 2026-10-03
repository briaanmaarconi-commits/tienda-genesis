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

function initializePixel(): string | undefined {
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
  return id;
}

function trackEvent(name: "PageView" | "ViewContent" | "Contact", params?: Record<string, unknown>): void {
  // A blocked or failing analytics SDK must never prevent navigation or contact.
  try {
    const id = initializePixel();
    if (id) window.fbq!("trackSingle", id, name, params ?? {});
  } catch {
    // Tracking is best effort; the shop remains usable.
  }
}

export function trackPageView(): void {
  trackEvent("PageView");
}

export type PixelProduct = {
  id: string;
  slug: string;
  name: string;
  category?: { name?: string } | null;
};

function productParams(product: PixelProduct): Record<string, unknown> {
  return {
    content_ids: [String(product.id)],
    content_type: "product",
    content_name: product.name,
    ...(product.category?.name ? { content_category: product.category.name } : {}),
    product_slug: product.slug,
  };
}

export function trackProductView(product: PixelProduct): void {
  if (!isPixelPage(window.location.pathname)) return;
  trackEvent("ViewContent", productParams(product));
}

export function trackWhatsAppContact(source: "floating" | "footer" | "product", product?: PixelProduct): void {
  if (!isPixelPage(window.location.pathname)) return;
  trackEvent("Contact", {
    contact_channel: "whatsapp",
    contact_source: source,
    page_path: window.location.pathname,
    ...(product ? productParams(product) : {}),
  });
}
