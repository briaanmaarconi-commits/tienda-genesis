import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),

  SESSION_COOKIE_SECRET: z.string().min(32),
  COOKIE_SECURE: z.coerce.boolean().default(true),

  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  META_CAPI_ENABLED: z.enum(["true", "false"]).default("false").transform(v => v === "true"),
  META_PIXEL_ID: z.string().regex(/^\d{5,25}$/).default("2845894399129197"),
  META_CAPI_ACCESS_TOKEN: z.string().default(""),
  META_GRAPH_VERSION: z.string().regex(/^v\d+\.0$/).default("v26.0"),
  META_TEST_EVENT_CODE: z.string().max(100).default(""),

  // Kill switch for the public "X compró Y" storefront notice.
  RECENT_PURCHASES_ENABLED: z.enum(["true", "false"]).default("true").transform(v => v === "true"),

  // Correo Argentino "API MiCorreo". Optional: without all three the Correo
  // quote falls back to the legacy public calculator.
  MICORREO_USER: z.string().default(""),
  MICORREO_PASSWORD: z.string().default(""),
  MICORREO_CUSTOMER_ID: z.string().default(""),
  MICORREO_ENV: z.enum(["prod", "test"]).default("prod"),
  // Import paid Correo orders into MiCorreo automatically (set "false" to only allow the manual button).
  MICORREO_AUTO_IMPORT: z.enum(["true", "false"]).default("true").transform(v => v === "true"),

  // Correo Argentino "API PAQ.AR 2.0" (orders, labels, tracking): agreement id + API key.
  PAQAR_AGREEMENT: z.string().default(""),
  PAQAR_API_KEY: z.string().default(""),
  PAQAR_ENV: z.enum(["prod", "test"]).default("prod"),
  // Create orders through PAQ.AR (tracking number + label) instead of importing into MiCorreo.
  PAQAR_CREATE_ORDERS: z.enum(["true", "false"]).default("false").transform(v => v === "true"),
  // Registered sender id for the agreement, if Correo requires one (optional).
  PAQAR_SENDER_ID: z.string().default(""),
  // Sender printed on the label.
  PAQAR_SENDER_NAME: z.string().default("Genesis Impresiones"),
  PAQAR_SENDER_STREET: z.string().default("Bolivar"),
  PAQAR_SENDER_NUMBER: z.string().default("1696"),
  PAQAR_SENDER_CITY: z.string().default("Olavarria"),
  PAQAR_SENDER_STATE: z.string().default("B"),
  PAQAR_SENDER_ZIP: z.string().default("7400"),

  FILE_SIGNING_SECRET: z.string().min(32),
  STORAGE_DIR: z.string().min(1),
  PUBLIC_ORIGIN: z.string().url(),
  FRONTEND_ORIGIN: z.string().url(),

  // Key the WhatsApp agent uses to build shared carts (routes/bot.ts).
  // Empty turns the bot route off.
  BOT_API_KEY: z.string().refine((v) => v === "" || v.length >= 32, "BOT_API_KEY needs 32+ chars").default(""),
});

export const env = schema.parse(process.env);
if (env.META_CAPI_ENABLED && !env.META_CAPI_ACCESS_TOKEN.trim()) throw new Error("META_CAPI_ACCESS_TOKEN is required when META_CAPI_ENABLED=true");
