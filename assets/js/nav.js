/* ============================================================
   Paws & Claws — Shared site chrome
   Renders the unified nav (5 areas + admin), the notification
   bell + popover, the CMS banner, and keeps auth state in sync
   between the legacy PNC Auth and the new PNC_DB owner session.
   Loaded after app.js and data.js.
   ============================================================ */

(function (global) {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = global.PNC_DB;

  const NAV = [
    { href: "index.html", label: "Home" },
    { href: "services.html", label: "Services", match: ["services.html", "pets.html"] },
    { href: "shop.html", label: "Shop", match: ["shop.html"] },
    { href: "account.html", label: "Member", match: ["account.html", "membership.html"] },
    { href: "contact.html", label: "Contact", match: ["contact.html"] }
  ];

  function here() {
    const p = location.pathname.split("/").pop() || "index.html";
    return p.replace(/\.html$/, "");
  }

  /* assets/ are always referenced from the site root so the same markup
     works at /index.html and /admin/ (which is one level deeper) */
  function asset(p) {
    return (location.pathname.indexOf("/admin/") !== -1 ? "../assets/" : "assets/") + p;
  }

  function brandImg(cls) {
    return '<img class="' + cls + '" src="' + asset("brand/logo-112.webp") +
      '" width="42" height="42" alt="" loading="eager" decoding="async">';
  }

  function bellSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
  }

  function navHTML() {
    const page = here();
    const links = NAV.map(function (n) {
      const isMe = n.match ? n.match.indexOf(page + ".html") !== -1 : n.href === page + ".html";
      return '<a href="' + n.href + '"' + (isMe ? ' class="active" aria-current="page"' : "") + ">" + n.label + "</a>";
    }).join("");

    const cart = '<button class="cart-btn" id="cartBtn" aria-label="Open cart">' +
      '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="var(--ocean)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h2.5l2.6 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.5L21 8H6"/>' +
      "</svg>" +
      '<span class="cart-count" id="cartCount" data-empty="true">0</span>' +
      "</button>";

    const bell = '<button class="nav-bell" id="notifBtn" aria-label="Notifications" aria-expanded="false">' +
      bellSvg() + '<span class="dot" id="notifDot" data-empty="true">0</span></button>';

    return (
      '<div class="wrap"><nav class="nav">' +
        '<a class="brand" href="index.html" aria-label="Paws and Claws home">' +
          brandImg("brand-mark brand-img") +
          "<span>Paws &amp; Claws<small>Pet Co.</small></span>" +
        "</a>" +
        '<div class="nav-links" id="primaryNav">' + links +
          '<a href="account.html" data-member-only hidden>My pets</a>' +
          '<a class="btn btn-teal" id="visitNavLink" href="services.html#book">Book a visit</a>' +
        "</div>" +
        '<div class="nav-actions">' +
          '<div id="memberZone"></div>' +
          bell + cart +
          '<button class="burger" aria-label="Open menu" aria-controls="primaryNav" aria-expanded="false"><span></span></button>' +
        "</div>" +
      "</nav></div>"
    );
  }

  function cartModalHTML() {
    return (
      '<div class="modal-backdrop" id="cartModal">' +
        '<div class="modal modal-shell" role="dialog" aria-modal="true" aria-labelledby="cartTitle">' +
          '<button class="modal-close" data-close-modal="cartModal" aria-label="Close cart">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="var(--ocean)" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          "</button>" +
          '<div class="modal-pad">' +
            '<h2 id="cartTitle" style="font-size:1.5rem">Your cart</h2>' +
            '<div id="cartBody"></div>' +
            '<div class="cart-foot" id="cartDrawer" hidden>' +
              '<div class="row" id="cartSubtotal" hidden></div>' +
              '<div class="row" id="cartDiscount" hidden></div>' +
              '<div class="row"><span>Total</span><span id="cartTotal">&#8358;0.00</span></div>' +
              '<div class="row"><span>Fulfillment</span><span>Online delivery not available</span></div>' +
              '<button class="btn btn-primary btn-block" id="cartCheckout">Proceed to checkout</button>' +
              '<p class="cart-note">Online payments are unavailable. Visit our Amasoma store to confirm price and availability.</p>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function footerHTML() {
    const g = '<svg viewBox="0 0 24 24"><path d="M12 2c2.7 0 3 0 4.1.1 1.1 0 1.8.2 2.4.5.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.3.6.4 1.3.5 2.4.1 1.1.1 1.4.1 4.4s0 3.3-.1 4.4c0 1.1-.2 1.8-.5 2.4a4.5 4.5 0 0 1-1 1.6c-.5.5-1 .8-1.6 1-.6.3-1.3.4-2.4.5-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1.1 0-1.8-.2-2.4-.5a4.5 4.5 0 0 1-1.6-1c-.5-.5-.8-1-1-1.6-.3-.6-.4-1.3-.5-2.4C2.3 15.3 2.3 15 2.3 12s0-3.3.1-4.4c0-1.1.2-1.8.5-2.4a4.5 4.5 0 0 1 1-1.6c.5-.5 1-.8 1.6-1 .6-.3 1.3-.4 2.4-.5C9 2 9.3 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM18.4 6.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/></svg>';
    const f = '<svg viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>';
    const t = '<svg viewBox="0 0 24 24"><path d="M16.5 2h-2.6v13a2.4 2.4 0 1 1-2.4-2.4c.2 0 .5 0 .7.1V9.9a5.1 5.1 0 1 0 4.3 5V8.6a5.9 5.9 0 0 0 3.5 1.2V7.1a3.4 3.4 0 0 1-3.5-3.4V2Z"/></svg>';
    const mark = brandImg("brand-mark brand-img footer-mark");
    return (
      '<footer class="site-footer"><div class="wrap"><div class="footer-grid">' +
        "<div>" +
          '<div class="footer-brand">' + mark + "Paws &amp; Claws</div>" +
          "<p>Visit our pet store in Amasoma for supplies and care. Plan appointments and contact our team online.</p>" +
        "</div>" +
        "<div><h4>Shop</h4><ul>" +
          '<li><a href="shop.html?cat=Food">Food &amp; Treats</a></li>' +
          '<li><a href="shop.html?cat=Toys">Toys</a></li>' +
          '<li><a href="shop.html?cat=Grooming">Grooming</a></li>' +
          '<li><a href="pets.html">Pet Marketplace</a></li>' +
        "</ul></div>" +
        "<div><h4>Company</h4><ul>" +
          '<li><a href="services.html">Services &amp; Booking</a></li>' +
          '<li><a href="membership.html">Membership</a></li>' +
          '<li><a href="account.html">Member Portal</a></li>' +
          '<li><a href="contact.html">Contact &amp; Emergency</a></li>' +
          '<li><a href="admin/">Admin Control Panel</a></li>' +
        "</ul></div>" +
        '<div id="footerVisit"><h4>Visit us</h4><ul></ul></div>' +
      "</div>" +
      '<div class="footer-bottom">' +
        "<span>© 2026 Paws &amp; Claws Pet Co. All rights reserved.</span>" +
        "<span>Made with 🐾 for pets everywhere.</span>" +
      "</div></div></footer>"
    );
  }

  /* ---------- notifications ---------- */
  function myNotifs() {
    const o = D.currentOwner();
    if (!o) return [];
    return (D.db.notifications || [])
      .filter((n) => n.ownerId === o.id)
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  function renderBell() {
    const dot = $("#notifDot");
    if (!dot) return;
    const list = myNotifs();
    const unread = list.filter((n) => !n.read).length;
    dot.textContent = unread;
    dot.dataset.empty = String(unread === 0);
  }

  function notifIcon(kind) {
    if (kind === "booking") return "📅";
    if (kind === "vaccine") return "💉";
    if (kind === "order") return "📦";
    if (kind === "waitlist") return "🔔";
    if (kind === "listing") return "🐾";
    return "💌";
  }

  function openPop() {
    let pop = $("#notifPop");
    if (pop) { pop.remove(); closePop(); return; }
    const list = myNotifs();
    pop = document.createElement("div");
    pop.className = "notif-pop";
    pop.id = "notifPop";
    pop.innerHTML =
      "<header><b>Notifications</b>" +
      (list.length ? '<button id="markAll">Mark all read</button>' : "") +
      "</header>" +
      (list.length
        ? '<div class="notif-list">' + list.map(function (n) {
            return '<button class="notif-item' + (n.read ? "" : " unread") + '" data-notif="' + n.id + '">' +
              '<span class="ni">' + notifIcon(n.kind) + "</span>" +
              "<span><b>" + D.esc(n.title) + "</b><p>" + D.esc(n.body) + "</p>" +
              "<small>" + D.fmtDate(n.createdAt) + "</small></span></button>";
          }).join("") + "</div>"
        : '<div class="notif-empty">No notifications yet. Book a visit and updates will land here.</div>');
    document.body.appendChild(pop);
    const btn = $("#notifBtn");
    btn.setAttribute("aria-expanded", "true");
    $("#markAll", pop) && $("#markAll", pop).addEventListener("click", async function () {
      if (D.productionMode && D.productionMode()) {
        if (!global.PNC_CONVEX || !global.PNC_CONVEX.active) return PNC.toast("Secure backend is not available.", "err");
        const r = await global.PNC_CONVEX.mutate("markNotificationsRead", {});
        if (r && r.error) return PNC.toast(r.error, "err");
        await global.PNC_CONVEX.syncBootstrap();
      } else {
        (D.db.notifications || []).forEach(function (n) { if (n.ownerId === (D.currentOwner() || {}).id) n.read = true; });
        D.persist();
      }
      renderBell();
      closePop();
      PNC.toast("All notifications marked as read");
    });
    $$("[data-notif]", pop).forEach(function (b) {
      b.addEventListener("click", async function () {
        const n = D.byId(D.db.notifications, b.dataset.notif);
        if (!n) return;
        if (D.productionMode && D.productionMode()) {
          const r = await Promise.resolve((D.currentOwner() && global.PNC_CONVEX && global.PNC_CONVEX.active)
            ? global.PNC_CONVEX.mutate("markNotificationRead", { notificationId: n.id }).then(function (x) {
                return global.PNC_CONVEX.syncBootstrap().then(function () { return x; });
              })
            : { error: "Secure backend is not available." });
          if (r && r.error) return (global.PNC ? global.PNC.toast(r.error, "err") : undefined);
        } else {
          n.read = true;
          D.persist();
        }
        renderBell();
        closePop();
      });
    });
  }

  function closePop() {
    const pop = $("#notifPop");
    if (pop) pop.remove();
    const btn = $("#notifBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function syncVisitCta() {
    const link = $("#visitNavLink");
    if (!link) return;
    const bookable = D.catalogReady && D.catalogReady();
    link.href = bookable ? "services.html#book" : "contact.html";
    link.textContent = bookable ? "Book a visit" : "Ask about visits";
  }

  function renderCmsChrome() {
    const header = $(".site-header"), cms = D.db.cms;
    if (!header || !cms) return;
    let banner = $(".site-banner");
    if (cms.banner) {
      if (!banner) { banner = document.createElement("div"); banner.className = "site-banner"; header.before(banner); }
      banner.textContent = cms.banner;
    } else if (banner) banner.remove();
    const visit = $("#footerVisit ul");
    if (visit) visit.innerHTML = "<li>" + D.esc(cms.address || "").replace(/, /g, "<br>") + "</li>" +
      (Array.isArray(cms.hours) && cms.hours.length ? cms.hours.map(h =>
        "<li>" + D.esc(String(h.day).slice(0, 3)) + ": " + (h.open === "Closed" ? "Closed" : D.esc(h.open) + " – " + D.esc(h.close)) + "</li>").join("") : "<li>Opening hours to be confirmed</li>") +
      (cms.phone ? "<li>" + D.esc(cms.phone) + "</li>" : "");
  }

  /* ---------- mount ---------- */
  function mount() {
    const header = $(".site-header");
    if (!header) return;

    header.innerHTML = navHTML();

    /* cart modal + bell popover anchors */
    if (!$("#cartModal")) document.body.insertAdjacentHTML("beforeend", cartModalHTML());
    if (!$(".site-footer")) document.body.insertAdjacentHTML("beforeend", footerHTML());

    renderCmsChrome();
    syncVisitCta();

    const cartBtn = $("#cartBtn");
    if (cartBtn) cartBtn.addEventListener("click", function () { PNC.openModal("cartModal"); });

    const bell = $("#notifBtn");
    if (bell) bell.addEventListener("click", function (e) { e.stopPropagation(); openPop(); });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#notifPop") && !e.target.closest("#notifBtn")) closePop();
    });

    const main = $("main");
    if (main) {
      main.id = main.id || "main-content";
      main.tabIndex = -1;
      const skip = document.createElement("a");
      skip.className = "skip-link";
      skip.href = "#" + main.id;
      skip.textContent = "Skip to main content";
      document.body.prepend(skip);
    }
    const burger = $(".burger");
    function setMenu(open) {
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) $(".nav-links a").focus();
    }
    if (burger) burger.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    $$(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("click", function (e) {
      if (document.body.classList.contains("menu-open") && !e.target.closest(".nav")) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900 && document.body.classList.contains("menu-open")) setMenu(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if ($("#notifPop")) { closePop(); bell.focus(); }
      if (document.body.classList.contains("menu-open")) { setMenu(false); burger.focus(); }
    });
    const checkout = $("#cartCheckout");
    if (checkout && here() !== "shop") checkout.addEventListener("click", function () {
      location.href = "shop.html";
    });

    const onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    renderBell();
    if (global.PNC && global.PNC.Cart) global.PNC.Cart.render();

    /* sync member zone: prefer the new DB session */
    syncMemberZone();
    window.addEventListener("pnc:data-ready", function () { syncMemberZone(); renderBell(); renderCmsChrome(); syncVisitCta(); });
    window.addEventListener("pnc:auth", function () { syncMemberZone(); renderBell(); });
    window.addEventListener("storage", function () { renderBell(); syncMemberZone(); });
  }

  function syncMemberZone() {
    const zone = $("#memberZone");
    if (!zone) return;
    const o = D.currentOwner();
    if (o) {
      zone.innerHTML =
        '<a class="member-chip" href="account.html" title="Your member dashboard">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/></svg>' +
          D.esc(o.fullName.split(" ")[0]) +
        "</a>";
    } else {
      zone.innerHTML = '<a class="btn btn-teal" href="membership.html">Join now</a>';
    }
    $$("[data-member-only]").forEach(function (el) { el.hidden = !o; });
    $$("[data-guest-only]").forEach(function (el) { el.hidden = !!o; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    try { D.load(); } catch (e) { try { D.reset(); } catch (e2) {} }
    mount();
    document.dispatchEvent(new CustomEvent("pnc:nav-ready", { detail: { D: D } }));
  });

  global.PNC_NAV = { renderBell, syncMemberZone, closePop, openPop };
})(window);
