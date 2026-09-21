import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";

// Public pages — lazy loaded
const ProductPage = lazy(() => import("./pages/ProductPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const PaymentReturnPage = lazy(() => import("./pages/PaymentReturnPage"));
const OffersPage = lazy(() => import("./pages/OffersPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AboutPage = lazy(() => import("./pages/InfoPages").then((m) => ({ default: m.AboutPage })));
const InfoPage = lazy(() => import("./pages/InfoPages").then((m) => ({ default: m.InfoPage })));
const PriceListPage = lazy(() => import("./pages/InfoPages").then((m) => ({ default: m.PriceListPage })));

// Admin — lazy loaded (heavy and rarely visited)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const AdminSite = lazy(() => import("./pages/admin/AdminSite"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminSales = lazy(() => import("./pages/admin/AdminSales"));
const AdminSaleNew = lazy(() => import("./pages/admin/AdminSaleNew"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminMetrics = lazy(() => import("./pages/admin/AdminMetrics"));
const AdminExpenses = lazy(() => import("./pages/admin/AdminExpenses"));
const AdminPaymentMethods = lazy(() => import("./pages/admin/AdminPaymentMethods"));
const AdminShippingMethods = lazy(() => import("./pages/admin/AdminShippingMethods"));
const AdminShippingRates = lazy(() => import("./pages/admin/AdminShippingRates"));
const AdminDeliveryZones = lazy(() => import("./pages/admin/AdminDeliveryZones"));
const AdminFreeShippingRules = lazy(() => import("./pages/admin/AdminFreeShippingRules"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminCustomStickers = lazy(() => import("./pages/admin/AdminCustomStickers"));
const AdminProductAddons = lazy(() => import("./pages/admin/AdminProductAddons"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageFallback = () => (
  <div className="container py-12 text-center text-sm text-muted-foreground">Cargando…</div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminHome />} />
                  <Route path="sitio" element={<AdminSite />} />
                  <Route path="banners" element={<AdminBanners />} />
                  <Route path="productos" element={<AdminProducts />} />
                  <Route path="ventas" element={<AdminSales />} />
                  <Route path="ventas/nueva" element={<AdminSaleNew />} />
                  <Route path="clientes" element={<AdminCustomers />} />
                  <Route path="metricas" element={<AdminMetrics />} />
                  <Route path="gastos" element={<AdminExpenses />} />
                  <Route path="metodos-pago" element={<AdminPaymentMethods />} />
                  <Route path="metodos-envio" element={<AdminShippingMethods />} />
                  <Route path="envios/tarifas" element={<AdminShippingRates />} />
                  <Route path="envios/zonas" element={<AdminDeliveryZones />} />
                  <Route path="envios/gratis" element={<AdminFreeShippingRules />} />
                  <Route path="cupones" element={<AdminCoupons />} />
                  <Route path="calcos-personalizados" element={<AdminCustomStickers />} />
                  <Route path="adicionales" element={<AdminProductAddons />} />
                </Route>
                <Route element={<Layout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/producto/:slug" element={<ProductPage />} />
                  <Route path="/carrito" element={<CartPage />} />
                  <Route path="/pago/:status" element={<PaymentReturnPage />} />
                  <Route path="/ofertas" element={<OffersPage />} />
                  <Route path="/lista-de-precios" element={<PriceListPage />} />
                  <Route path="/info" element={<InfoPage />} />
                  <Route path="/promos" element={<OffersPage />} />
                  <Route path="/nosotros" element={<AboutPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
