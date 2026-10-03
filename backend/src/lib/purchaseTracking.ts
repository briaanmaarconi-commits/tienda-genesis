import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, pool } from "../db/index.js";
import { env } from "../env.js";
import { eventAtPayment, purchaseSnapshot } from "./purchaseEvent.js";

type Executor = Pick<typeof db, "execute">;

// Additive, idempotent schema setup. Existing sales are never backfilled as
// purchases: only checkouts created after this feature have a snapshot.
export async function initializePurchaseTracking() {
  await pool.query(`CREATE TABLE IF NOT EXISTS purchase_tracking (
    sale_id uuid PRIMARY KEY REFERENCES sales(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    payload jsonb NOT NULL,
    delivered_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_error text
  )`);
}

export async function savePurchaseSnapshot(tx: Executor, saleId: string, payload: ReturnType<typeof purchaseSnapshot>) {
  if (!payload) return;
  await tx.execute(sql`INSERT INTO purchase_tracking (sale_id, payload) VALUES (${saleId}::uuid, ${JSON.stringify(payload)}::jsonb) ON CONFLICT (sale_id) DO NOTHING`);
}

export async function markPurchasePaid(tx: Executor, saleId: string) {
  // Runs in the SAME transaction as the payment status change. Subsequent
  // webhooks/status edits preserve the first payment time and delivery marker.
  await tx.execute(sql`UPDATE purchase_tracking SET paid_at = now(), next_attempt_at = now() WHERE sale_id = ${saleId}::uuid AND paid_at IS NULL`);
}

export function startPurchaseDelivery(app: FastifyInstance) {
  if (!env.META_CAPI_ENABLED) {
    app.log.info("Meta Purchase delivery disabled; confirmed payments are recorded locally");
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (let i = 0; i < 5; i++) {
        // Atomic lease supports multiple API instances and restart recovery.
        const result = await pool.query(`UPDATE purchase_tracking p SET
          next_attempt_at = now() + interval '2 minutes', attempts = attempts + 1
          WHERE sale_id = (SELECT t.sale_id FROM purchase_tracking t
            JOIN sales s ON s.id = t.sale_id
            WHERE t.paid_at IS NOT NULL AND t.delivered_at IS NULL
              AND t.paid_at > now() - interval '7 days'
              AND t.next_attempt_at <= now() AND s.status <> 'cancelada'
            ORDER BY t.paid_at FOR UPDATE OF t SKIP LOCKED LIMIT 1)
          RETURNING p.*`);
        const row = result.rows[0];
        if (!row) break;
        const event = eventAtPayment(row.payload, row.paid_at);
        if (!event) continue;
        let errorCode = "network_error";
        try {
          const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_PIXEL_ID}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.META_CAPI_ACCESS_TOKEN}` },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({ data: [event], ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}) }),
          });
          const body = await response.json() as { events_received?: number; error?: { code?: number } };
          if (response.ok && body.events_received === 1) {
            await pool.query("UPDATE purchase_tracking SET delivered_at = now(), last_error = NULL WHERE sale_id = $1", [row.sale_id]);
            continue;
          }
          // Only codes in logs/DB; never log access tokens or customer payloads.
          errorCode = `http_${response.status}_meta_${Number(body.error?.code) || 0}`;
        } catch { /* Retried with the same event ID and original timestamp. */ }
        const delay = Math.min(3600, 30 * 2 ** Math.min(row.attempts, 7));
        await pool.query("UPDATE purchase_tracking SET last_error = $2, next_attempt_at = now() + $3 * interval '1 second' WHERE sale_id = $1", [row.sale_id, errorCode, delay]);
        app.log.warn({ saleId: row.sale_id, code: errorCode }, "Meta Purchase delivery pending");
      }
    } catch {
      app.log.error("Meta Purchase worker failed; will retry");
    } finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, 30000);
  timer.unref();
  app.addHook("onClose", async () => { clearInterval(timer); });
  return tick;
}
