import { Pool, types } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

// node-postgres hands NUMERIC back as strings, but PostgREST (what the
// frontend was written against) returned JSON numbers. Left as strings,
// frontend math like `base_price + surcharge` concatenates instead of adding.
types.setTypeParser(1700, (v) => parseFloat(v));

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
