const test = require('node:test'), assert = require('node:assert'), path = require('path');
const { applyDiscount, formatPrice } = require(path.join(process.env.FIXTURE, 'src/price'));
test('10% of 200', () => assert.strictEqual(applyDiscount(200, 10), 180));
test('0%', () => assert.strictEqual(applyDiscount(50, 0), 50));
test('100%', () => assert.strictEqual(applyDiscount(80, 100), 0));
test('15% of 19.99 is about 16.99', () => assert.ok(Math.abs(applyDiscount(19.99, 15) - 16.9915) < 0.006));
test('formatPrice unchanged', () => assert.strictEqual(formatPrice(16.5), '$16.50'));
