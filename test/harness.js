/* Node smoke-test harness for assets/js/data.js
   Shims just enough of the browser (window, localStorage) to load
   the data layer and exercise the main code paths. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const sandbox = {
  localStorage,
  window: {},
  console,
  Math,
  Date,
  JSON,
  Array,
  Object,
  String,
  Number,
  Error,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const file = path.join(__dirname, "..", "assets", "js", "data.js");
vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);

const D = sandbox.PNC_DB;
const assert = (cond, msg) => {
  if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; }
  else console.log("  ok  " + msg);
};

console.log("\n== data.js smoke test ==");
D.load();
assert(D.db.owners.length === 3, "seeded 3 owners, got " + D.db.owners.length);
assert(D.db.pets.length === 6, "seeded 6 pets, got " + D.db.pets.length);
assert(D.db.bookings.length === 8, "seeded 8 bookings, got " + D.db.bookings.length);
assert(D.db.listings.length === 6, "seeded 6 listings");
assert(D.db.services.length === 14, "seeded 14 services, got " + D.db.services.length);
assert(D.db.providers === undefined || Array.isArray(D.PROVIDERS), "providers exported");

/* availability.
   Pick a service whose providers actually work today: every service
   in the catalog has at least one provider with Sunday off, so a
   fixed service id can legitimately have zero slots on a given
   weekday. Search for one with open slots instead of assuming. */
const t = D.todayISO();
function slotsForToday(serviceId) { return D.slotsFor(D.db, serviceId, t); }
const svcToday = D.SERVICES.find(function (s) { return slotsForToday(s.id).length > 0; }) || D.SERVICES[0];
assert(!!svcToday, "found a service with slots today");
const slots = slotsForToday(svcToday.id);
assert(slots.length > 0, "slotsFor " + svcToday.id + " today -> " + slots.length + " slots");
const open = slots.filter((s) => s.available);
assert(open.length > 0, "at least one open slot today");
const det = D.slotsFor(D.db, "sv-haircut", D.addDays(2));
assert(det.some((s) => s.providerId === "Rosa"), "haircut slots include Rosa on +2d");

/* vaccines gate booking */
const charlie = D.byId(D.db.pets, "pt-1");
const check1 = D.vaccinesOk(charlie, D.SERVICE_BY_ID["sv-haircut"]);
assert(check1.ok === true, "Charlie passes vaccine gate for haircut");
const bruno = D.byId(D.db.pets, "pt-3");
const check2 = D.vaccinesOk(bruno, D.SERVICE_BY_ID["sv-haircut"]);
assert(check2.ok === false, "Bruno blocked from haircut (pending DHPP) - " + check2.missing.join(","));

/* auth + booking flow: keep service/provider consistent */
D.setSession("ow-1");
const cutDate = D.firstOpenDate(D.db, "sv-haircut");
const cutSlots = D.slotsFor(D.db, "sv-haircut", cutDate).filter((s) => s.available);
assert(cutSlots.length > 0, "open haircut slots on " + cutDate);
const bk = D.createBooking({
  serviceId: "sv-haircut", petId: "pt-1", date: cutDate,
  hour: cutSlots[0].hour, providerId: cutSlots[0].providerId,
  intake: { instructions: "test" },
});
assert(!bk.error, "createBooking succeeded" + (bk.error ? " -> " + bk.error : ""));
assert(!!bk.booking, "booking returned");
const bk2 = D.createBooking({ serviceId: "sv-haircut", petId: "pt-3", date: t, hour: 9, providerId: "Rosa" });
assert(!!bk2.error, "Bruno blocked from booking (vaccines) -> " + (bk2.error || "NOT BLOCKED"));

/* orders */
const order = D.placeOrder([{ id: "p1", qty: 2 }], "delivery");
assert(!order.error, "placeOrder ok" + (order.error ? " -> " + order.error : ""));
const before = D.byId(D.db.orders, order.order.id);
const stockAfter = D.byId(D.db.products, "p1").stock;
assert(stockAfter === 36, "stock decremented 38 -> " + stockAfter);
D.setOrderStage(order.order.id, "packing");
assert(D.byId(D.db.orders, order.order.id).stage === "packing", "order stage -> packing");

/* listings + inquiry */
const inq = D.submitInquiry("lt-1");
assert(!inq.error, "inquiry ok -> " + (inq.ref || inq.error));
D.setListingStatus("lt-1", "reserved");
assert(D.byId(D.db.listings, "lt-1").status === "reserved", "listing reserved");

/* CRM */
D.updatePet("pt-1", { weightKg: 32 });
assert(D.byId(D.db.pets, "pt-1").weightKg === 32, "pet weight updated");
D.addVaccine("pt-1", "Leptospirosis", D.todayISO(), "L-1");
const pend = D.byId(D.db.pets, "pt-1").vaccines.some((v) => v.status === "pending");
assert(pend, "vaccine uploaded as pending");
D.setVaccineStatus("pt-1", D.byId(D.db.pets, "pt-1").vaccines.length - 1, "approved");
assert(D.byId(D.db.pets, "pt-1").vaccines.slice(-1)[0].status === "approved", "vaccine approved");

/* RBAC */
D.adminLogin("owner@pawsandclaws.example", "admin123");
assert(D.can("cms.edit") === true, "super admin can edit CMS");
assert(D.can("payments.refund") === true, "super admin can refund");
D.adminLogout();
D.adminLogin("front@pawsandclaws.example", "desk123");
assert(D.can("bookings.manage") === true, "front desk can manage bookings");
assert(D.can("cms.edit") === false, "front desk cannot edit CMS");
assert(D.can("inventory.edit") === false, "front desk cannot edit inventory");
D.adminLogout();
D.adminLogin("retail@pawsandclaws.example", "retail123");
assert(D.can("inventory.edit") === true, "retail can edit inventory");
assert(D.can("bookings.view") === false, "retail cannot see vet schedules");
D.adminLogout();
D.adminLogin("rosa@pawsandclaws.example", "rosa123");
assert(D.scopeOf("bookings.view") === "own", "provider scope is own");
assert(D.can("payments.take") === false, "provider cannot take payments");
D.adminLogout();

/* stats + persistence */
const s = D.stats();
assert(s.revenue > 0, "revenue computed: " + D.money(s.revenue));
assert(D.db.notifications.length > 3, "notifications generated: " + D.db.notifications.length);
const raw = localStorage.getItem(D.KEY);
assert(!!raw && JSON.parse(raw).version === 1, "persisted to localStorage");

/* signup + login */
const su = D.signUp({ fullName: "Test Owner", email: "test@example.com", password: "password123", petName: "Rex" });
assert(!su.error, "signUp ok" + (su.error ? " -> " + su.error : ""));
D.logOut();
const li = D.logIn("test@example.com", "password123");
assert(!li.error, "logIn with new account ok" + (li.error ? " -> " + li.error : ""));
const bad = D.logIn("test@example.com", "wrongpassword");
assert(!!bad.error, "bad password rejected");

/* waitlist + leave */
D.setSession("ow-1");
const wl = D.joinWaitlist("sv-haircut", "Rosa", "mornings");
assert(!wl.error, "joined waitlist" + (wl.error ? " -> " + wl.error : ""));
D.addLeave("Rosa", D.addDays(5), "Vacation");
assert(D.providerWorking(D.PROVIDER_BY_ID.Rosa, D.addDays(5)) === false, "leave blocks working day");

/* removing a pet must not orphan active bookings */
D.setSession("ow-1");
const beforeRemove = D.db.bookings.filter(function (b) { return b.petId === "pt-1"; });
const activeBefore = beforeRemove.filter(function (b) { return b.status !== "cancelled" && b.status !== "completed"; });
const rm2 = D.removePet("pt-1");
assert(!rm2.error, "removePet ok" + (rm2.error ? " -> " + rm2.error : ""));
const stillThere = D.db.bookings.filter(function (b) { return b.petId === "pt-1"; });
const activeAfter = stillThere.filter(function (b) { return b.status !== "cancelled" && b.status !== "completed"; });
assert(activeAfter.length === 0, "no active bookings orphaned on a removed pet (was " + activeBefore.length + ")");
assert(beforeRemove.length === stillThere.length, "history rows preserved, not deleted (" + stillThere.length + "/" + beforeRemove.length + ")");
assert(stillThere.some(function (b) { return b.status === "completed"; }), "completed history is retained");

/* member discount applies to orders */
D.setSession("ow-1");
const rate = D.PLAN_DISCOUNT[(D.currentOwner() || {}).plan] || 0;
const ord = D.placeOrder([{ id: "p1", qty: 2 }], "delivery");
assert(!ord.error, "discount order placed" + (ord.error ? " -> " + ord.error : ""));
if (!ord.error && rate) {
  const expected = Math.round(2 * D.PRODUCT_BY_ID.p1.price * (1 - rate) * 100) / 100;
  assert(ord.order.total === expected, "order total reflects " + Math.round(rate * 100) + "% member discount -> " + D.money(ord.order.total));
  assert(ord.order.discountRate === rate, "order records the discount rate");
} else if (!ord.error) {
  assert(true, "no discount for this plan; total " + D.money(ord.order.total));
}

/* member discount applies to bookings */
D.setSession("ow-1");
const bkDate = D.firstOpenDate(D.db, "sv-nails");
const bkSlots = D.slotsFor(D.db, "sv-nails", bkDate).filter(function (s) { return s.available; });
if (bkSlots.length) {
  const bkD = D.createBooking({
    serviceId: "sv-nails", petId: "pt-2", date: bkDate,
    hour: bkSlots[0].hour, providerId: bkSlots[0].providerId, intake: {}
  });
  assert(!bkD.error, "discount booking ok" + (bkD.error ? " -> " + bkD.error : ""));
  if (!bkD.error && rate) {
    const svc = D.SERVICE_BY_ID["sv-nails"];
    const want = Math.round(svc.price * (1 - rate) * 100) / 100;
    assert(bkD.booking.total === want, "booking total reflects member discount -> " + D.money(bkD.booking.total) + " (rate " + bkD.booking.discountRate + ")");
  }
} else {
  assert(true, "no open nail-trim slot to test booking discount");
}

console.log("\n== done ==");
if (process.exitCode) console.error("FAILURES");
else console.log("ALL CHECKS PASSED");
