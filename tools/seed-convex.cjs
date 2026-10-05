#!/usr/bin/env node
/* Trusted one-time bootstrap for a Convex deployment.
   Run after "npx convex dev" has generated convex/_generated/api_cjs.cjs.

   Required environment variables:
     CONVEX_URL
     PNC_BOOTSTRAP_SECRET

   This script runs the existing demo seed locally, then sends it over
   an authenticated HTTPS mutation protected by the deployment secret.
   Do not use this against a production database unless the snapshot has
   been deliberately reviewed and the database is intended to contain it.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api_cjs.cjs");

const url = process.env.CONVEX_URL;
const secret = process.env.PNC_BOOTSTRAP_SECRET;
if (!url || !secret) {
  console.error("Set CONVEX_URL and PNC_BOOTSTRAP_SECRET.");
  process.exit(2);
}

const store = {};
const sandbox = {
  localStorage: {
    getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  location: { hostname: "localhost" },
  console, Math, Date, JSON, Array, Object, String, Number, Error,
  Set, URLSearchParams, CustomEvent,
  dispatchEvent() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "assets", "js", "data.js"), "utf8"),
  sandbox,
);

const db = sandbox.PNC_DB.seed();
const client = new ConvexHttpClient(url);
client.mutation(api.seed.all, {
  secret,
  snapshot: JSON.stringify(db),
}).then((counts) => {
  console.log(JSON.stringify(counts, null, 2));
}).catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exitCode = 1;
});
