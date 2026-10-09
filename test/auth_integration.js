/* Browser bridge regression: run without external network or real credentials. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", "assets", "js", name), "utf8");
const events = [];
let signedIn = { id: "user_first", primaryEmailAddress: { emailAddress: "first@example.test" } };
let clerkListener;
let cleared = 0, applied = 0;
const client = { setAuth(callback, onAuth) { this.tokenCallback = callback; this.authChange = onAuth; }, query: async () => ({ version: 1, owners: [], admins: [] }),
  mutation: async () => ({ ok: true }), close: async () => {} };
const Clerk = {
  user: signedIn,
  session: { getToken: async () => "example-jwt" },
  async load() {},
  addListener(fn) { clerkListener = fn; return () => {}; },
  async signOut() { this.user = null; this.session = null; clerkListener(); }
};
const sandbox = {
  console, URLSearchParams, CustomEvent, Promise,
  location: { hostname: "paws.example.test", search: "" },
  PNC_CLERK_PUBLISHABLE_KEY: "pk_test_" + Buffer.from("clerk.example.test$").toString("base64"),
  atob: s => Buffer.from(s, "base64").toString(),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null },
  __internal_ClerkUICtor: function () {},
  Clerk, convex: { ConvexClient: function () { return client; } },
  PNC_DB: { productionMode: () => true, clearRemoteSnapshot() { cleared++; }, applyRemoteSnapshot() { applied++; } },
  addEventListener(type, fn) { (events[type] ||= []).push(fn); },
  dispatchEvent(event) { for (const fn of events[event.type] || []) fn(event); }
};
sandbox.document = { createElement() { return { setAttribute() {}, onload: null }; },
  head: { appendChild(script) { Promise.resolve().then(() => script.onload()); } } };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("clerk.js"), sandbox);
vm.runInContext(read("convexClient.js"), sandbox);
(async () => {
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(sandbox.PNC_CLERK.clerk.user.id, "user_first", "the Clerk SDK is exposed on the bridge");
  assert.equal(typeof client.tokenCallback, "function", "Convex receives a token getter");
  assert.equal(await client.tokenCallback(), "example-jwt", "Clerk template token is passed through");
  client.authChange(true);
  let finishSnapshot;
  client.query = () => new Promise(resolve => { finishSnapshot = resolve; });
  const beforeClear = cleared, beforeApply = applied;
  const pendingSync = sandbox.PNC_CONVEX.syncBootstrap();
  await new Promise(resolve => setImmediate(resolve));
  client.authChange(false);
  assert.equal(cleared,beforeClear+1,"expired backend auth clears private browser records");
  finishSnapshot({version:1,owners:[{id:'private'}],admins:[]});
  assert.equal(await pendingSync,false,"a snapshot arriving after auth loss is discarded");
  assert.equal(applied,beforeApply,"stale private records cannot return to the browser cache");
  client.query = async () => ({version:1,owners:[],admins:[]});
  await sandbox.PNC_CLERK.signOut();
  assert.equal(sandbox.PNC_CLERK.currentOwner(), null, "sign-out clears identity");
  assert.equal(await client.tokenCallback(), null, "no Clerk session means no token");
  console.log("AUTH INTEGRATION GUARDS PASSED");
})().catch(error => { console.error(error); process.exitCode = 1; });
