/* ============================================================
   Paws & Claws — Clerk identity layer
   ------------------------------------------------------------
   Clerk is the sole identity provider for members and staff.

   Zero build step: @clerk/clerk-js is fetched from Clerk's own
   CDN the same way convexClient.js fetches the Convex client. The
   only thing that has to be present in the repo is a PUBLISHABLE
   key (pk_test_/pk_live_), which is safe to ship in a static
   deploy — the secret key stays out of the repo entirely and is
   set in the Convex dashboard for the backend.

   Role model
   ----------
   Staff roles live in the Clerk user's `publicMetadata.role`
   (super | desk | provider | retail), which maps onto the existing
   PNC_DB RBAC table. publicMetadata is readable by the browser,
   which is exactly what the admin console needs. The role is
   provisioned in the Clerk dashboard, not written from the client.

   Members carry no role; `publicMetadata.plan` mirrors the
   membership plan so discounts still resolve server-side.

   Demo mode
   ---------
   With no key configured the site runs in DEMO MODE. This is NOT
   an authentication fallback — Clerk is still the only thing that
   can issue a real session. It is a documented escape hatch
   (?demo=1 or a missing key) that keeps the deployed demo and the
   test harness usable while the Clerk project is being created.
   ============================================================ */

(function (global) {
  "use strict";

  /* The publishable key (pk_test_/pk_live_) is safe to ship in a
     static deploy. Set it HERE — this is the single source of truth
     for the whole site. A page may override it earlier with
     window.PNC_CLERK_PUBLISHABLE_KEY, but there is no reason to:
     one place, one deploy target. The SECRET key never goes here. */
  const DEFAULT_KEY = "";
  const PUBLISHABLE_KEY = global.PNC_CLERK_PUBLISHABLE_KEY || DEFAULT_KEY;
  const DEMO_FLAG = "pnc_demo";

  const api = {
    loaded: false,
    clerk: null,
    demo: false,
  };

  /* Announce the identity mode. Every gate subscribes to `pnc:clerk`,
     so this must never throw — a failed dispatch would reject load()
     and leave the gates showing the wrong UI. */
  function announce(mode, active) {
    try {
      global.dispatchEvent(new CustomEvent("pnc:clerk", { detail: { mode, active } }));
    } catch (err) {
      try { console.warn("[pnc] Could not dispatch pnc:clerk.", err); } catch {}
    }
  }

  function configured() { return typeof PUBLISHABLE_KEY === "string" && PUBLISHABLE_KEY.length > 0; }

  function demoRequested() {
    try {
      if (global.location && new URLSearchParams(global.location.search).get("demo") === "1") return true;
      if (global.sessionStorage && global.sessionStorage.getItem(DEMO_FLAG) === "1") return true;
    } catch {}
    return false;
  }

  /* Derive the Frontend API domain from the publishable key, per
     Clerk's vanilla-JS quickstart. The middle segment of the key is
     base64, so atob it. */
  function clerkDomain(key) {
    try { return global.atob(key.split("_")[2]).slice(0, -1); }
    catch { return null; }
  }

  async function loadClerkUI(domain) {
    await new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "https://" + domain + "/npm/@clerk/ui@1/dist/ui.browser.js";
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load the Clerk UI bundle")); };
      document.head.appendChild(s);
    });
    return global.__internal_ClerkUICtor;
  }

  /* --------------------------- public API --------------------------- */

  /** Clerk user -> PNC owner shape. Never returns a password. */
  function toOwner(user) {
    if (!user) return null;
    const md = user.publicMetadata || {};
    const primary = user.primaryEmailAddress || {};
    return {
      id: "clerk-" + user.id,
      clerkId: user.id,
      email: primary.emailAddress || "",
      fullName: (user.fullName ||
        (user.firstName ? user.firstName + " " + (user.lastName || "") : "") ||
        primary.emailAddress || "").trim(),
      phone: (user.primaryPhoneNumber || {}).phoneNumber || "",
      plan: md.plan || "puppy",
      source: "clerk",
    };
  }

  function toAdmin(user) {
    if (!user) return null;
    const md = user.publicMetadata || {};
    if (!md.role) return null;
    return {
      id: "clerk-" + user.id,
      clerkId: user.id,
      email: (user.primaryEmailAddress || {}).emailAddress || "",
      name: user.fullName || (user.primaryEmailAddress || {}).emailAddress || "Staff",
      role: md.role,
      providerId: md.providerId || null,
      source: "clerk",
    };
  }

  const bridge = {
    get active() { return api.loaded && !!api.clerk; },
    get demo() { return api.demo; },
    get configured() { return configured(); },
    get mode() { return api.demo ? "demo" : "clerk"; },

    async load() {
      if (api.loaded) return api.clerk;
      /* DEMO MODE --------------------------------------------------
         Reached by ?demo=1, sessionStorage, or a missing publishable
         key. Clerk is not initialised; the auth bridge below
         short-circuits and the local store provides demo identity.
         No Clerk session is ever minted here. */
      if (!configured() || demoRequested()) {
        api.demo = true;
        api.loaded = true;
        announce("demo", false);
        return null;
      }
      try {
        const domain = clerkDomain(PUBLISHABLE_KEY);
        if (!domain) throw new Error("Could not derive a Clerk domain from the publishable key.");
        const ClerkUI = await loadClerkUI(domain);
        const clerk = new global.Clerk(PUBLISHABLE_KEY);
        await clerk.load({ ui: { ClerkUI } });
        api.clerk = clerk;
        api.loaded = true;
        announce("clerk", true);
        return clerk;
      } catch (err) {
        console.warn("[pnc] Clerk failed to load. Fixing the publishable key will enable sign-in.", err);
        api.demo = true;
        api.loaded = true;
        announce("demo", false);
        return null;
      }
    },

    /* ---------------------------- members ---------------------------- */
    /* Returns the Clerk user mapped to the PNC owner shape, or null. */
    currentOwner() {
      if (!bridge.active) return null;
      return toOwner(api.clerk.user);
    },

    /* ---------------------------- staff ------------------------------ */
    /* A Clerk user is staff only if publicMetadata.role is set. */
    currentAdmin() {
      if (!bridge.active) return null;
      return toAdmin(api.clerk.user);
    },

    /* --------------------------- mounting --------------------------- */
    mountSignIn(el, opts) {
      if (!bridge.active || !el) return;
      api.clerk.mountSignIn(el, opts || {});
    },
    mountSignUp(el, opts) {
      if (!bridge.active || !el) return;
      api.clerk.mountSignUp(el, opts || {});
    },
    mountUserButton(el, opts) {
      if (!bridge.active || !el) return;
      api.clerk.mountUserButton(el, opts || {});
    },
    openSignIn(opts) {
      if (!bridge.active) return;
      api.clerk.openSignIn(opts || {});
    },
    openSignUp(opts) {
      if (!bridge.active) return;
      api.clerk.openSignUp(opts || {});
    },

    async signOut() {
      if (!bridge.active) return;
      await api.clerk.signOut();
    },
  };

  global.PNC_CLERK = bridge;

  /* Auto-load on script parse, the same way convexClient.js
     auto-connects. The gates listen for `pnc:clerk` and switch their
     UI when this resolves, so pages never have to await it. */
  bridge.load().catch(function (err) {
    console.warn("[pnc] Clerk bootstrap failed.", err);
  });
})(window);
