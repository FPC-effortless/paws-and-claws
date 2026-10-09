/* Paws & Claws — authenticated Convex bridge.
   In production Convex is the authoritative backend. The browser keeps
   only a scoped cache returned by domain:bootstrap. No Convex URL is
   taken from localStorage and no destructive seed mutation is exposed. */

(function (global) {
  "use strict";

  const DEFAULT_URL = "https://gallant-lion-490.convex.cloud";
  const SYNCED_KEY = "pnc_convex_seeded";
  let authConfigured = false;
  let syncPromise = null;
  let observedClerk = null;
  let lastAuthSyncError = "";
  let boundSession = undefined;
  let sessionVersion = 0;
  let serverAuthenticated = false;

  function configured() {
    return String(global.__PNC_CONVEX_URL__ || DEFAULT_URL).trim() || null;
  }

  const api = {
    enabled: false,
    client: null,
    syncing: false,
    get active() { return api.enabled && !!api.client; },

    async connect() {
      if (!global.PNC_CLERK || global.PNC_CLERK.demo) return false;
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

        if (!authConfigured) api.client.setAuth(
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
            if (!authenticated && serverAuthenticated) {
              sessionVersion++;
              if (global.PNC_DB?.clearRemoteSnapshot) global.PNC_DB.clearRemoteSnapshot();
            }
            serverAuthenticated = authenticated;
            global.dispatchEvent(new CustomEvent("pnc:convex-auth", { detail: { authenticated } }));
          }
        );

        authConfigured = true;
        api.enabled = true;
        return true;
      } catch (err) {
        api.enabled = false;
        console.warn("[pnc] Convex client failed to initialize.", err);
        return false;
      }
    },

    async syncBootstrap() {
      if (syncPromise) return syncPromise;
      const version = sessionVersion;
      syncPromise = (async () => {
        if (!(await api.connect())) return false;
        api.syncing = true;
        try {
          const snapshot = await api.client.query("domain:bootstrap", {});
          if (version !== sessionVersion) return false;
          if (snapshot && global.PNC_DB && global.PNC_DB.applyRemoteSnapshot) {
            global.PNC_DB.applyRemoteSnapshot(snapshot);
            global.dispatchEvent(new CustomEvent("pnc:convex-ready", { detail: { snapshot } }));
            return true;
          }
          return false;
        } catch (err) {
          console.warn("[pnc] Convex bootstrap failed.", err);
          return false;
        } finally { api.syncing = false; }
      })();
      try { return await syncPromise; } finally { syncPromise = null; }
    },

    async mutate(op, payload) {
      const version = sessionVersion;
      if (!(await api.connect())) return { error: "Secure backend is not configured." };
      try {
        const result = await api.client.mutation("domain:mutate", {
          op: String(op),
          payload: payload || {}
        });
        if (version !== sessionVersion) return { error: "Your session changed. Refresh and check the action's status before retrying." };
        return result;
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
      authConfigured = false;
      serverAuthenticated = false;
      boundSession = undefined;
      sessionVersion++;
    }
  };

  global.PNC_CONVEX = api;

  async function bindClerk() {
    const ck = global.PNC_CLERK;
    if (ck && ck.demo) { await api.close(); return; }
    if (!(await api.connect())) return;
    async function refreshSession() {
      const session = ck && ck.clerk && ck.clerk.session ? ck.clerk.session.id : null;
      if (session === boundSession) return;
      boundSession = session;
      sessionVersion++;
      if (global.PNC_DB && global.PNC_DB.productionMode && global.PNC_DB.productionMode()) {
        if (global.PNC_DB.clearRemoteSnapshot) global.PNC_DB.clearRemoteSnapshot();
      }
      if (syncPromise) await syncPromise;
      if (session) {
        const owner = ck && typeof ck.currentOwner === "function" ? ck.currentOwner() : null;
        const result = await api.mutate("ensureOwner", {
          profile: owner ? { email: owner.email, fullName: owner.fullName } : {}
        });
        if (result && result.error) {
          const message = String(result.error);
          if (message !== lastAuthSyncError) {
            lastAuthSyncError = message;
            try {
              global.dispatchEvent(new CustomEvent("pnc:auth-sync-error", {
                detail: { message, session }
              }));
            } catch {}
          }
          return;
        }
        lastAuthSyncError = "";
      }
      await api.syncBootstrap();
    }
    if (ck && ck.active && ck.clerk && observedClerk !== ck.clerk) {
      observedClerk = ck.clerk;
      if (typeof ck.clerk.addListener === "function") ck.clerk.addListener(refreshSession);
    }
    await refreshSession();
  }

  global.addEventListener("pnc:clerk", bindClerk);
  bindClerk();
})(window);
