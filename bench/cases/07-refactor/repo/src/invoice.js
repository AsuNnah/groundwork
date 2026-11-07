// Builds the invoice for an order. Used by the checkout and the monthly statements.
// order: { items: [{ sku, name, qty, unitPrice, category }], country, coupon, member }
function buildInvoice(order) {
  var lines = [];
  var subtotal = 0;
  var i, it, lineTotal;
  for (i = 0; i < order.items.length; i++) {
    it = order.items[i];
    if (it.qty > 0) {
      lineTotal = Math.round(it.qty * it.unitPrice * 100) / 100;
      if (it.category == 'book') {
        if (order.member) {
          lineTotal = Math.round(lineTotal * 0.95 * 100) / 100;
        }
      } else {
        if (order.member) {
          if (it.qty >= 10) {
            lineTotal = Math.round(lineTotal * 0.9 * 100) / 100;
          } else {
            lineTotal = Math.round(lineTotal * 0.97 * 100) / 100;
          }
        } else {
          if (it.qty >= 10) {
            lineTotal = Math.round(lineTotal * 0.95 * 100) / 100;
          }
        }
      }
      lines.push({ sku: it.sku, name: it.name, qty: it.qty, total: lineTotal });
      subtotal = subtotal + lineTotal;
    }
  }
  subtotal = Math.round(subtotal * 100) / 100;
  var discount = 0;
  if (order.coupon) {
    if (order.coupon == 'SAVE10') {
      if (subtotal >= 50) {
        discount = Math.round(subtotal * 0.1 * 100) / 100;
      }
    } else if (order.coupon == 'FLAT5') {
      if (subtotal >= 20) {
        discount = 5;
      } else {
        discount = 0;
      }
    } else if (order.coupon.indexOf('VIP') == 0) {
      if (order.member) {
        discount = Math.round(subtotal * 0.15 * 100) / 100;
      }
    }
  }
  var afterDiscount = Math.round((subtotal - discount) * 100) / 100;
  var shipping;
  if (order.country == 'US') {
    if (afterDiscount >= 75) { shipping = 0; } else { shipping = 7.5; }
  } else if (order.country == 'CA') {
    if (afterDiscount >= 100) { shipping = 0; } else { shipping = 12; }
  } else {
    if (afterDiscount >= 150) { shipping = 0; } else { shipping = 25; }
  }
  if (lines.length == 0) { shipping = 0; }
  var taxRate;
  if (order.country == 'US') { taxRate = 0.07; } else if (order.country == 'CA') { taxRate = 0.13; } else { taxRate = 0.2; }
  var bookPart = 0;
  for (i = 0; i < lines.length; i++) {
    if (findCategory(order, lines[i].sku) == 'book') bookPart = bookPart + lines[i].total;
  }
  var taxable = afterDiscount - (subtotal > 0 ? bookPart * (afterDiscount / subtotal) : 0);
  var tax = Math.round((taxable * taxRate + (order.country == 'US' ? 0 : shipping * taxRate)) * 100) / 100;
  var total = Math.round((afterDiscount + shipping + tax) * 100) / 100;
  var text = '';
  for (i = 0; i < lines.length; i++) {
    text = text + lines[i].qty + ' x ' + lines[i].name + ' ... ' + money(lines[i].total, order.country) + '\n';
  }
  text = text + 'Subtotal: ' + money(subtotal, order.country) + '\n';
  if (discount > 0) text = text + 'Discount (' + order.coupon + '): -' + money(discount, order.country) + '\n';
  text = text + 'Shipping: ' + (shipping == 0 ? 'free' : money(shipping, order.country)) + '\n';
  text = text + 'Tax: ' + money(tax, order.country) + '\n';
  text = text + 'Total: ' + money(total, order.country);
  return { lines: lines, subtotal: subtotal, discount: discount, shipping: shipping, tax: tax, total: total, text: text };
}

function findCategory(order, sku) {
  for (var j = 0; j < order.items.length; j++) {
    if (order.items[j].sku == sku) return order.items[j].category;
  }
  return null;
}

function money(n, country) {
  var s = n.toFixed(2);
  if (country == 'US') return '$' + s;
  if (country == 'CA') return 'CA$' + s;
  return s.replace('.', ',') + ' EUR';
}

module.exports = { buildInvoice };
