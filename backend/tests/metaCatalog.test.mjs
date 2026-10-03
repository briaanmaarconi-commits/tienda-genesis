import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMetaCatalog } from '../dist/lib/metaCatalog.js';

const origin = 'https://genesisqr.com';
const product = () => ({ id: 'p1', active: true, productType: 'standard', slug: 'pulseras', name: 'Pulseras & entradas', description: '<b>Diseño</b> personalizado',
  productImages: [{ url: '/files/photo.jpg?a=1&b=2', sortOrder: 0 }],
  productPacks: [{ id: 'pack1', label: 'Pack x100', units: 100, price: '10000', sortOrder: 0 }], productAddonGroups: [] });
const group = (overrides = {}) => ({ name: 'Tamaño', active: true, required: true, sortOrder: 0, perUnit: true, isMultiplier: false,
  productAddonOptions: [{ name: '10x15', active: true, sortOrder: 0, extraPrice: '500', priceMultiplier: '1' }], ...overrides });

test('one stable ID per pack, ARS, escaped XML and exact pack landing URL', () => {
  const p = product();
  p.productPacks.push({ ...p.productPacks[0], id: 'pack2', units: 200, price: '19000' });
  const f = buildMetaCatalog([p], origin);
  assert.equal(f.items.length, 2);
  assert.equal(f.items[0].price, '10000.00 ARS');
  assert.equal(new URL(f.items[0].link).searchParams.get('pack'), 'pack1');
  assert.equal(f.items[0].id, 'genesis-pack-pack1');
  assert.match(f.xml, /Pulseras &amp; entradas/);
  assert.match(f.xml, /a=1&amp;b=2/);
  assert.doesNotMatch(f.xml, /<b>/);
  p.productPacks[0].price = '11000';
  assert.equal(buildMetaCatalog([p], origin).items[0].id, f.items[0].id);
  assert.equal(buildMetaCatalog([p], origin).items[0].price, '11000.00 ARS');
});

test('matches required per-unit, fixed and multiplier defaults; excludes optional extras', () => {
  const p = product();
  p.productPacks[0].price = '0';
  p.productAddonGroups = [group(), group({ perUnit: false }), group({ isMultiplier: true, productAddonOptions: [{ name: 'x2', active: true, sortOrder: 0, extraPrice: '99999', priceMultiplier: '2' }] }), group({ required: false })];
  assert.equal(buildMetaCatalog([p], origin).items[0].price, '101000.00 ARS');
});

test('uses first active option in storefront sort order, not cheapest option', () => {
  const p = product();
  p.productAddonGroups = [group({ productAddonOptions: [
    { name: 'Disabled', active: false, sortOrder: -1, extraPrice: '1', priceMultiplier: '1' },
    { name: 'Later', active: true, sortOrder: 2, extraPrice: '2', priceMultiplier: '1' },
    { name: 'Default', active: true, sortOrder: 0, extraPrice: '500', priceMultiplier: '1' },
  ] })];
  assert.equal(buildMetaCatalog([p], origin).items[0].price, '60000.00 ARS');
});

test('excludes inactive products and custom quotes', () => {
  const f = buildMetaCatalog([product(), { ...product(), active: false }, { ...product(), productType: 'custom_sticker' }], origin);
  assert.equal(f.items.length, 1);
  assert.equal(f.excluded.length, 1);
});

test('refuses empty, invalid or incomplete feeds instead of removing existing catalog items', () => {
  assert.throws(() => buildMetaCatalog([], origin));
  for (const mutate of [
    p => { p.productImages = []; },
    p => { p.productImages[0].url = 'javascript:alert(1)'; },
    p => { p.productPacks[0].price = 'NaN'; },
    p => { p.productPacks[0].price = '0'; },
    p => { p.productAddonGroups = [group({ productAddonOptions: [] })]; },
  ]) { const p = product(); mutate(p); assert.throws(() => buildMetaCatalog([p], origin)); }
  assert.throws(() => buildMetaCatalog([product(), product()], origin), /Duplicate/);
});
