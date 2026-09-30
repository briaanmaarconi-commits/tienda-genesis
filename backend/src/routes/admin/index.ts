import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/auth.js";

// Registered once with prefix /api/admin — every route added inside `register`
// callbacks passed to this plugin automatically requires an admin session,
// the same way every admin-only RLS policy did before. This is the one place
// that enforcement can be forgotten, so it's structural, not per-route.
export async function registerAdminRoutes(app: FastifyInstance, register: (app: FastifyInstance) => Promise<void>) {
  await app.register(
    async (admin) => {
      admin.addHook("preHandler", requireAdmin);
      await register(admin);
    },
    { prefix: "/api/admin" },
  );
}
