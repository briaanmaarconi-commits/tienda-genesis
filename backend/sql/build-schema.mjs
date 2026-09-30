// Reads the 39 historical Supabase migration files, strips everything that
// only exists inside Supabase (RLS policies, storage.* schema objects, the
// auth.users-triggered admin bootstrap, and the has_role()/handle_new_user_role
// helper functions whose only callers were those policies/trigger), rewrites
// the one FK that pointed at auth.users to point at our new public.users
// table instead, and concatenates everything into a single schema file that
// applies cleanly against a bare Postgres database.
//
// Run: node build-schema.mjs   (writes ../sql/000_schema.sql)

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");
const OUT_FILE = join(__dirname, "000_schema.sql");

// --- Split a SQL file into top-level statements, respecting single-quoted
// strings and $tag$ dollar-quoted bodies so we never split (or match against)
// text that's actually inside a string/function body. ---
function splitStatements(sql) {
  const statements = [];
  let buf = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];

    // line comment
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? n : end + 1;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // single-quoted string (with '' escaping)
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }

    // dollar-quoted body: $$ or $tag$
    if (ch === "$") {
      const m = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const closeIdx = sql.indexOf(tag, i + tag.length);
        const end = closeIdx === -1 ? n : closeIdx + tag.length;
        buf += sql.slice(i, end);
        i = end;
        continue;
      }
    }

    if (ch === ";") {
      buf += ch;
      statements.push(buf);
      buf = "";
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }
  if (buf.trim().length > 0) statements.push(buf);
  return statements;
}

// Patterns for statements we drop entirely — they only make sense inside
// Supabase (RLS, storage schema, the auth.users-driven admin bootstrap).
// Anchored (^) patterns are tested against the statement with leading
// blank lines and `--` comments stripped, so a comment sitting just above
// e.g. a DROP POLICY doesn't hide it from the anchor.
const DROP_PATTERNS = [
  /\balter\s+table\b[^;]*\b(enable|disable)\s+row\s+level\s+security\b/i,
  /^\s*create\s+policy\b/i,
  /^\s*drop\s+policy\b/i,
  /\bstorage\.(buckets|objects)\b/i,
  /^\s*create\s+trigger\s+on_auth_user_created\b/i,
  /^\s*drop\s+trigger\s+if\s+exists\s+on_auth_user_created\b/i,
  /create\s+or\s+replace\s+function\s+public\.handle_new_user_role\b/i,
  /create\s+or\s+replace\s+function\s+public\.has_role\b/i,
  /\bgrant\b[^;]*\bto\s+(anon|authenticated|service_role)\b/i,
  /^\s*revoke\b/i,
  /^\s*insert\s+into\s+storage\./i,
  // Standalone DML (top-level insert/update/delete) is seed/backfill data from
  // the Lovable era — some of it references specific historical row ids that
  // don't exist in a fresh database. Real data comes entirely from the
  // pg_dump/restore data copy (see backend plan, phase 5), not from replaying
  // these migrations, so schema replay is DDL-only across the board. Schema
  // is optional here (some seed statements omit the `public.` prefix).
  /^\s*insert\s+into\s+(public\.)?[a-z_]+/i,
  /^\s*update\s+(public\.)?[a-z_]+\s+set\b/i,
  /^\s*delete\s+from\s+(public\.)?[a-z_]+/i,
  // Same idea, but for seed/backfill DML hidden inside an anonymous DO $$
  // block (e.g. `DO $$ DECLARE pid uuid := '...'; BEGIN INSERT INTO ... END $$`)
  // rather than a plain top-level INSERT/UPDATE/DELETE.
  /^\s*do\s*\$\$[\s\S]*?\b(insert\s+into|update\s+[a-z_.]+\s+set|delete\s+from)\b/i,
];

// Strip leading blank lines and `--` line comments so anchored (^) patterns
// above see the real first keyword of the statement, not a preceding comment.
function stripLeadingComments(stmt) {
  const lines = stmt.split("\n");
  let start = 0;
  while (start < lines.length) {
    const line = lines[start].trim();
    if (line === "" || line.startsWith("--")) { start += 1; continue; }
    break;
  }
  return lines.slice(start).join("\n");
}

function shouldDrop(stmt) {
  const bare = stripLeadingComments(stmt);
  return DROP_PATTERNS.some((re) => re.test(bare));
}

// The one FK that pointed at Supabase's internal auth.users — repoint it at
// our own public.users table (created before any migration runs, see preamble).
function rewrite(stmt) {
  return stmt.replace(/references\s+auth\.users\s*\(\s*id\s*\)/gi, "references public.users(id)");
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const PREAMBLE = `-- Auto-generated by backend/sql/build-schema.mjs — do not hand-edit.
-- Source: the ${files.length} historical Supabase migration files, with
-- Supabase-only constructs (RLS policies, storage.* schema, the auth.users
-- admin-bootstrap trigger, has_role()/handle_new_user_role()) stripped, and
-- authorization moved to backend middleware instead (see src/middleware/auth.ts).

create extension if not exists pgcrypto;

-- Replaces Supabase's internal auth.users table. Populated by the Google
-- OAuth callback (src/routes/auth.ts), not by these migrations.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Backend-managed session store, replaces Supabase Auth's session handling.
create table if not exists public.admin_sessions (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

`;

let combined = PREAMBLE;
let droppedCount = 0;
let keptCount = 0;
const droppedByFile = [];

for (const file of files) {
  const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  const statements = splitStatements(raw);
  const kept = [];
  let droppedHere = 0;
  for (const stmt of statements) {
    if (stmt.trim().length === 0) continue;
    if (shouldDrop(stmt)) {
      droppedHere += 1;
      droppedCount += 1;
      continue;
    }
    kept.push(rewrite(stmt));
    keptCount += 1;
  }
  if (droppedHere > 0) droppedByFile.push(`${file}: dropped ${droppedHere}`);
  if (kept.length > 0) {
    combined += `\n-- ==== ${file} ====\n` + kept.join("\n") + "\n";
  }
}

writeFileSync(OUT_FILE, combined, "utf8");

console.log(`Wrote ${OUT_FILE}`);
console.log(`Statements kept: ${keptCount}, dropped: ${droppedCount}`);
console.log("Per-file drops:\n" + droppedByFile.join("\n"));
