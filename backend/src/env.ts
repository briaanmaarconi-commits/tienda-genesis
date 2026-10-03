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

  FILE_SIGNING_SECRET: z.string().min(32),
  STORAGE_DIR: z.string().min(1),
  PUBLIC_ORIGIN: z.string().url(),
  FRONTEND_ORIGIN: z.string().url(),
});

export const env = schema.parse(process.env);
if (env.META_CAPI_ENABLED && !env.META_CAPI_ACCESS_TOKEN.trim()) throw new Error("META_CAPI_ACCESS_TOKEN is required when META_CAPI_ENABLED=true");
