/* ============================================================
   Paws & Claws — Home page controller
   CMS-driven hero, service groups, featured listings,
   bestsellers and live stats. Vanilla JS, no deps.
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.PNC_DB;
  const PNC = window.PNC;

  function money(n) { return PNC ? PNC.money(n) : D.money(n); }
  function esc(s) { return PNC ? PNC.esc(s) : D.esc(s); }

  /* ------------------------------ hero ------------------------------- */
  function renderHero() {
    const cms = D.db.cms;
    if (!cms) return;
    const t = $("#heroTitle");
    if (t && cms.heroTitle) t.innerHTML = esc(cms.heroTitle);
    const lead = $("#heroLead");
    if (lead) lead.textContent = "Visit our physical store for pet supplies and care. Walk in to shop, speak with our team, or book an appointment online before your visit. No membership is required to shop in person.";
    const visit = $("#storeVisitDetails");
    if (visit) visit.textContent = [cms.address, cms.phone].filter(Boolean).join(" · ");

    const host = $("#heroStats");
    if (!host) return;
    host.innerHTML = [
      { b: "Visit", s: "Shop and pay in store" },
      { b: "Book", s: "Plan your next appointment" },
      { b: "Connect", s: "Manage pet care online" }
    ].map(function (x) {
      return "<div><b>" + x.b + "</b><span>" + x.s + "</span></div>";
    }).join("");
  }

  /* ---------------------------- service groups ------------------------ */
  function renderGroups() {
    const host = $("#groupGrid");
    if (!host) return;
    host.innerHTML = D.SERVICE_GROUPS.map(function (g) {
      const svc = (D.SERVICES || []).filter(function (s) { return s.group === g.id; });
      const from = svc.length ? Math.min.apply(null, svc.map(function (s) { return s.price; })) : 0;
      return '<a class="card cat-card reveal" href="services.html#' + g.id + '">' +
        '<span class="cat-ico">' + D.icon(g.icon) + "</span>" +
        "<h3>" + esc(g.name) + "</h3>" +
        "<p>" + esc(g.blurb) + "</p>" +
        '<span class="tag tag--yellow">From ' + money(from) + "</span>" +
        "</a>";
    }).join("");
  }

  /* ---------------------------- featured pets ------------------------- */
  function ageLabel(m) {
    if (m < 12) return m + (m === 1 ? " month" : " months");
    const y = Math.floor(m / 12), r = m % 12;
    return y + (y === 1 ? " yr" : " yrs") + (r ? " " + r + "mo" : "");
  }

  function renderListings() {
    const host = $("#featuredListings");
    if (!host) return;
    const list = (D.db.listings || []).filter(function (l) { return l.status === "available"; }).slice(0, 3);
    if (!list.length) {
      host.innerHTML = '<div class="empty-card" style="grid-column:1/-1">' +
        '<span class="ico">&#128062;</span><b>No pets available right now</b>' +
        "<p>New listings are vetted weekly. Check back soon or join the waitlist.</p></div>";
      return;
    }
    host.innerHTML = list.map(function (l) {
      return '<article class="pet-card">' +
        '<div class="pet-art">' +
          '<span class="pet-emoji" aria-hidden="true">' + D.icon(l.icon) + "</span>" +
          '<span class="pet-price">' + money(l.price) + "</span>" +
        "</div>" +
        '<div class="pet-body">' +
          "<h3>" + esc(l.name) + "</h3>" +
          '<p class="pet-breed">' + esc(l.breed) + "</p>" +
          '<div class="pet-meta">' +
            "<span>" + D.speciesIcon(l.species) + " " + esc(l.species) + "</span>" +
            "<span>" + ageLabel(l.ageMonths) + "</span>" +
            "<span>" + esc(l.sex) + "</span>" +
          "</div>" +
          '<p class="pet-bio">' + esc(l.bio || "") + "</p>" +
          '<a class="btn btn-primary btn-block" href="pets.html#pet-' + l.id + '">Meet ' + esc(l.name) + "</a>" +
        "</div>" +
      "</article>";
    }).join("");
  }

  /* ---------------------------- bestsellers --------------------------- */
  function renderBestsellers() {
    const host = $("#featuredGrid");
    if (!host) return;
    const prods = (PNC && PNC.PRODUCTS ? PNC.PRODUCTS.slice() : [])
      .sort(function (a, b) { return b.rating - a.rating; })
      .slice(0, 4);
    host.innerHTML = prods.map(function (p) {
      const badge = p.badge ? '<span class="badge tag tag--yellow">' + esc(p.badge) + "</span>" : "";
      return '<div class="card product reveal in">' +
        '<div class="product-art">' + badge + D.icon(p.icon) +
        "</div>" +
        '<div class="product-body">' +
          '<div class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;<small>(' + p.rating + ")</small></div>" +
          "<h3>" + esc(p.name) + "</h3>" +
          "<p>" + esc(p.desc) + "</p>" +
          '<div class="product-foot">' +
            '<span class="product-price">' + money(p.price) + "</span>" +
            '<button class="add-btn" data-add="' + p.id + '"' + (p.stock <= 0 ? ' disabled' : '') + '>' +
              '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Add' +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    }).join("");
  }

  /* ----------------------------- newsletter --------------------------- */
  function mountNewsletter() {
    const form = $("#newsletterForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const msg = $("#nl-msg");
      const email = $("#nl-email");
      const valid = PNC && PNC.isValidEmail ? PNC.isValidEmail(email.value) : D.isValidEmail(email.value);
      if (!valid) {
        msg.style.color = "var(--danger)";
        msg.textContent = "Please enter a valid email address.";
        return;
      }
      msg.style.color = "var(--ink-soft)";
      msg.textContent = "Newsletter signup is not available yet. Please contact the store for updates.";
    });
  }

  /* ------------------------------- mount ------------------------------ */
  function start() {
    try { D.load(); } catch (e) { try { D.reset(); } catch (e2) {} }
    renderHero();
    renderGroups();
    renderListings();
    renderBestsellers();
    mountNewsletter();
    window.addEventListener("pnc:data-ready", function () {
      renderHero(); renderGroups(); renderListings(); renderBestsellers();
      $$(".reveal").forEach(el => el.classList.add("in"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
