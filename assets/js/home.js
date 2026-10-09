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
    const title = $("#heroTitle");
    if (title && cms.heroTitle) title.textContent = cms.heroTitle;
    const tagline = $(".hero-tagline");
    if (tagline && cms.tagline) tagline.textContent = cms.tagline;
    const lead = $("#heroLead");
    if (lead) lead.textContent = "Quality pet supplies, thoughtful grooming, daycare, vet support, training and a community of pet lovers — all in one place.";
    const bookingLink = $("#heroBookingLink");
    if (bookingLink) {
      bookingLink.href = D.catalogReady() ? 'services.html#book' : 'contact.html';
      bookingLink.innerHTML = 'Explore pet care <span aria-hidden="true">→</span>';
    }
    const services = $("#services");
    if (services) services.hidden = !D.catalogReady();
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
    const ready = D.catalogReady();
    const groups = D.SERVICE_GROUPS.map(function (g) {
      const svc = (D.SERVICES || []).filter(function (s) { return s.group === g.id; });
      const from = svc.length ? Math.min.apply(null, svc.map(function (s) { return s.price; })) : 0;
      return '<a class="home-service-card reveal" href="services.html#' + g.id + '">' +
        '<span class="cat-ico">' + D.icon(g.icon) + "</span>" +
        "<h3>" + esc(g.name) + "</h3>" +
        "<p>" + esc(g.blurb) + "</p>" +
        '<span class="home-card-action">' + (ready ? 'From ' + money(from) : 'Enquire') + " →</span>" +
        "</a>";
    });
    groups.push('<a class="home-service-card reveal" href="pets.html"><span class="cat-ico">&#128054;&#128049;</span><h3>Pet Connect</h3><p>Responsible pet listings and guided introductions.</p><span class="home-card-action">Meet the pets →</span></a>');
    groups.push('<a class="home-service-card reveal" href="shop.html"><span class="cat-ico">&#127918;</span><h3>Quality Supplies</h3><p>Food, toys and accessories chosen for everyday care.</p><span class="home-card-action">Visit the store →</span></a>');
    host.innerHTML = groups.join("");
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
    const section = $("#featured-pets");
    if (section) section.hidden = !D.catalogReady();
    if (!D.catalogReady()) return;
    const list = (D.db.listings || []).filter(function (l) { return l.status === "available"; }).slice(0, 3);
    if (!list.length) {
      host.innerHTML = '<div class="empty-card" style="grid-column:1/-1">' +
        '<span class="ico">&#128062;</span><b>No pets available right now</b>' +
        "<p>Contact the store to ask about current availability.</p></div>";
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
    if (!D.catalogReady()) {
      host.innerHTML = '<p>Product prices and availability are being confirmed. Ask our team before visiting.</p>';
      return;
    }
    const prods = (PNC && PNC.PRODUCTS ? PNC.PRODUCTS.slice() : []).slice(0, 4);
    host.innerHTML = prods.map(function (p) {
      const badge = p.badge ? '<span class="badge tag tag--yellow">' + esc(p.badge) + "</span>" : "";
      return '<div class="card product reveal in">' +
        '<div class="product-art">' + badge + D.icon(p.icon) +
        "</div>" +
        '<div class="product-body">' +
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

  /* -------------------------- interactive hero ----------------------- */
  function mountHeroScene() {
    const scene = $("[data-hero-scene]");
    const card = $("[data-hero-tilt]");
    if (!scene || !card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function reset() {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      $$("[data-depth]", card).forEach(function (layer) {
        layer.style.setProperty("--scene-x", "0px");
        layer.style.setProperty("--scene-y", "0px");
        layer.style.setProperty("--scene-z", layer.dataset.depth + "px");
      });
    }

    scene.addEventListener("pointermove", function (event) {
      const box = scene.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - .5;
      const y = (event.clientY - box.top) / box.height - .5;
      card.style.setProperty("--tilt-x", (y * -8).toFixed(2) + "deg");
      card.style.setProperty("--tilt-y", (x * 10).toFixed(2) + "deg");
      $$("[data-depth]", card).forEach(function (layer) {
        const depth = Number(layer.dataset.depth);
        layer.style.setProperty("--scene-x", (x * depth * .18).toFixed(1) + "px");
        layer.style.setProperty("--scene-y", (y * depth * .18).toFixed(1) + "px");
        layer.style.setProperty("--scene-z", depth + "px");
      });
    });
    scene.addEventListener("pointerleave", reset);
    reset();
  }

  /* ------------------------------- mount ------------------------------ */
  function start() {
    try { D.load(); } catch (e) { try { D.reset(); } catch (e2) {} }
    renderHero();
    renderGroups();
    renderListings();
    renderBestsellers();
    mountNewsletter();
    mountHeroScene();
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
