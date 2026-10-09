/* clerk.js demo-mode gate.
   Proves explicit localhost demo mode skips the Clerk CDN
   and never leaves the site
   without a PNC_CLERK handle. Runs with no network. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const warns = [];
const sandbox = {
  localStorage: {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  console: {
    log() {}, info() {},
    warn() { warns.push([].join.call(arguments, " ")); },
    error() { warns.push([].join.call(arguments, " ")); },
  },
  Math, Date, JSON, Array, Object, String, Number, Error,
  CustomEvent, URLSearchParams,
  atob: (s) => Buffer.from(s, "base64").toString("ascii"),
};
sandbox.PNC_CLERK_PUBLISHABLE_KEY = "pk_live_demo"; // Explicit demo must skip even a configured production SDK.
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* Simulate a blocked or dead Clerk CDN: the script tag never loads. */
sandbox.document = {
  createElement() { throw new Error("no DOM / CDN blocked"); },
  head: { appendChild() {} },
};
sandbox.location = { search: "?demo=1", origin: "http://localhost:8000", hostname: "localhost" };
sandbox.sessionStorage = { getItem: k => store[k] || null, setItem: (k,v) => store[k] = String(v), removeItem: k => delete store[k] };
/* A page dispatches events; record them so the test can confirm the
   gate announces demo mode to its listeners. */
const dispatched = [];
sandbox.dispatchEvent = function (ev) { dispatched.push(ev); };

vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "assets", "js", "clerk.js"), "utf8"),
  sandbox
);

const assert = (cond, msg) => {
  if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; }
  else console.log("  ok  " + msg);
};

setTimeout(function () {
  console.log("\n== clerk.js demo-mode gate ==");
  assert(!!sandbox.PNC_CLERK, "PNC_CLERK is defined even when local demo is requested");
  assert(sandbox.PNC_CLERK.mode === "demo", "mode is demo when local demo is requested");
  assert(sandbox.PNC_CLERK.demo === true, "demo flag set");
  assert(sandbox.PNC_CLERK.active === false, "not active in demo mode");
  assert(sandbox.PNC_CLERK.currentOwner() === null, "currentOwner() null in demo mode");
  assert(sandbox.PNC_CLERK.currentAdmin() === null, "currentAdmin() null in demo mode");
  assert(typeof sandbox.PNC_CLERK.signOut === "function", "signOut() is callable in demo mode");
  assert(warns.length === 0, "no console noise on the explicit-demo path (CDN is never even fetched)");
  assert(dispatched.length === 1 && dispatched[0].type === "pnc:clerk", "announced pnc:clerk exactly once");
  assert(dispatched[0].detail.mode === "demo" && dispatched[0].detail.active === false, "announcement says demo/inactive");
  assert(store.pnc_demo === '1', "local demo choice survives page navigation");
  sandbox.location.search = '';
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "assets", "js", "clerk.js"), "utf8"), sandbox);
  assert(sandbox.PNC_CLERK.demo, "navigation without demo query keeps the local demo session");

  console.log("\n== done ==");
  if (process.exitCode) console.error("FAILURES");
  else console.log("ALL CHECKS PASSED");
}, 300);
