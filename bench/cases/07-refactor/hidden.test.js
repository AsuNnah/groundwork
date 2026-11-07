// Hidden checks for the refactor: the refactored module must match the original on every order.
// reference/invoice.js is the untouched original; the agent never sees it.
const test = require('node:test'), assert = require('node:assert'), path = require('node:path');
const { buildInvoice: after } = require(path.join(process.env.FIXTURE, 'src/invoice'));
const { buildInvoice: before } = require('./reference/invoice');

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(rnd() * a.length)];
const CATS = ['book', 'home', 'toy', 'food'], COUNTRIES = ['US', 'CA', 'DE', 'FR'], COUPONS = [undefined, '', 'SAVE10', 'FLAT5', 'VIP', 'VIPGOLD', 'vip', 'SAVE20'];
function order(n) {
  const items = Array.from({ length: n }, (_, i) => ({ sku: 'S' + i, name: 'Item ' + i, qty: pick([0, 1, 1, 2, 3, 9, 10, 12]), unitPrice: pick([0.99, 4.5, 9.99, 12, 19.95, 33.33, 49]), category: pick(CATS) }));
  return { items, country: pick(COUNTRIES), coupon: pick(COUPONS), member: pick([true, false, undefined]) };
}
const same = o => assert.deepStrictEqual(after(JSON.parse(JSON.stringify(o))), before(JSON.parse(JSON.stringify(o))), JSON.stringify(o));

test('300 generated orders give the same invoice', () => { for (let k = 0; k < 300; k++) same(order(1 + (k % 6))); });
test('edge cases: empty order, zero and negative quantities, thresholds', () => {
  same({ items: [], country: 'US' });
  same({ items: [{ sku: 'A', name: 'Gift card', qty: 0, unitPrice: 50, category: 'home' }], country: 'DE', coupon: 'FLAT5' });
  same({ items: [{ sku: 'A', name: 'Returned', qty: -1, unitPrice: 50, category: 'home' }], country: 'CA' });
  for (const p of [19.99, 20, 49.99, 50, 74.99, 75, 99.99, 100, 149.99, 150]) for (const c of COUNTRIES) for (const coupon of ['SAVE10', 'FLAT5', 'VIPX'])
    same({ items: [{ sku: 'P', name: 'Thing', qty: 1, unitPrice: p, category: 'home' }], country: c, coupon, member: true });
});
test('legacy quirk: a repeated SKU uses its first category for tax', () => {
  same({ items: [{ sku: 'D', name: 'Dup book', qty: 1, unitPrice: 30, category: 'book' }, { sku: 'D', name: 'Dup toy', qty: 2, unitPrice: 15, category: 'toy' }], country: 'DE', member: true });
  same({ items: [{ sku: 'D', name: 'Dup toy', qty: 2, unitPrice: 15, category: 'toy' }, { sku: 'D', name: 'Dup book', qty: 1, unitPrice: 30, category: 'book' }], country: 'CA', coupon: 'SAVE10' });
});
