const test = require('node:test'), assert = require('node:assert');
const { applyDiscount, formatPrice } = require('../src/price');
test('formatPrice shows two decimals', () => assert.strictEqual(formatPrice(5), '$5.00'));
test('no discount keeps the price', () => assert.strictEqual(applyDiscount(100, 0), 100));
