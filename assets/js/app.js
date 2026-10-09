/* ============================================================
   Paws & Claws — Core application logic
   Vanilla JS. No dependencies. Uses localStorage for
   cart + membership state. Safe on GitHub Pages.
   ============================================================ */

(function (global) {
  "use strict";

  const STORE_KEYS = { cart: "pnc_cart_guest", member: "pnc_member", users: "pnc_users" };
  function cartKey() {
    try {
      const D = global.PNC_DB;
      const owner = D && D.currentOwner ? D.currentOwner() : null;
      return owner ? "pnc_cart_" + owner.id : STORE_KEYS.cart;
    } catch { return STORE_KEYS.cart; }
  }
  const CURRENCY = "\u20a6";

  /* ------------------------------ utils ------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (n) => CURRENCY + Number(n).toFixed(2);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const read = (k, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; }
    catch { return fallback; }
  };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e).trim());

  /* ----------------------------- toasts ------------------------------ */
  const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const ICON_ERR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>';

  function toast(msg, type) {
    let stack = $(".toast-stack");
    if (!stack) { stack = document.createElement("div"); stack.className = "toast-stack"; document.body.appendChild(stack); }
    const el = document.createElement("div");
    el.setAttribute("role", type === "err" ? "alert" : "status");
    el.className = "toast" + (type === "err" ? " err" : "");
    el.innerHTML = (type === "err" ? ICON_ERR : ICON_OK) + "<span>" + esc(msg) + "</span>";
    stack.appendChild(el);
    setTimeout(() => { el.style.transition = "opacity .3s, transform .3s"; el.style.opacity = "0"; el.style.transform = "translateY(10px)"; setTimeout(() => el.remove(), 320); }, 3400);
  }

  /* ----------------------------- modals ------------------------------- */
  const modalTriggers = new WeakMap();
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m || m.classList.contains("open")) return;
    modalTriggers.set(m, document.activeElement);
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    const f = m.querySelector("input,select,textarea,button");
    if (f) f.focus();
  }
  function closeModal(id) {
    const m = id ? document.getElementById(id) : $$(".modal-backdrop.open").pop();
    if (!m) return;
    m.classList.remove("open");
    if (!$(".modal-backdrop.open")) document.body.style.overflow = "";
    const trigger = modalTriggers.get(m);
    if (trigger && trigger.isConnected) trigger.focus();
    modalTriggers.delete(m);
  }
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("modal-backdrop")) closeModal(e.target.id);
    const c = e.target.closest("[data-close-modal]");
    if (c) closeModal(c.getAttribute("data-close-modal"));
  });
  document.addEventListener("keydown", (e) => {
    const modal = $$(".modal-backdrop.open").pop();
    if (!modal) return;
    if (e.key === "Escape") { e.preventDefault(); closeModal(modal.id); return; }
    if (e.key !== "Tab") return;
    const focusable = $$("a[href],button,input,select,textarea,[tabindex]", modal)
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!first) { e.preventDefault(); return; }
    if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  });

  /* --------------------------- product data --------------------------- */
  /* data.js is loaded before app.js on every page, so the catalog has
     exactly one source of truth. */
  const products = () => (global.PNC_DB && global.PNC_DB.PRODUCTS) || [];
  const productById = (id) => products().find(p => p.id === id);
  function readCart() {
    const stored = read(cartKey(), []);
    if (!Array.isArray(stored)) return [];
    const lines = new Map();
    for (const line of stored) {
      if (!line || !productById(line.id) || !Number.isSafeInteger(line.qty) || line.qty <= 0) continue;
      lines.set(line.id, { id: line.id, qty: Math.min(999, (lines.get(line.id)?.qty || 0) + line.qty) });
    }
    return Array.from(lines.values());
  }
  /* ------------------------------ cart -------------------------------- */
  const Cart = {
    items: readCart(),

    rebind() {
      this.items = readCart();
      if (global.PNC_DB?.catalogReady && !global.PNC_DB.catalogReady()) this.items = [];
      this.render();
    },

    save() { write(cartKey(), this.items); this.render(); },

    add(id, qty = 1) {
      const p = productById(id);
      if (!p) return;
      const D = global.PNC_DB;
      if (D?.catalogReady && !D.catalogReady()) { toast("Ask the store for confirmed prices before adding items.", "err"); return; }
      const serverProduct = D && D.db && D.db.products ? D.db.products.find(x => x.id === id) : null;
      const stock = serverProduct ? Number(serverProduct.stock) : Infinity;
      const line = this.items.find((i) => i.id === id);
      const current = line ? Number(line.qty) : 0;
      const next = Math.min(stock, current + Math.max(1, Number(qty) || 1));
      if (!Number.isFinite(next) || next <= current) { toast("That item is sold out or at its stock limit", "err"); return; }
      if (line) line.qty = next; else this.items.push({ id, qty: next });
      this.save();
      toast(p.name + " added to cart");
    },

    setQty(id, qty) {
      const line = this.items.find((i) => i.id === id);
      if (!line) return;
      const D = global.PNC_DB;
      const p = D && D.db && D.db.products ? D.db.products.find(x => x.id === id) : null;
      const stock = p ? Number(p.stock) : Infinity;
      const clean = Number.isInteger(Number(qty)) ? Number(qty) : 0;
      line.qty = Math.max(0, Math.min(stock, clean));
      if (line.qty === 0) this.items = this.items.filter((i) => i.id !== id);
      this.save();
    },

    remove(id) {
      this.items = this.items.filter((i) => i.id !== id);
      this.save();
      toast("Item removed from cart");
    },

    clear() { this.items = []; this.save(); },

    get count() { return this.items.reduce((n, i) => n + i.qty, 0); },
    get subtotal() { return this.items.reduce((n, i) => n + (productById(i.id) ? productById(i.id).price * i.qty : 0), 0); },
    /* Members get their plan discount at checkout (see PNC_DB.placeOrder).
       Rates live in data.js so the data layer stays the source of truth. */
    get discountRate() {
      const D = global.PNC_DB;
      if (!D || !D.currentOwner) return 0;
      const o = D.currentOwner();
      return o ? (D.PLAN_DISCOUNT[o.plan] || 0) : 0;
    },
    get total() { return Math.round(this.subtotal * (1 - this.discountRate) * 100) / 100; },

    render() {
      const badge = $("#cartCount");
      if (badge) { badge.textContent = this.count; badge.dataset.empty = String(this.count === 0); }
      const drawer = $("#cartDrawer");
      if (!drawer) return;
      const body = $("#cartBody");
      if (!body) return;
      drawer.hidden = !this.items.length;

      if (!this.items.length) {
        body.innerHTML =
          '<div class="cart-empty">' +
            '<div class="cart-empty-ico">🛒</div>' +
            '<h3>Your cart is empty</h3>' +
            '<p>Time to treat your best friend.</p>' +
            '<a class="btn btn-teal" href="shop.html">Browse the shop</a>' +
          "</div>";
      } else {
        body.innerHTML = this.items.map((i) => {
          const p = productById(i.id);
          if (!p) return '';
          return (
            '<div class="cart-line">' +
              '<div class="cart-thumb">' + (global.PNC_DB.icon ? global.PNC_DB.icon(p.icon) : esc(p.icon)) + "</div>" +
              '<div class="cart-line-main">' +
                '<h4>' + esc(p.name) + "</h4>" +
                '<span class="cart-line-price">' + money(p.price) + " each</span>" +
                '<div class="qty">' +
                  '<button data-dec="' + p.id + '" aria-label="Decrease quantity">−</button>' +
                  "<span>" + i.qty + "</span>" +
                  '<button data-inc="' + p.id + '" aria-label="Increase quantity">+</button>' +
                "</div>" +
              "</div>" +
              '<div class="cart-line-total">' + money(p.price * i.qty) + "</div>" +
              '<button class="cart-line-x" data-rm="' + p.id + '" aria-label="Remove ' + esc(p.name) + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
              "</button>" +
            "</div>"
          );
        }).join("");
      }

      const totalEl = $("#cartTotal");
      if (totalEl) totalEl.textContent = money(this.total);
      const checkoutBtn = $("#cartCheckout");
      if (checkoutBtn) {
        const unavailable = !!(window.PNC_DB && PNC_DB.productionMode && PNC_DB.productionMode());
        checkoutBtn.disabled = !this.items.length || unavailable;
        if (unavailable) checkoutBtn.textContent = "Online checkout unavailable";
      }

      /* Show the member discount as its own line so the total is
         not a surprise at checkout. */
      const dl = $("#cartDiscount");
      if (dl) {
        const rate = window.PNC_DB && PNC_DB.productionMode && PNC_DB.productionMode() ? 0 : this.discountRate;
        dl.hidden = !rate;
        if (rate) {
          dl.innerHTML = '<span>Member discount (' + Math.round(rate * 100) + '%)</span>' +
            '<b style="color:var(--ok)">&minus;' + money(Math.round(this.subtotal * rate * 100) / 100) + "</b>";
        }
      }
      const st = $("#cartSubtotal");
      if (st) {
        const rate = window.PNC_DB && PNC_DB.productionMode && PNC_DB.productionMode() ? 0 : this.discountRate;
        st.hidden = !rate;
        if (rate) st.innerHTML = '<span>Subtotal</span><b>' + money(this.subtotal) + "</b>";
      }
    }
  };

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add && !add.disabled) { Cart.add(add.dataset.add); return; }
    const inc = e.target.closest("[data-inc]");
    if (inc) { const l = Cart.items.find((i) => i.id === inc.dataset.inc); if (l) Cart.setQty(l.id, l.qty + 1); return; }
    const dec = e.target.closest("[data-dec]");
    if (dec) { const l = Cart.items.find((i) => i.id === dec.dataset.dec); if (l) Cart.setQty(l.id, l.qty - 1); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { Cart.remove(rm.dataset.rm); return; }
  });

  /* ---------------------------- membership ---------------------------- */
  const PLANS = {
    puppy: { id: "puppy", name: "Puppy Pass", price: 0, period: "forever", badge: "Free" },
    adult: { id: "adult", name: "Adult Adventurer", price: 9, period: "per month", badge: "Popular" },
    senior: { id: "senior", name: "Senior Snuggler", price: 19, period: "per month", badge: "Best value" }
  };


  /* ---------------------------- page chrome --------------------------- */
  function mountChrome() {
    const header = $(".site-header");
    const onScroll = () => { if (header) header.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const burger = $(".burger");
    if (burger) burger.addEventListener("click", () => document.body.classList.toggle("menu-open"));
    $$(".nav-links a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));

    const cartBtn = $("#cartBtn");
    if (cartBtn) cartBtn.addEventListener("click", () => openModal("cartModal"));

    Cart.render();
  }

  function mountCartDrawer() {
    /* Checkout is owned by shop.js so there is exactly one handler. */
  }

  function mountPasswordStrength() {
    /* Password reveal toggles and the strength meter back the
       signup forms on membership.html and index.html. */
    $$(".pw-toggle").forEach((t) => t.addEventListener("click", () => {
      const input = t.parentElement.querySelector(".input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      t.innerHTML = show ? ICON_EYE_OFF : ICON_EYE;
      t.setAttribute("aria-label", show ? "Hide password" : "Show password");
    }));
    $$("[data-pw]").forEach((input) => input.addEventListener("input", () => {
      const meter = input.form.querySelector(".pw-meter i");
      if (!meter) return;
      const v = input.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      const widths = ["0%", "28%", "52%", "76%", "100%"];
      const colors = ["var(--danger)", "var(--danger)", "var(--yellow)", "var(--ocean-300)", "var(--ok)"];
      meter.style.width = widths[score];
      meter.style.background = colors[score];
    }));
  }

  const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3M6.6 6.6A18 18 0 0 0 2 11s3.6 7 10 7a10.9 10.9 0 0 0 4.3-.9M3 3l18 18"/></svg>';

  function mountReveal() {
    const els = $$(".reveal");
    if (!els.length) return;
    if ("IntersectionObserver" in global) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      }), { threshold: 0.12, rootMargin: "0px 0px -40px" });
      els.forEach((el, i) => { el.style.transitionDelay = Math.min(i % 6, 5) * 70 + "ms"; io.observe(el); });
    } else els.forEach((el) => el.classList.add("in"));
  }

  window.addEventListener("pnc:auth", () => Cart.rebind());
  window.addEventListener("pnc:clerk", () => Cart.rebind());
  window.addEventListener("pnc:data-ready", () => Cart.rebind());

  document.addEventListener("DOMContentLoaded", () => {
    // Initialize the data facade before page listeners receive pnc:ready.
    // Some pages read the current member while rendering their first view.
    if (window.PNC_DB && typeof PNC_DB.load === "function") PNC_DB.load();
    mountChrome();
    mountCartDrawer();
    mountPasswordStrength();
    mountReveal();
    // Page controllers insert cards during their DOMContentLoaded listeners.
    setTimeout(mountReveal, 0);
    document.dispatchEvent(new CustomEvent("pnc:ready"));
  });

  /* ------------------------------- API -------------------------------- */
  global.PNC = { Cart, PLANS, get PRODUCTS() { return products(); }, get PRODUCT_BY_ID() { return Object.fromEntries(products().map(p => [p.id, p])); }, money, esc, toast, openModal, closeModal, isValidEmail, $, $$ };
})(window);
