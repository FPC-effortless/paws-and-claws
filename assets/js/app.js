/* ============================================================
   Paws & Claws — Core application logic
   Vanilla JS. No dependencies. Uses localStorage for
   cart + membership state. Safe on GitHub Pages.
   ============================================================ */

(function (global) {
  "use strict";

  const STORE_KEYS = { cart: "pnc_cart", member: "pnc_member", users: "pnc_users" };
  const CURRENCY = "$";

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
    el.className = "toast" + (type === "err" ? " err" : "");
    el.innerHTML = (type === "err" ? ICON_ERR : ICON_OK) + "<span>" + esc(msg) + "</span>";
    stack.appendChild(el);
    setTimeout(() => { el.style.transition = "opacity .3s, transform .3s"; el.style.opacity = "0"; el.style.transform = "translateY(10px)"; setTimeout(() => el.remove(), 320); }, 3400);
  }

  /* ----------------------------- modals ------------------------------- */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    const f = m.querySelector("input,select,textarea,button");
    if (f) setTimeout(() => f.focus(), 120);
  }
  function closeModal(id) {
    const m = id ? document.getElementById(id) : $(".modal-backdrop.open");
    if (!m) return;
    m.classList.remove("open");
    if (!$(".modal-backdrop.open")) document.body.style.overflow = "";
  }
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("modal-backdrop")) closeModal();
    const c = e.target.closest("[data-close-modal]");
    if (c) closeModal(c.getAttribute("data-close-modal"));
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /* --------------------------- product data --------------------------- */
  const PRODUCTS = [
    { id: "p1", name: "Salmon & Sweet Potato Kibble", cat: "Food", price: 24.99, badge: "Bestseller", rating: 4.9, icon: "🦴", desc: "Grain-free, wild-caught salmon recipe for dogs of all sizes. 5 lb bag.", tag: "food" },
    { id: "p2", name: "Feather Wand Cat Teaser", cat: "Toys", price: 8.49, badge: "", rating: 4.7, icon: "🪶", desc: "Hand-wand teaser with natural feathers and a jingle bell. Cats go wild.", tag: "toy" },
    { id: "p3", name: "Cozy Donut Pet Bed", cat: "Beds", price: 39.00, badge: "New", rating: 4.8, icon: "🛏️", desc: "Orthopedic memory-foam donut bed with a machine-washable cover.", tag: "bed" },
    { id: "p4", name: "Aloe Oatmeal Pet Shampoo", cat: "Grooming", price: 12.95, badge: "Eco", rating: 4.6, icon: "🧴", desc: "Soothing, tear-free formula for sensitive skin. 16 oz, pH balanced.", tag: "groom" },
    { id: "p5", name: "No-Pull Padded Harness", cat: "Walking", price: 27.50, badge: "", rating: 4.8, icon: "🦮", desc: "Front-clip reflective harness in 4 sizes. chest 18–34 in.", tag: "walk" },
    { id: "p6", name: "Dental Chew Trio Pack", cat: "Treats", price: 15.75, badge: "", rating: 4.5, icon: "🦷", desc: "Three textures of vet-approved dental sticks. Fresh breath in a week.", tag: "food" },
    { id: "p7", name: "Tough Rope Tug", cat: "Toys", price: 11.20, badge: "", rating: 4.4, icon: "🪢", desc: "Knotted cotton-blend rope for heavy chewers and tug-of-war champs.", tag: "toy" },
    { id: "p8", name: "Stainless Slow Feeder Bowl", cat: "Feeding", price: 18.90, badge: "", rating: 4.7, icon: "🥣", desc: "Non-slip stainless bowl with a maze insert to slow fast eaters.", tag: "feed" },
    { id: "p9", name: "Cat Scratching Post Tower", cat: "Furniture", price: 64.00, badge: "New", rating: 4.9, icon: "🏰", desc: "Multi-level tower with sisal posts and a lookout platform. 32 in.", tag: "furniture" },
    { id: "p10", name: "Grain-Free Puppy Pâté", cat: "Food", price: 21.40, badge: "", rating: 4.6, icon: "🥫", desc: "Wet pâté packed with chicken and pumpkin. 12 × 12.5 oz cans.", tag: "food" },
    { id: "p11", name: "Retractable LED Leash", cat: "Walking", price: 22.99, badge: "", rating: 4.5, icon: "🔦", desc: "16 ft retractable leash with an LED handle for night walks.", tag: "walk" },
    { id: "p12", name: "De-Shedding Grooming Glove", cat: "Grooming", price: 9.99, badge: "Eco", rating: 4.3, icon: "🧤", desc: "Silicone glove that gently lifts loose fur. One size fits all.", tag: "groom" }
  ];

  const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  /* ------------------------------ cart -------------------------------- */
  const Cart = {
    items: read(STORE_KEYS.cart, []),

    save() { write(STORE_KEYS.cart, this.items); this.render(); },

    add(id, qty = 1) {
      const p = PRODUCT_BY_ID[id];
      if (!p) return;
      const line = this.items.find((i) => i.id === id);
      if (line) line.qty += qty; else this.items.push({ id, qty });
      this.save();
      toast(p.name + " added to cart");
    },

    setQty(id, qty) {
      const line = this.items.find((i) => i.id === id);
      if (!line) return;
      line.qty = Math.max(0, qty);
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
    get subtotal() { return this.items.reduce((n, i) => n + (PRODUCT_BY_ID[i.id] ? PRODUCT_BY_ID[i.id].price * i.qty : 0), 0); },

    render() {
      const badge = $("#cartCount");
      if (badge) { badge.textContent = this.count; badge.dataset.empty = String(this.count === 0); }
      const drawer = $("#cartDrawer");
      if (!drawer) return;
      const body = $("#cartBody");
      if (!body) return;

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
          const p = PRODUCT_BY_ID[i.id];
          return (
            '<div class="cart-line">' +
              '<div class="cart-thumb">' + p.icon + "</div>" +
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
      if (totalEl) totalEl.textContent = money(this.subtotal);
      const checkoutBtn = $("#cartCheckout");
      if (checkoutBtn) checkoutBtn.disabled = !this.items.length;
    }
  };

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { Cart.add(add.dataset.add); return; }
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

  const Auth = {
    member: read(STORE_KEYS.member, null),
    users: read(STORE_KEYS.users, {}),

    save() {
      write(STORE_KEYS.member, this.member);
      write(STORE_KEYS.users, this.users);
      this.render();
    },

    /** Fake "hash" — a demo-only scramble. NOT real security. */
    hash(s) {
      let h = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      return "h" + h.toString(16).padStart(8, "0") + ":" + s.length;
    },

    signup(form) {
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim().toLowerCase();
      const pw = String(fd.get("password") || "");
      const petName = String(fd.get("petName") || "").trim();
      const petType = String(fd.get("petType") || "");
      const plan = PLANS[String(fd.get("plan") || "puppy")] || PLANS.puppy;
      const agreed = fd.get("agree");

      let ok = true;
      const fail = (inputName, msgEl, msg) => {
        const input = form.querySelector('[name="' + inputName + '"]');
        const err = form.querySelector('[data-err="' + inputName + '"]') || form.querySelector('[data-err]');
        if (input) input.setAttribute("aria-invalid", "true");
        if (err) err.textContent = msg;
        ok = false;
      };
      ["name", "email", "password", "petName"].forEach((n) => {
        const input = form.querySelector('[name="' + n + '"]');
        if (input) input.removeAttribute("aria-invalid");
      });
      $$("[data-err]", form).forEach((el) => (el.textContent = ""));

      if (name.length < 2) fail("name", null, "Please tell us your name.");
      if (!isValidEmail(email)) fail("email", null, "Enter a valid email address.");
      if (pw.length < 8) fail("password", null, "Password must be at least 8 characters.");
      if (!petName) fail("petName", null, "Your pet's name, please!");
      if (!agreed) { toast("Please accept the terms to continue", "err"); ok = false; }
      if (!ok) { toast("Please fix the highlighted fields", "err"); return null; }

      if (Object.prototype.hasOwnProperty.call(this.users, email)) {
        fail("email", null, "An account with this email already exists. Try logging in.");
        toast("Email already registered", "err");
        return null;
      }

      this.users[email] = { name, email, hash: this.hash(pw), petName, petType, plan: plan.id, joined: new Date().toISOString() };
      this.member = { email, plan: plan.id, since: new Date().toISOString() };
      this.save();
      toast("Welcome to the pack, " + name.split(" ")[0] + "! 🐾");
      return this.member;
    },

    login(form) {
      const fd = new FormData(form);
      const email = String(fd.get("email") || "").trim().toLowerCase();
      const pw = String(fd.get("password") || "");
      $$("[data-err]", form).forEach((el) => (el.textContent = ""));
      const input = form.querySelector('[name="email"]');
      if (input) input.removeAttribute("aria-invalid");

      const rec = this.users[email];
      if (!rec || rec.hash !== this.hash(pw)) {
        if (input) input.setAttribute("aria-invalid", "true");
        const err = form.querySelector('[data-err]') || form.querySelector('[data-err="email"]');
        if (err) err.textContent = "Incorrect email or password.";
        toast("Incorrect email or password", "err");
        return null;
      }
      this.member = { email, plan: rec.plan, since: new Date().toISOString() };
      this.save();
      toast("Welcome back, " + rec.name.split(" ")[0] + "! 🐾");
      return this.member;
    },

    logout() {
      this.member = null;
      write(STORE_KEYS.member, null);
      this.render();
      toast("You've been signed out");
    },

    current() {
      if (!this.member) return null;
      const rec = this.users[this.member.email];
      return rec ? Object.assign({}, rec, { planObj: PLANS[rec.plan] || PLANS.puppy }) : null;
    },

    changePlan(planId) {
      const rec = this.users[this.member && this.member.email];
      if (!rec || !PLANS[planId]) { toast("Sign in to change your plan", "err"); return false; }
      rec.plan = planId;
      this.member.plan = planId;
      this.save();
      toast("Switched to " + PLANS[planId].name);
      return true;
    },

    render() {
      const u = this.current();
      const chipZone = $("#memberZone");
      const greet = $("#navGreet");
      if (greet) greet.textContent = u ? "Hi, " + u.name.split(" ")[0] : "Membership";

      if (chipZone) {
        if (u) {
          chipZone.innerHTML =
            '<a class="member-chip" href="account.html" title="Your member dashboard">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/></svg>' +
              esc(u.planObj.name) +
            "</a>";
        } else {
          chipZone.innerHTML = '<a class="btn btn-teal" href="membership.html">Join now</a>';
        }
      }
      $$("[data-member-only]").forEach((el) => { el.hidden = !u; });
      $$("[data-guest-only]").forEach((el) => { el.hidden = !!u; });
      global.dispatchEvent(new CustomEvent("pnc:auth", { detail: u }));
    }
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
    Auth.render();
  }

  function mountCartDrawer() {
    const checkout = $("#cartCheckout");
    if (checkout) checkout.addEventListener("click", () => {
      if (!Cart.items.length) return;
      toast("Demo store — checkout isn't connected to a payment processor yet.");
    });
  }

  function mountAuthForms() {
    const su = $("#signupForm");
    if (su) su.addEventListener("submit", (e) => {
      e.preventDefault();
      const m = Auth.signup(su);
      if (m) { closeModal("signupModal"); window.location.href = "account.html"; }
    });

    const li = $("#loginForm");
    if (li) li.addEventListener("submit", (e) => {
      e.preventDefault();
      const m = Auth.login(li);
      if (m) { closeModal("loginModal"); if (/membership\.html|account\.html/.test(location.pathname)) location.reload(); }
    });

    $$("[data-logout]").forEach((b) => b.addEventListener("click", () => Auth.logout()));

    $$("[data-plan]").forEach((btn) => btn.addEventListener("click", () => {
      const planId = btn.dataset.plan;
      if (!Auth.current()) { toast("Create an account to choose this plan", "err"); openModal("signupModal"); return; }
      Auth.changePlan(planId);
    }));

    // password reveal + strength
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
      const colors = ["var(--danger)", "var(--danger)", "var(--gold)", "var(--teal-300)", "var(--ok)"];
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

  document.addEventListener("DOMContentLoaded", () => {
    mountChrome();
    mountCartDrawer();
    mountAuthForms();
    mountReveal();
    global.dispatchEvent(new CustomEvent("pnc:ready"));
  });

  /* ------------------------------- API -------------------------------- */
  global.PNC = { Cart, Auth, PLANS, PRODUCTS, PRODUCT_BY_ID, money, esc, toast, openModal, closeModal, isValidEmail, $, $$ };
})(window);
