const test = require('node:test'), assert = require('node:assert');
const { buildInvoice } = require('../src/invoice');

test('US order over the free-shipping line', () => {
  const inv = buildInvoice({ country: 'US', items: [{ sku: 'A1', name: 'Lamp', qty: 2, unitPrice: 40, category: 'home' }] });
  assert.strictEqual(inv.total, 85.6);
  assert.strictEqual(inv.text, '2 x Lamp ... $80.00\nSubtotal: $80.00\nShipping: free\nTax: $5.60\nTotal: $85.60');
});

test('member book in Germany: book discount, books untaxed, shipping taxed', () => {
  const inv = buildInvoice({ country: 'DE', member: true, items: [{ sku: 'B1', name: 'Novel', qty: 1, unitPrice: 20, category: 'book' }] });
  assert.strictEqual(inv.total, 49);
  assert.strictEqual(inv.text, '1 x Novel ... 19,00 EUR\nSubtotal: 19,00 EUR\nShipping: 25,00 EUR\nTax: 5,00 EUR\nTotal: 49,00 EUR');
});

test('SAVE10 coupon in Canada', () => {
  const inv = buildInvoice({ country: 'CA', coupon: 'SAVE10', items: [{ sku: 'C1', name: 'Puzzle', qty: 3, unitPrice: 19.95, category: 'toy' }] });
  assert.strictEqual(inv.discount, 5.99);
  assert.strictEqual(inv.total, 74.42);
});
