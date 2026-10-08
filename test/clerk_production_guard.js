/* Hosted Clerk guard: a missing/failed Clerk configuration must never
   become the local demo authentication path. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dispatched = [];
const sandbox = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { hostname: "paws.example.com", search: "" },
  document: {
    createElement() { throw new Error("network disabled in test"); },
    head: { appendChild() {} },
  },
  console,
  Math, Date, JSON, Array, Object, String, Number, Error,
  CustomEvent, URLSearchParams,
  atob: (s) => Buffer.from(s, "base64").toString("ascii"),
  dispatchEvent(ev) { dispatched.push(ev); },
};
sandbox.PNC_CLERK_PUBLISHABLE_KEY = ""; // Exercise missing-key hosted failure.
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "assets", "js", "clerk.js"), "utf8"), sandbox);

setTimeout(() => {
  let failures = 0;
  function assert(cond, msg) {
    if (!cond) { failures++; console.error("FAIL: " + msg); }
    else console.log("  ok  " + msg);
  }
  console.log("\n== hosted Clerk fail-closed guard ==");
  assert(sandbox.PNC_CLERK.mode === "unavailable", "hosted site reports Clerk unavailable instead of demo mode");
  assert(sandbox.PNC_CLERK.demo === false, "hosted site never enables demo auth");
  assert(sandbox.PNC_CLERK.active === false, "Clerk is inactive when no publishable key exists");
  assert(dispatched.length === 1 && dispatched[0].detail.mode === "unavailable", "unavailable mode is announced");
  if (failures) process.exitCode = 1;
  else console.log("HOSTED CLERK GUARD PASSED");
}, 50);
