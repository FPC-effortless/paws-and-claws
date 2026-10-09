const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
let savedCart = null;
const nodes = new Map();
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, {
    innerHTML: '', textContent: '', value: '', max: '', hidden: true,
    style: {}, dataset: {}, listeners: {},
    addEventListener(event, callback) { this.listeners[event] = callback; },
    setAttribute() {}, appendChild() {}, closest() { return node('.filter-group'); },
  });
  return nodes.get(selector);
}
const products = [
  { id: 'one', name: 'Salmon food', desc: 'Dinner', cat: 'Food', species: ['Dog'], age: ['adult'], size: ['small'], price: 10, stock: 5 },
  { id: 'two', name: 'Cat toy', desc: 'Feather', cat: 'Toys', species: ['Cat'], age: ['adult'], size: ['small'], price: 20, stock: 5 },
];
const events = {};
const document = {
  readyState: 'loading',
  querySelector: node, querySelectorAll: () => [],
  createElement: () => node('toast'),
  addEventListener(event, callback) { (events[event] ||= []).push(callback); },
};
const context = { document, addEventListener: document.addEventListener, console, URLSearchParams, setTimeout() {},
  location: { search: '' }, localStorage: { getItem: () => savedCart, setItem() {} },
  PNC_DB: { PRODUCTS: products, PRODUCT_BY_ID: Object.fromEntries(products.map(p => [p.id, p])), catalogReady: () => true,
    db: { products }, currentOwner: () => null, money: n => '$' + n.toFixed(2),
    esc: s => String(s), titleCase: s => s, speciesIcon: () => '' },
};
context.window = context;
vm.createContext(context);
for (const file of ['app.js', 'shop.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
// Initialize only the shop controller; shared chrome is tested in the browser.
events.DOMContentLoaded.at(-1)();
assert.equal(node('#resultCount').textContent, '2 products');
node('#productSearch').listeners.input({ target: { value: 'SALMON' } });
assert.equal(node('#resultCount').textContent, '1 product');
node('#priceRange').listeners.input({ target: { value: '0', max: '20' } });
assert.equal(node('#resultCount').textContent, '0 products');
assert.equal(node('#priceReadout').textContent, 'Up to $0.00');
node('#clearFilters').listeners.click();
assert.equal(node('#resultCount').textContent, '2 products');
assert.equal(node('#productSearch').value, '');
assert.equal(node('#productGrid').listeners.click, undefined, 'shop must not duplicate the shared add handler');
const add = { dataset: { add: 'one' }, disabled: false };
const event = { target: { closest: selector => selector === '[data-add]' ? add : null } };
for (const handler of events.click) handler(event);
assert.equal(context.PNC.Cart.count, 1);
assert.equal(node('#cartDrawer').hidden, false);
assert.equal(node('#cartTotal').textContent, '\u20a610.00');
add.disabled = true;
for (const handler of events.click) handler(event);
assert.equal(context.PNC.Cart.count, 1);
context.PNC.Cart.clear();
assert.equal(node('#cartDrawer').hidden, true);
savedCart = JSON.stringify([{id:'removed-product',qty:2},{id:'one',qty:-4},{id:'one',qty:'2'},{id:'one',qty:2},{id:'one',qty:3}]);
context.PNC.Cart.rebind();
assert.equal(context.PNC.Cart.count,5,'invalid saved lines are removed and duplicates merged');
products[0].price=12;
context.PNC.Cart.render();
assert.equal(node('#cartTotal').textContent,'\u20a660.00','cart uses the latest catalog price');
savedCart = '{}';
context.PNC.Cart.rebind();
assert.equal(context.PNC.Cart.count,0,'a corrupted cart cannot break page initialization');
for (const page of ['index.html','shop.html','pets.html','account.html','membership.html','services.html','contact.html','admin/index.html']) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert(html.indexOf('js/data.js') < html.indexOf('js/app.js'), page + ' must load catalog before cart');
}
console.log('Storefront regressions passed: search, $0 filter, reset, single add, disabled add, totals, script order.');
