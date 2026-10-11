const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const events = {};
const groupGrid = { innerHTML: '' };
const servicesSection = { hidden: false };
const elements = { '#groupGrid': groupGrid, '#services': servicesSection };
const D = {
  db: { cms: null, listings: [] },
  SERVICES: [{ id: 'seed-service', name: 'Seed service', desc: 'Old browser seed', price: 1, duration: 1, icon: '🐾', active: true }],
  load() {}, reset() {}, catalogReady() { return false; }, money(n) { return '₦' + n; }, esc(value) { return String(value); }, icon(value) { return value || ''; }
};
const sandbox = {
  console, encodeURIComponent,
  PNC_DB: D,
  PNC: { money: D.money, esc: D.esc, isValidEmail() { return true; } },
  matchMedia() { return { matches: true }; },
  addEventListener(type, fn) { (events[type] ||= []).push(fn); },
  dispatchEvent(event) { for (const fn of events[event.type] || []) fn(event); },
  document: {
    readyState: 'complete',
    querySelector(selector) { return elements[selector] || null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets/js/home.js'), 'utf8'), sandbox);

assert(groupGrid.innerHTML.includes('Seed service'), 'initial render uses the currently loaded service snapshot');
assert(!groupGrid.innerHTML.includes('Quality Supplies'), 'homepage does not inject a hard-coded pseudo-service');
D.SERVICES = [{ id: 'admin-added', name: 'Paw Spa Deluxe', desc: 'Added by an administrator', price: 25000, duration: 1.5, icon: '🛁', active: true }];
sandbox.dispatchEvent({ type: 'pnc:data-ready' });
assert(groupGrid.innerHTML.includes('Paw Spa Deluxe'), 'backend updates replace the homepage service cards');
assert(groupGrid.innerHTML.includes('data-service-id="admin-added"'), 'homepage cards retain the backend service ID');
assert(groupGrid.innerHTML.includes('₦25000'), 'homepage shows admin-set service prices before checkout is enabled');
assert(!groupGrid.innerHTML.includes('Seed service'), 'stale seed services disappear after backend synchronization');
console.log('Homepage backend-service synchronization passed.');
