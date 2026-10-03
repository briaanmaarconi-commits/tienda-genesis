import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseSnapshot, verifiedMpPurchase, eventAtPayment, hash, browserId } from '../dist/lib/purchaseEvent.js';

const input = { saleId: 'sale-1', customerId: 'customer-1', email: ' TEST@example.com ', total: 1234.56,
  origin: 'https://genesisqr.com', userAgent: 'test-browser', fbp: 'fb.1.1700000000000.1234', contents: [{ id: 'genesis-pack-pack-1', quantity: 2 }] };

test('server snapshot contains exact paid amount and catalog pack IDs, no raw personal data', () => {
  const p = purchaseSnapshot(input);
  assert.equal(p.event_id, 'purchase_sale-1');
  assert.deepEqual(p.custom_data, { currency: 'ARS', value: 1234.56, content_type: 'product', contents: input.contents, content_ids: ['genesis-pack-pack-1'] });
  assert.deepEqual(p.user_data.em, [hash('test@example.com')]);
  assert.equal(p.event_source_url, 'https://genesisqr.com/');
  assert.doesNotMatch(JSON.stringify(p), /test@example|customer-1|carrito-compartido/);
  assert.equal(p.event_time, undefined); // checkout is NOT a purchase yet
});

test('invalid totals and cookie identifiers cannot create a misleading event', () => {
  for (const total of [0, -1, NaN, Infinity]) assert.equal(purchaseSnapshot({ ...input, total }), null);
  assert.equal(browserId('someone@example.com'), undefined);
  assert.equal(purchaseSnapshot({ ...input, fbp: 'private', email: 'invalid' }).user_data.em, undefined);
});

test('only live approved ARS payments for the exact order total qualify', () => {
  const payment = { status: 'approved', live_mode: true, currency_id: 'ARS', transaction_amount: 1234.56 };
  assert.equal(verifiedMpPurchase(payment, 1234.56), true);
  for (const patch of [{ status: 'pending' }, { status: 'rejected' }, { live_mode: false }, { currency_id: 'USD' }, { transaction_amount: 1234.55 }, { transaction_amount: NaN }]) {
    assert.equal(verifiedMpPurchase({ ...payment, ...patch }, 1234.56), false);
  }
});

test('retries preserve event ID and original payment time, never invent a fresh purchase date', () => {
  const time = Date.parse('2026-10-03T18:00:00Z');
  const snapshot = purchaseSnapshot(input);
  const first = eventAtPayment(snapshot, new Date(time), time);
  assert.deepEqual(eventAtPayment(snapshot, new Date(time), time + 60000), first);
  assert.equal(first.event_time, time / 1000);
  assert.equal(eventAtPayment(snapshot, new Date(time), time + 7 * 86400000), null);
  assert.equal(eventAtPayment(snapshot, new Date(time), time - 1), null);
});
