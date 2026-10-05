/* Paws & Claws — authenticated Convex bridge.
   In production Convex is the authoritative backend. The browser keeps
   only a scoped cache returned by domain:bootstrap. No Convex URL is
   taken from localStorage and no destructive seed mutation is exposed. */

(function (global) {
  "use strict";

  const DEFAULT_URL = "";
  const SYNCED_KEY = "pnc_convex_seeded";

  function configured() {
    return String(global.__PNC_CONVEX_URL__ || DEFAULT_URL).trim() || null;
  }

  const api = {
    enabled: false,
    client: null,
    syncing: false,
    get active() { return api.enabled && !!api.client; },

    async connect() {
      const url = configured();
      if (!url) return false;

      try {
        if (!api.client) {
          const mod = await import("https://cdn.jsdelivr.net/npm/convex@1.46.0/dist/client.mjs");
          const ConvexClient = mod.ConvexClient || mod.default;
          api.client = new ConvexClient(url);
        }

        const clerk = global.PNC_CLERK;
        if (!clerk || !clerk.active || !clerk.clerk) return false;

        api.client.setAuth(
          async function () {
            try {
              const session = clerk.clerk.session;
              if (!session) return null;
              return await session.getToken({ template: "convex" });
            } catch {
              return null;
            }
          },
          function (authenticated) {
            global.dispatchEvent(new CustomEvent("pnc:convex-auth", { detail: { authenticated } }));
          }
        );

        api.enabled = true;
        return true;
      } catch (err) {
        api.enabled = false;
        console.warn("[pnc] Convex client failed to initialize.", err);
        return false;
      }
    },

    async syncBootstrap() {
      if (!(await api.connect())) return false;
      if (api.syncing) return false;
      api.syncing = true;
      try {
        const snapshot = await api.client.query("domain:bootstrap", {});
        if (snapshot && global.PNC_DB && global.PNC_DB.applyRemoteSnapshot) {
          global.PNC_DB.applyRemoteSnapshot(snapshot);
          try { global.localStorage.setItem(SYNCED_KEY, "1"); } catch {}
          global.dispatchEvent(new CustomEvent("pnc:convex-ready", { detail: { snapshot } }));
          return true;
        }
        return false;
      } catch (err) {
        console.warn("[pnc] Convex bootstrap failed.", err);
        return false;
      } finally {
        api.syncing = false;
      }
    },

    async mutate(op, payload) {
      if (!(await api.connect())) return { error: "Secure backend is not configured." };
      try {
        return await api.client.mutation("domain:mutate", {
          op: String(op),
          payload: payload || {}
        });
      } catch (err) {
        return { error: String(err && err.message || err || "Secure operation failed.") };
      }
    },

    async close() {
      if (api.client) {
        try { await api.client.close(); } catch {}
      }
      api.client = null;
      api.enabled = false;
    }
  };

  global.PNC_CONVEX = api;

  function bindClerk() {
    api.connect().then(function () {
      api.syncBootstrap();
    });
  }

  global.addEventListener("pnc:clerk", bindClerk);
  bindClerk();
})(window);
