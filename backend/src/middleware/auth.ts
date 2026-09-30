import type { FastifyRequest, FastifyReply } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminSessions, users, userRoles } from "../db/schema.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

const SESSION_COOKIE = "genesis_session";

async function loadSessionUser(sessionId: string | undefined): Promise<SessionUser | null> {
  if (!sessionId) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      expiresAt: adminSessions.expiresAt,
    })
    .from(adminSessions)
    .innerJoin(users, eq(adminSessions.userId, users.id))
    .where(eq(adminSessions.id, sessionId))
    .limit(1);

  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;

  // Mirrors has_role(auth.uid(), 'admin') from the old RLS policies — only a
  // row in user_roles with role='admin' counts, not merely having a session
  // (the trigger this replaces assigns 'user' to every Google account after
  // the first one to ever log in).
  const [roleRow] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, row.id), eq(userRoles.role, "admin")))
    .limit(1);

  return { id: row.id, email: row.email, name: row.name, isAdmin: !!roleRow };
}

// Every request gets req.user populated if a valid session cookie is present.
// Individual routes decide whether req.user / req.user.isAdmin is required.
export async function attachUser(req: FastifyRequest, _reply: FastifyReply) {
  const sessionId = req.cookies[SESSION_COOKIE];
  req.user = await loadSessionUser(sessionId);
}

// Replaces policies of the shape `USING (has_role(auth.uid(), 'admin') OR active = true)`
// — read routes call this to decide whether to add `active = true` to their WHERE clause.
export function isAdmin(req: FastifyRequest): boolean {
  return req.user?.isAdmin === true;
}

// Replaces policies of the shape `USING (has_role(auth.uid(), 'admin'))` for
// writes and admin-only reads. Register on every /admin/* route.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user?.isAdmin) {
    reply.code(401).send({ error: "unauthorized" });
  }
}

export { SESSION_COOKIE };
