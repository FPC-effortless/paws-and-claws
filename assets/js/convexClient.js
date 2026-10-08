/* Paws & Claws — authenticated Convex bridge.
   In production Convex is the authoritative backend. The browser keeps
   only a scoped cache returned by domain:bootstrap. No Convex URL is
   taken from localStorage and no destructive seed mutation is exposed. */

(function (global) {
  "use strict";

  const DEFAULT_URL = "https://gallant-lion-490.convex.cloud";
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
          if (!global.convex || !global.convex.ConvexClient) {
            if (!global.__PNC_CONVEX_BUNDLE_PROMISE) {
              global.__PNC_CONVEX_BUNDLE_PROMISE = new Promise(function (resolve, reject) {
                const script = document.createElement("script");
                script.src = "/assets/js/convex.browser.bundle.js?v=production-20261008";
                script.onload = resolve;
                script.onerror = function () { reject(new Error("Unable to load the local Convex client bundle.")); };
                document.head.appendChild(script);
              });
            }
            await global.__PNC_CONVEX_BUNDLE_PROMISE;
          }
          const ConvexClient = global.convex && global.convex.ConvexClient;
          if (!ConvexClient) throw new Error("Convex client bundle did not expose ConvexClient.");
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

  async function bindClerk() {
    const on = await api.connect();
    if (!on) return;
    if (global.PNC_CLERK && global.PNC_CLERK.active) {
      try { await api.mutate("ensureOwner", {}); } catch {}
    }
    await api.syncBootstrap();
  }

  global.addEventListener("pnc:clerk", bindClerk);
  bindClerk();
})(window);
