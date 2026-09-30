import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { Google, generateState, generateCodeVerifier } from "arctic";
import { eq, sql } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { users, userRoles, adminSessions } from "../db/schema.js";
import { SESSION_COOKIE } from "../middleware/auth.js";

const google = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);

const STATE_COOKIE = "genesis_oauth_state";
const VERIFIER_COOKIE = "genesis_oauth_verifier";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/google/login", async (req, reply) => {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = await google.createAuthorizationURL(state, codeVerifier, { scopes: ["profile", "email"] });

    const cookieOpts = {
      path: "/",
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: "lax" as const,
      maxAge: 60 * 10,
    };
    reply.setCookie(STATE_COOKIE, state, cookieOpts);
    reply.setCookie(VERIFIER_COOKIE, codeVerifier, cookieOpts);
    reply.redirect(url.toString());
  });

  app.get("/api/auth/google/callback", async (req, reply) => {
    const query = req.query as { code?: string; state?: string };
    const storedState = req.cookies[STATE_COOKIE];
    const codeVerifier = req.cookies[VERIFIER_COOKIE];

    if (!query.code || !query.state || !storedState || !codeVerifier || query.state !== storedState) {
      reply.code(400).send({ error: "invalid_oauth_state" });
      return;
    }

    const tokens = await google.validateAuthorizationCode(query.code, codeVerifier);

    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!userInfoRes.ok) {
      reply.code(502).send({ error: "google_userinfo_failed" });
      return;
    }
    const googleUser = (await userInfoRes.json()) as GoogleUserInfo;

    const [existing] = await db.select().from(users).where(eq(users.googleSub, googleUser.sub)).limit(1);

    let userId: string;
    if (existing) {
      userId = existing.id;
      await db
        .update(users)
        .set({ email: googleUser.email, name: googleUser.name ?? existing.name, avatarUrl: googleUser.picture ?? existing.avatarUrl })
        .where(eq(users.id, userId));
    } else {
      const [created] = await db
        .insert(users)
        .values({
          googleSub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.picture,
        })
        .returning({ id: users.id });
      userId = created.id;

      // Replaces handle_new_user_role(): first account ever to log in becomes
      // admin, every subsequent Google account gets the powerless 'user' role.
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(userRoles);
      const isFirstUser = count === 0;
      await db.insert(userRoles).values({ userId, role: isFirstUser ? "admin" : "user" });
    }

    const sessionId = randomBytes(32).toString("hex");
    await db.insert(adminSessions).values({
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });

    reply.clearCookie(STATE_COOKIE, { path: "/" });
    reply.clearCookie(VERIFIER_COOKIE, { path: "/" });
    reply.setCookie(SESSION_COOKIE, sessionId, {
      path: "/",
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS / 1000,
    });
    reply.redirect(`${env.FRONTEND_ORIGIN}/admin`);
  });

  app.get("/api/auth/me", async (req, reply) => {
    if (!req.user) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    reply.send({ user: req.user });
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const sessionId = req.cookies[SESSION_COOKIE];
    if (sessionId) {
      await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    reply.send({ ok: true });
  });
}
