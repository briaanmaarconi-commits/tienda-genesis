import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { attachUser } from "./middleware/auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerShippingRoutes } from "./routes/shipping.js";
import { registerStorage } from "./storage/index.js";
import { registerAdminRoutes } from "./routes/admin/index.js";
import { registerAdminUploadRoutes } from "./routes/admin/uploads.js";
import { registerAdminSiteSettingsRoutes } from "./routes/admin/site-settings.js";
import { registerAdminProductRoutes } from "./routes/admin/products.js";
import { registerAdminProductAddonRoutes } from "./routes/admin/product-addons.js";
import { registerAdminStickerFolderRoutes } from "./routes/admin/sticker-folders.js";
import { registerAdminBannerRoutes } from "./routes/admin/banners.js";
import { registerAdminCouponRoutes } from "./routes/admin/coupons.js";
import { registerAdminCustomerRoutes } from "./routes/admin/customers.js";
import { registerAdminExpenseRoutes } from "./routes/admin/expenses.js";
import { registerAdminShippingMethodRoutes } from "./routes/admin/shipping-methods.js";
import { registerAdminShippingRateRoutes } from "./routes/admin/shipping-rates.js";
import { registerAdminDeliveryZoneRoutes } from "./routes/admin/delivery-zones.js";
import { registerAdminFreeShippingRuleRoutes } from "./routes/admin/free-shipping-rules.js";
import { registerAdminPaymentMethodRoutes } from "./routes/admin/payment-methods.js";
import { registerAdminStickerCatalogRoutes } from "./routes/admin/sticker-catalog.js";
import { registerAdminSaleRoutes } from "./routes/admin/sales.js";
import { registerAdminSharedCartRoutes } from "./routes/admin/shared-carts.js";
import { registerSharedCartRoutes } from "./routes/shared-carts.js";
import { registerCheckoutRoutes } from "./routes/checkout.js";
import { registerMercadoPagoRoutes } from "./routes/mercadopago.js";
import { deepSnakeCase } from "./lib/snakeCase.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.FRONTEND_ORIGIN, credentials: true });
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

app.decorateRequest("user", null);
app.addHook("onRequest", attachUser);
app.addHook("preSerialization", async (_req, _reply, payload) => deepSnakeCase(payload));

app.get("/api/health", async () => ({ ok: true }));

await registerAuthRoutes(app);
await registerPublicRoutes(app);
await registerShippingRoutes(app);
await registerStorage(app);
await registerSharedCartRoutes(app);
await registerCheckoutRoutes(app);
await registerMercadoPagoRoutes(app);

await registerAdminRoutes(app, async (admin) => {
  await registerAdminUploadRoutes(admin);
  await registerAdminSiteSettingsRoutes(admin);
  await registerAdminProductRoutes(admin);
  await registerAdminProductAddonRoutes(admin);
  await registerAdminStickerFolderRoutes(admin);
  await registerAdminBannerRoutes(admin);
  await registerAdminCouponRoutes(admin);
  await registerAdminCustomerRoutes(admin);
  await registerAdminExpenseRoutes(admin);
  await registerAdminShippingMethodRoutes(admin);
  await registerAdminShippingRateRoutes(admin);
  await registerAdminDeliveryZoneRoutes(admin);
  await registerAdminFreeShippingRuleRoutes(admin);
  await registerAdminPaymentMethodRoutes(admin);
  await registerAdminStickerCatalogRoutes(admin);
  await registerAdminSaleRoutes(admin);
  await registerAdminSharedCartRoutes(admin);
});

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
