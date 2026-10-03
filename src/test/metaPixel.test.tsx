import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_META_PIXEL_ID", "123456789012345");
  window.history.replaceState({}, "", "/");
  delete window.fbq;
  delete window._fbq;
  document.head.querySelectorAll('script[src*="connect.facebook.net"]').forEach((s) => s.remove());
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Meta Pixel", () => {
  const product = { id: "p1", slug: "entradas", name: "Entradas", category: { name: "Eventos" } };

  it("tracks a product once across StrictMode and data refreshes, then on a new visit", async () => {
    window.history.replaceState({}, "", "/producto/entradas");
    const { default: ProductPixel } = await import("@/components/ProductPixel");
    const view = render(<StrictMode><ProductPixel key="visit1" product={product} /></StrictMode>);
    view.rerender(<StrictMode><ProductPixel key="visit1" product={{ ...product }} /></StrictMode>);
    expect(window.fbq!.queue.filter((a) => a[2] === "ViewContent")).toHaveLength(1);
    view.rerender(<StrictMode><ProductPixel key="visit2" product={product} /></StrictMode>);
    expect(window.fbq!.queue.filter((a) => a[2] === "ViewContent")).toHaveLength(2);
    expect(window.fbq!.queue.at(-1)?.[3]).toEqual({ content_ids: ["p1"], content_type: "product", content_name: "Entradas", content_category: "Eventos", product_slug: "entradas" });
  });

  it("sends only approved product fields for WhatsApp and excludes private routes", async () => {
    const { trackWhatsAppContact, trackProductView } = await import("@/lib/metaPixel");
    window.history.replaceState({}, "", "/producto/entradas?email=private@example.com");
    trackWhatsAppContact("product", { ...product, phone: "private-phone", message: "private-message" } as typeof product);
    const contact = window.fbq!.queue.at(-1);
    expect(contact?.[2]).toBe("Contact");
    expect(contact?.[3]).toMatchObject({ contact_channel: "whatsapp", contact_source: "product", page_path: "/producto/entradas", content_ids: ["p1"] });
    expect(JSON.stringify(contact)).not.toContain("private");
    for (const path of ["/admin", "/carrito", "/pago/exito", "/carrito-compartido/token"]) {
      window.history.replaceState({}, "", path);
      trackWhatsAppContact("floating");
      trackProductView(product);
    }
    expect(window.fbq!.queue.filter((a) => a[0] === "trackSingle")).toHaveLength(1);
  });

  it("does not break contact when the SDK throws", async () => {
    const { trackWhatsAppContact } = await import("@/lib/metaPixel");
    trackWhatsAppContact("footer");
    window.fbq!.callMethod = () => { throw new Error("SDK unavailable"); };
    expect(() => trackWhatsAppContact("floating")).not.toThrow();
  });

  it("does not load or send anything without an ID or in development", async () => {
    const { trackPageView } = await import("@/lib/metaPixel");
    for (const id of ["", "TU_PIXEL_ID", "123<script>"]) {
      vi.stubEnv("VITE_META_PIXEL_ID", id);
      trackPageView();
    }
    vi.stubEnv("VITE_META_PIXEL_ID", "123456789012345");
    vi.stubEnv("PROD", false);
    trackPageView();
    expect(window.fbq).toBeUndefined();
    expect(document.head.querySelector('script[src*="connect.facebook.net"]')).toBeNull();
  });

  it("initializes once, avoids duplicate effects, and counts SPA return visits", async () => {
    const { default: MetaPixel } = await import("@/components/MetaPixel");
    let navigate: NavigateFunction;
    function Harness() { navigate = useNavigate(); return <MetaPixel />; }
    const router = { navigate: (path: string) => navigate(path) };
    render(<StrictMode><MemoryRouter><Harness /></MemoryRouter></StrictMode>);
    await act(() => router.navigate("/producto/pulseras-holograficas"));
    await act(() => router.navigate("/producto/pulseras-holograficas?variant=2"));
    await act(() => router.navigate("/admin"));
    await act(() => router.navigate("/pago/exito?sale_id=private"));
    await act(() => router.navigate("/carrito-compartido/private-token"));
    await act(() => router.navigate("/"));
    const queue = window.fbq!.queue;
    expect(queue.filter((a) => a[0] === "init")).toHaveLength(1);
    expect(queue.filter((a) => a[2] === "PageView")).toHaveLength(3);
    expect(document.head.querySelectorAll('script[src*="connect.facebook.net"]')).toHaveLength(1);
    expect(JSON.stringify(queue)).not.toContain("private");
  });

  it("does not initialize on a direct admin, cart, payment, or unknown route", async () => {
    const { default: MetaPixel } = await import("@/components/MetaPixel");
    let navigate: NavigateFunction;
    function Harness() { navigate = useNavigate(); return <MetaPixel />; }
    const router = { navigate: (path: string) => navigate(path) };
    render(<MemoryRouter initialEntries={["/admin/login"]}><Harness /></MemoryRouter>);
    await act(() => router.navigate("/carrito"));
    await act(() => router.navigate("/pago/exito"));
    await act(() => router.navigate("/carrito-compartido/token"));
    await act(() => router.navigate("/unknown"));
    expect(window.fbq).toBeUndefined();
  });
});
