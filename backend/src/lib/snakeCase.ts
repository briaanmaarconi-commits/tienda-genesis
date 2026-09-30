// Drizzle returns JS objects keyed by the camelCase names declared in
// schema.ts; the existing (soon-to-be-ported) frontend still expects exactly
// what supabase-js used to hand it — raw Postgres column names, i.e.
// snake_case. Rather than rewrite every field reference across ~30 frontend
// files, every JSON response is rewritten back to snake_case once here, so
// the wire contract stays identical to the old Supabase REST API.
//
// Only keys that look like plain camelCase identifiers are touched — this
// deliberately leaves alone: JSONB column contents that were already written
// snake_case by the frontend (e.g. sale_items.addons's option_name/group_name),
// and maps keyed by arbitrary strings like storage paths or URLs (which contain
// '/', '.', etc. and so never match the identifier pattern).
const CAMEL_KEY = /^[a-z][a-zA-Z0-9]*$/;

function toSnakeKey(key: string): string {
  return CAMEL_KEY.test(key) ? key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`) : key;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

export function deepSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSnakeCase);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[toSnakeKey(k)] = deepSnakeCase(v);
    return out;
  }
  return value;
}
