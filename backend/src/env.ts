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

  FILE_SIGNING_SECRET: z.string().min(32),
  STORAGE_DIR: z.string().min(1),
  PUBLIC_ORIGIN: z.string().url(),
  FRONTEND_ORIGIN: z.string().url(),
});

export const env = schema.parse(process.env);
