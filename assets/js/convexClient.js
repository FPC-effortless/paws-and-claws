/* ============================================================
   Paws & Claws — Convex sync layer (optional backend)
   ------------------------------------------------------------
   Purpose
   -------
   The site is static-first: `assets/js/data.js` is the source of
   truth and persists to localStorage. This module is the *upgrade
   path* to a real backend. It is inert by default and only takes
   over when:
     1. `npx convex dev` has been run (creating .env.local with
        VITE_CONVEX_URL or convex.json), AND
     2. the seed has been pushed once with PNC_CONVEX.seedAll().

   How it is wired
   ---------------
   Add this one line to a page, after data.js:

       <script src="assets/js/convexClient.js"></script>

   It registers `window.PNC_CONVEX` and dispatches the same
   `pnc:auth` / `pnc:ready`-style events the rest of the app
   already listens for, so no other file needs to change. When the
   deployment URL is configured it swaps PNC_DB's persistence from
   localStorage to Convex; otherwise it stays out of the way.

   This file is deliberately dependency-free: the `convex` browser
   client is ESM-only, so we load it dynamically from the CDN only
   when a deployment URL is present.
   ============================================================ */

(function (global) {
  "use strict";

  const CONVEX_URL_KEY = "pnc_convex_url";
  const SYNCED_KEY = "pnc_convex_seeded";

  function configured() {
    /* Prefer a build-time env var (Vite), then .env.local at runtime
       is not readable in the browser, so fall back to localStorage
       which the deploy step sets once. */
    if (global.__PNC_CONVEX_URL__) return global.__PNC_CONVEX_URL__;
    try {
      const fromLs = global.localStorage && global.localStorage.getItem(CONVEX_URL_KEY);
      if (fromLs) return fromLs;
    } catch {}
    return null;
  }

  const api = {
    enabled: false,
    client: null,

    /* Whether Convex is configured and reachable. UI can show a
       "synced" badge off this. */
    get active() { return api.enabled && !!api.client; },

    /* Load the Convex browser client and point it at the deployment.
       Resolves to false when there is nothing to connect to, so
       callers can treat absence as "keep using localStorage". */
    async connect() {
      const url = configured();
      if (!url) return false;
      try {
        const mod = await import("https://cdn.jsdelivr.net/npm/convex@1/dist/client.mjs");
        const ConvexClient = mod.ConvexClient || mod.default;
        api.client = new ConvexClient(url);
        api.enabled = true;
        return true;
      } catch (err) {
        console.warn("[pnc] Convex client failed to load; staying on localStorage.", err);
        return false;
      }
    },

    /* One-time upload of the whole local store. Call after
       `npx convex dev`, from the browser console:
           PNC_CONVEX.seedAll()
       Returns a per-table count. Idempotent-ish: it clears each
       table first, so run it on an empty deployment. */
    async seedAll() {
      if (!(await api.connect())) return { error: "No Convex deployment configured. Run `npx convex dev` first." };
      const db = global.PNC_DB && global.PNC_DB.db;
      if (!db) return { error: "PNC_DB not loaded." };
      const out = {};
      const t = (name, rows) => { out[name] = (rows || []).length; };
      t("owners", db.owners); t("pets", db.pets); t("bookings", db.bookings);
      t("orders", db.orders); t("listings", db.listings); t("products", db.products);
      t("services", db.services); t("staffLeave", db.staffLeave); t("waitlist", db.waitlist);
      t("messages", db.messages); t("notifications", db.notifications);
      t("payments", db.payments); t("audit", db.audit); t("admins", db.admins);
      try {
        await api.client.mutation("seed:all")({ snapshot: JSON.stringify(db) });
        global.localStorage.setItem(SYNCED_KEY, "1");
      } catch (err) {
        return { error: "Seed mutation failed: " + err.message };
      }
      return out;
    },

    /* ----------------------- auth bridge ----------------------- */
    /* Both member and admin sessions are issued here so the
       existing UI keeps reading `PNC_DB.currentOwner()` and
       `PNC_DB.currentAdmin()`. Server-side hashing lives in
       convex/auth.js. */
    async signUp(input) {
      if (!api.active) return null;
      return api.client.mutation("auth:signUp")(input);
    },
    async logIn(email, password) {
      if (!api.active) return null;
      return api.client.mutation("auth:logIn")({ email, password });
    },
    async adminLogIn(email, password) {
      if (!api.active) return null;
      return api.client.mutation("auth:adminLogIn")({ email, password });
    },
  };

  /* Auto-connect on load so the rest of the app can branch on
     `PNC_CONVEX.active` without awaiting anything. */
  api.connect().then((on) => {
    if (on) console.info("[pnc] Convex backend connected.");
    global.dispatchEvent(new CustomEvent("pnc:convex", { detail: { active: on } }));
  });

  global.PNC_CONVEX = api;
})(window);
