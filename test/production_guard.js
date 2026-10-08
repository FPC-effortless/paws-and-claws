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
assert(!!D.signUp({fullName:"Synthetic User",email:"synthetic@example.invalid",password:"not-a-real-secret"}).error, "local signup is disabled");
assert(!!D.logIn("synthetic@example.invalid","not-a-real-secret").error, "local member login is disabled");
assert(!!D.adminLogin("synthetic-admin@example.invalid","not-a-real-secret").error, "local admin login is disabled");
assert(!!D.placeOrder([{id:"p1",qty:1}],"delivery").error, "checkout cannot run without an authenticated backend");
assert(!!D.createBooking({serviceId:"sv-wellness",petId:"pt-1",date:"2099-01-01",hour:9,providerId:"Dana"}).error, "booking cannot run without authenticated backend");
assert(!!D.setBookingStatus("synthetic-booking","completed").error, "admin status changes require authenticated authorization");
assert(!!D.updateOwner("synthetic-owner",{plan:"senior"}).error, "owner mutation cannot run without authenticated authorization");
assert(!!D.updateProduct("p1",{price:0.01,stock:999}).error, "inventory mutation cannot run without authenticated authorization");

// A valid Clerk identity and cached records must not enable local mutations
// when the authoritative Convex backend is disconnected.
sandbox.PNC_CLERK = {
  active: true,
  currentOwner() { return { clerkId: "user-test", email: "owner@example.test" }; },
  currentAdmin() { return null; }
};
D.applyRemoteSnapshot({
  ...D.seed(),
  owners: [{
    id: "ow-local", clerkId: "user-test", email: "owner@example.test",
    fullName: "Test Owner", plan: "puppy", createdAt: "2026-01-01"
  }],
  pets: [{
    id: "pet-local", ownerId: "ow-local", petName: "Test Pet",
    species: "Dog", vaccines: [], createdAt: "2026-01-01"
  }],
  admins: []
});
assert(D.currentOwner() !== null, "cached signed-in member is present for disconnect test");
const before = D.db.bookings.length;
const blocked = D.createBooking({
  serviceId: "sv-nails", petId: "pet-local", date: "2099-01-01", hour: 9, providerId: "Rosa"
});
assert(!!blocked.error && D.db.bookings.length === before,
  "signed-in hosted members cannot create local-only bookings");
assert(!!D.updateOwner("ow-local", { fullName: "Not persisted" }).error,
  "signed-in hosted members cannot modify cached profiles offline");
D.clearRemoteSnapshot();
assert(D.currentOwner() === null && D.db.owners.length === 0,
  "session change clears the authenticated snapshot");

console.log("\n== done ==");
if (failures) { process.exitCode = 1; console.error(failures + " failure(s)"); }
else console.log("ALL PRODUCTION GUARDS PASSED");
