import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('payment transaction, repeated webhook, retries and persistent delivery marker', { skip: !process.env.PURCHASE_TEST_DATABASE_URL }, async () => {
  const connection = new URL(process.env.PURCHASE_TEST_DATABASE_URL);
  assert.equal(connection.pathname, '/genesis_test', 'Tests require a dedicated database');
  const { Pool } = await import('pg');
  const setup = new Pool({ connectionString: connection.href });
  const schema = 'purchase_test_' + randomUUID().replaceAll('-', '');
  await setup.query(`CREATE SCHEMA ${schema}`);
  connection.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: connection.href, GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test',
    GOOGLE_REDIRECT_URI: 'https://example.com/auth', SESSION_COOKIE_SECRET: 'x'.repeat(32),
    MERCADOPAGO_ACCESS_TOKEN: 'test', RESEND_API_KEY: 'test', FILE_SIGNING_SECRET: 'x'.repeat(32),
    STORAGE_DIR: '/tmp', PUBLIC_ORIGIN: 'https://example.com', FRONTEND_ORIGIN: 'https://example.com',
    META_CAPI_ENABLED: 'true', META_CAPI_ACCESS_TOKEN: 'not-a-real-token',
  });
  const { pool, db } = await import('../dist/db/index.js');
  const { initializePurchaseTracking, savePurchaseSnapshot, markPurchasePaid, startPurchaseDelivery } = await import('../dist/lib/purchaseTracking.js');
  const { purchaseSnapshot } = await import('../dist/lib/purchaseEvent.js');
  const { sql } = await import('drizzle-orm');
  const { default: Fastify } = await import('fastify');
  const app = Fastify();
  const originalFetch = globalThis.fetch;
  try {
    await pool.query('CREATE TABLE sales (id uuid PRIMARY KEY, status text NOT NULL)');
    await initializePurchaseTracking();
    await initializePurchaseTracking(); // repeated deploy is safe
    const id = randomUUID();
    await pool.query("INSERT INTO sales VALUES ($1, 'pendiente')", [id]);
    const payload = purchaseSnapshot({ saleId: id, customerId: randomUUID(), total: 1234, origin: 'https://example.com', contents: [] });
    await db.transaction(tx => savePurchaseSnapshot(tx, id, payload));
    const state = async () => (await pool.query('SELECT * FROM purchase_tracking WHERE sale_id = $1', [id])).rows[0];
    const sent = [];
    globalThis.fetch = async (_url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ events_received: 1 }) }; };
    const flush = startPurchaseDelivery(app);
    await flush();
    assert.equal(sent.length, 0, 'creating a checkout never sends Purchase');
    await assert.rejects(db.transaction(async tx => { await markPurchasePaid(tx, id); throw Error('rollback'); }));
    assert.equal((await state()).paid_at, null);
    await db.transaction(async tx => {
      await tx.execute(sql`UPDATE sales SET status = 'abonado' WHERE id = ${id}::uuid`);
      await markPurchasePaid(tx, id);
    });
    const paidAt = new Date((await state()).paid_at).toISOString();
    globalThis.fetch = async (_url, opts) => { sent.push(JSON.parse(opts.body)); throw Error('timeout after sending'); };
    await flush();
    assert.equal((await state()).delivered_at, null);
    assert.equal((await state()).last_error, 'network_error');
    await pool.query('UPDATE purchase_tracking SET next_attempt_at = now() WHERE sale_id = $1', [id]);
    await db.transaction(tx => markPurchasePaid(tx, id));
    assert.equal(new Date((await state()).paid_at).toISOString(), paidAt);
    globalThis.fetch = async (_url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ events_received: 1 }) }; };
    await flush();
    assert.deepEqual(sent[0].data, sent[1].data, 'retry uses identical event ID/time');
    assert.ok((await state()).delivered_at);
    await db.transaction(tx => markPurchasePaid(tx, id));
    await flush();
    assert.equal(sent.length, 2, 'delivered payment is not sent again');
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await pool.end();
    await setup.query(`DROP SCHEMA ${schema} CASCADE`);
    await setup.end();
  }
});
