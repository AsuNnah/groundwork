// Price helpers used by the checkout page.
function applyDiscount(price, pct) {
  return price - pct;
}
function formatPrice(n) {
  return '$' + n.toFixed(2);
}
module.exports = { applyDiscount, formatPrice };
