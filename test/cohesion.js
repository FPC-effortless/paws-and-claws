const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");

const booking = read("assets/js/booking.js");
const services = read("services.html");
const contact = read("contact.html");
const nav = read("assets/js/nav.js");

assert(!contact.includes("a licensed vet will triage"), "Do not promise an unverified vet emergency hotline");
assert(contact.includes("Seek immediate advice from a local veterinary clinic."), "Direct emergencies to a clinic");
assert(contact.includes("Send a non-urgent message"), "Do not present contact forms as emergency triage");
assert(!services.includes("A deposit holds your spot"), "Online deposit collection is unavailable");
assert(services.includes("Online payments are not available"), "Booking flow explains payment limits");
assert(booking.includes("o && !D.productionMode()"), "Production must not show demo membership discounts");
assert(booking.includes("Paid online now"), "Display online payment amount explicitly");
assert(!booking.includes('"Charged now"'), "Never describe uncollected deposits as charged");
assert(booking.includes("D.productionMode() && s.deposit"), "Deposit-only services must not advertise online booking");
assert(nav.includes("syncVisitCta();"), "Navbar reacts to catalog publication");
assert(nav.includes("Online delivery not available"), "Cart must not promise online delivery");
console.log("WEBSITE COHESION CHECKS PASSED");
