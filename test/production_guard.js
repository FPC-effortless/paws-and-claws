/* Production-safety guardrail test.
   Loads the browser data layer under a hosted origin and proves that local
   demo authentication/state mutations cannot become the production backend. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const sandbox = {
  localStorage: {
    getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  location: { hostname: "paws.example.com" },
  console,
  Math, Date, JSON, Array, Object, String, Number, Error, Set, URLSearchParams, CustomEvent,
  dispatchEvent() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "assets", "js", "data.js"), "utf8"), sandbox);

const D = sandbox.PNC_DB;
let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error("FAIL: " + msg); }
  else console.log("  ok  " + msg);
}

console.log("\n== production safety guard ==");
assert(D.productionMode() === true, "hosted origin is production mode");
D.load();
assert(D.db.owners.length === 0, "production cache contains no demo owners");
assert(D.db.admins.length === 0, "production cache contains no demo admins");
assert(D.currentOwner() === null, "no local member session in production");
assert(D.currentAdmin() === null, "no local admin session in production");
assert(!!D.signUp({fullName:"Test",email:"test@example.com",password:"password123"}).error, "local signup is disabled");
assert(!!D.logIn("elena@example.com","member123").error, "local member login is disabled");
assert(!!D.adminLogin("owner@pawsandclaws.example","admin123").error, "local admin login is disabled");
assert(!!D.placeOrder([{id:"p1",qty:1}],"delivery").error, "checkout cannot run without an authenticated backend");
assert(!!D.createBooking({serviceId:"sv-wellness",petId:"pt-1",date:"2099-01-01",hour:9,providerId:"Dana"}).error, "booking cannot run without authenticated backend");
assert(!!D.setBookingStatus("bk-1001","completed").error, "admin status changes require authenticated authorization");
assert(!!D.updateOwner("ow-1",{plan:"senior"}).error, "owner mutation cannot run without authenticated authorization");
assert(!!D.updateProduct("p1",{price:0.01,stock:999}).error, "inventory mutation cannot run without authenticated authorization");

console.log("\n== done ==");
if (failures) { process.exitCode = 1; console.error(failures + " failure(s)"); }
else console.log("ALL PRODUCTION GUARDS PASSED");
