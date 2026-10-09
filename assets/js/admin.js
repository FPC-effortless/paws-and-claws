/* ============================================================
   Paws & Claws — Admin Control Panel
   ERP/CRM console with role-based access control.
   Modules: Dashboard, Bookings+Calendar, CRM, POS+Orders,
   Inventory+Listings, CMS+Services+Staff+Roles+Audit.
   Vanilla JS, no deps. Loaded after app.js + data.js.
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.PNC_DB;
  const PNC = window.PNC;

  const esc = (s) => (PNC ? PNC.esc(s) : D.esc(s));
  const money = (n) => (PNC ? PNC.money(n) : D.money(n));

  const STAGES = (D.STAGES || ["pending", "packing", "ready", "shipped", "done", "cancelled"]).filter(function (x) { return x !== "cancelled"; });

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    bookings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    crm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3 3 0 0 1 0 5.9M18 20a6.4 6.4 0 0 0-2-4.6"/></svg>',
    pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="15" rx="2"/><path d="M3 9h18M8 14h3"/></svg>',
    inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    cms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16M6 17l9-9 3 3-9 9H6v-3Z"/></svg>'
  };

  const SECTIONS = [
    { id: "dashboard", label: "Dashboard", icon: ICONS.dashboard, perm: null },
    { id: "bookings", label: "Bookings", icon: ICONS.bookings, perm: "bookings.view" },
    { id: "crm", label: "Customers", icon: ICONS.crm, perm: "crm.view" },
    { id: "pos", label: "POS & Orders", icon: ICONS.pos, perm: "payments.take" },
    { id: "inventory", label: "Inventory", icon: ICONS.inventory, perm: "inventory.edit" },
    { id: "cms", label: "Site & Staff", icon: ICONS.cms, perm: "cms.edit" }
  ];

  const BK_STATUSES = ["pending", "confirmed", "completed", "cancelled"];
  const LST_STATUSES = ["available", "reserved", "sold"];

  /* ============================ helpers ============================ */
  function admin() { return D.currentAdmin(); }
  function allowed(perm) { return D.can(perm); }
  function scopeOf(perm) { return D.scopeOf(perm); }

  function providerName(id) {
    const p = D.PROVIDER_BY_ID ? D.PROVIDER_BY_ID[id] : null;
    return p ? p.name : (id || "—");
  }
  function ownerOfId(id) { return D.byId(D.db.owners, id); }
  function petOfId(id) { return D.byId(D.db.pets, id); }
  function svcOfId(id) { return D.byId(D.db.services, id) || D.SERVICE_BY_ID[id] || { name: id }; }

  function pill(text, cls) {
    return '<span class="mini-btn ' + (cls || "") + '" style="cursor:default">' + esc(text) + "</span>";
  }

  function emptyState(icon, title, sub) {
    return '<div class="kan-empty" style="padding:26px 10px">' +
      '<div style="font-size:1.6rem">' + icon + "</div>" +
      "<b>" + esc(title) + "</b>" +
      (sub ? "<p style='margin:4px 0 0'>" + esc(sub) + "</p>" : "") +
      "</div>";
  }

  function toast(msg, kind) { if (PNC) PNC.toast(msg, kind); }

  /* ============================== nav ============================== */
  function visibleSections() {
    const a = admin();
    if (!a) return [];
    if (a.role === "super") return SECTIONS.slice();
    return SECTIONS.filter(function (s) {
      if (!s.perm) return true;
      const v = (D.PERMS[a.role] || {})[s.perm];
      return v === true || v === "own";
    });
  }

  function renderNav() {
    const host = $("#sideNav");
    if (!host) return;
    const secs = visibleSections();
    host.innerHTML = secs.map(function (s) {
      return '<button type="button" data-section="' + s.id + '"' +
        (s.id === state.section ? ' class="active" aria-current="page"' : "") + ">" +
        s.icon + "<span>" + s.label + "</span></button>";
    }).join("");
    $$("[data-section]", host).forEach(function (b) {
      b.addEventListener("click", function () { go(b.dataset.section); });
    });
  }

  function go(id) {
    if (!visibleSections().some(s => s.id === id)) id = "dashboard";
    state.section = id;
    setSidebar(false);
    $$(".admin-view").forEach(function (v) { v.classList.toggle("active", v.id === "view-" + id); });
    $$("[data-section]").forEach(function (b) {
      const active = b.dataset.section === id;
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    render();
    const sc = $("#adminScroll");
    if (sc) sc.scrollTop = 0;
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
  }

  function setSidebar(open) {
    const side = $("#adminSide");
    const toggle = $("#sideToggle");
    const backdrop = $("#sideBackdrop");
    if (!side || !toggle || !backdrop) return;
    const wasOpen = side.classList.contains("open");
    open = !!open && window.innerWidth <= 900;
    side.classList.toggle("open", open);
    side.inert = window.innerWidth <= 900 && !open;
    side.setAttribute("aria-hidden", String(window.innerWidth <= 900 && !open));
    backdrop.hidden = !open;
    document.body.classList.toggle("admin-nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close admin menu" : "Open admin menu");
    if (open) $("#sideClose").focus();
    else if (wasOpen && side.contains(document.activeElement)) toggle.focus();
  }

  function renderTopbar() {
    const a = admin();
    const host = $("#adUser");
    if (!host || !a) return;
    host.innerHTML = '<span class="role-chip">' + esc(a.roleObj.name) + "</span>" +
      '<div class="who">' +
        '<span class="av">' + esc(D.initials(a.name)) + "</span>" +
        "<span><b style='display:block;font-size:.86rem'>" + esc(a.name) + "</b>" +
        "<small style='color:var(--ink-soft)'>" + esc(a.email) + "</small></span>" +
      "</div>";
  }

    /* ========================= login gate ============================ */
  function renderCreds() {
    const host = $("#credGrid");
    if (!host) return;
    if (D.productionMode && D.productionMode()) {
      host.innerHTML = '<div class="warn-card bad"><div><b>Demo credentials are disabled on hosted deployments.</b><p>Configure Clerk to enable staff sign-in.</p></div></div>';
      return;
    }
    const rows = [
      { r: "super", e: "owner@pawsandclaws.example", p: "admin123", n: "Avery Stone" },
      { r: "desk", e: "front@pawsandclaws.example", p: "desk123", n: "Jordan Pike" },
      { r: "provider", e: "rosa@pawsandclaws.example", p: "rosa123", n: "Rosa Delgado" },
      { r: "retail", e: "retail@pawsandclaws.example", p: "retail123", n: "Sam Okafor" }
    ];
    /* Never render the password into the DOM — it lives only in the
       dataset of the button, which fills the form on click. The
       visible text is the role + name + email only. */
    host.innerHTML = rows.map(function (x) {
      return '<button type="button" class="cred" data-crede="' + esc(x.e) + '" data-credp="' + esc(x.p) + '">' +
        "<b>" + esc(D.ADMIN_ROLES[x.r].name) + "</b>" +
        "<span>" + esc(x.n) + "</span>" +
        "<code>" + esc(x.e) + "</code>" +
        "<code>Click to fill password</code></button>";
    }).join("");
    $$("[data-crede]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        $("#ad-email").value = b.dataset.crede;
        $("#ad-pw").value = b.dataset.credp;
        $("#ad-pw").focus();
      });
    });
  }

  function mountLogin() {
    const form = $("#adminLoginForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      $$("[data-err]", form).forEach(function (el) { el.textContent = ""; });
      const res = D.adminLogin(fd.get("email"), fd.get("password"));
      const msg = $("#ad-msg");
      if (res.error) {
        const err = form.querySelector('[data-err="email"]');
        if (err) err.textContent = res.error;
        msg.style.color = "var(--danger)";
        msg.textContent = res.error;
        toast(res.error, "err");
        return;
      }
      msg.textContent = "";
      enter();
      toast("Welcome back, " + res.admin.name.split(" ")[0]);
    });
  }

  /* ------------------------- Clerk gate ------------------------- */
  /* In Clerk mode the staff gate is Clerk's <SignIn/>. This is
     REPLACE mode: without a publishable key the site runs in DEMO
     MODE and the local credential cards stay available. */
  function mountClerkGate() {
    const host = $("#clerkAdmin");
    if (!host) return;
    const ck = window.PNC_CLERK;
    if (!ck || !ck.active) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const holder = $("#clerkAdminHolder");
    const local = $("#adminLoginForm");
    if (local) local.hidden = true;
    const demo = document.querySelector(".demo-creds");
    if (demo) demo.hidden = true;

    const showSwitchAccount = function () {
      if (!holder) return;
      const email = ck.currentOwner && ck.currentOwner() ? ck.currentOwner().email : "your current account";
      holder.innerHTML = '<div class="admin-session-note" role="status">' +
        "You are signed in as <b>" + esc(email) + "</b>, which is not an admin account." +
        '<button type="button" class="btn btn-primary btn-block" id="adminSwitchAccount">Switch to an admin account</button>' +
        "</div>";
      const switchBtn = $("#adminSwitchAccount", holder);
      if (switchBtn) switchBtn.addEventListener("click", async function () {
        switchBtn.disabled = true;
        try {
          await ck.signOut();
          holder.innerHTML = "";
          mountClerkGate();
        } finally { switchBtn.disabled = false; }
      });
    };

    /* Never mount SignIn over an existing Clerk session. Doing so makes
       Clerk complete a second sign-in flow and redirect to the homepage.
       Admin sessions enter directly; member sessions get a clear switch
       action that signs out before mounting the admin sign-in UI. */
    if (ck.clerk && ck.clerk.user) {
      if (D.currentAdmin()) { enter(); return; }
      showSwitchAccount();
    } else if (holder) {
      ck.mountSignIn(holder, {
        appearance: { elements: { rootBox: "width:100%" } },
        signIn: { redirectUrl: new URL("/admin", location.origin).toString() }
      });
    }
    /* Clerk mounted the real UI, so the gate is satisfied by the
       Clerk session alone. Re-check on every Clerk state change. */
    if (window.PNC_CLERK._unsubAdmin) try { window.PNC_CLERK._unsubAdmin(); } catch {}
    if (ck.clerk && ck.clerk.addListener) {
      window.PNC_CLERK._unsubAdmin = ck.clerk.addListener(function () {
        if (D.currentAdmin()) enter();
      });
    }
  }

  function enter() {
    const a = admin();
    if (!a) return;
    $("#adminGate").hidden = true;
    $("#adminShell").hidden = false;
    document.body.classList.remove("admin-body");
    renderNav();
    renderTopbar();
    go(state.section);
  }

  async function leave() {
    await D.adminLogout();
    $("#adminShell").hidden = true;
    $("#adminGate").hidden = false;
    document.body.classList.add("admin-body");
    $("#ad-msg").textContent = "";
    toast("Signed out of the control panel");
  }

  /* =========================== dashboard =========================== */
  function renderDashboard() {
    const st = D.stats();
    const host = $("#kpiRow");
    if (!host) return;

    host.innerHTML = [
      { l: "Revenue", v: money(st.revenue), s: money(st.revenueServices) + " services · " + money(st.revenueRetail) + " retail" },
      { l: "Bookings today", v: st.bookingsToday, s: st.upcomingCount + " upcoming total" },
      { l: "Customers", v: st.owners, s: st.pets + " pets on file" },
      { l: "Open orders", v: st.pendingCount, s: st.lowStockCount + " products low on stock" },
      { l: "Vaccines to review", v: st.pendingVaccineUploads, s: "pending staff approval" },
      { l: "Waitlist", v: st.waitlistCount, s: st.availableListings + " pets listed for adoption" }
    ].map(function (k) {
      return '<div class="stat-box' + (Number(k.v) > 0 && /Vaccines|Open orders/.test(k.l) ? " alert" : "") + '">' +
        '<div class="lbl">' + esc(k.l) + "</div>" +
        '<div class="val">' + esc(String(k.v)) + "</div>" +
        '<div class="sub">' + esc(k.s) + "</div></div>";
    }).join("");

    /* upcoming bookings */
    const up = D.upcoming().slice(0, 6);
    const bh = $("#dashBookings");
    if (bh) {
      bh.innerHTML = up.length ? up.map(function (b) {
        const pet = petOfId(b.petId) || {};
        return '<div class="kan-card">' +
          '<div class="row"><b>' + esc(svcOfId(b.serviceId).name) + "</b>" + pill(b.status) + "</div>" +
          "<p>" + D.fmtDT(b.date, b.hour) + " · " + esc(providerName(b.providerId)) + "</p>" +
          "<p style='margin-top:3px'>" + esc(pet.petName || "—") + " · " + esc((ownerOfId(b.ownerId) || {}).fullName || "—") + "</p>" +
        "</div>";
      }).join("") : emptyState("&#128197;", "No upcoming appointments", "New bookings appear here.");
    }

    /* alerts */
    const al = [];
    st.lowStock.forEach(function (p) {
      al.push({ ico: "&#128230;", t: p.name + " is low on stock", s: p.stock + " left · reorder at " + p.lowAt, go: "inventory" });
    });
    st.pendingOrders.forEach(function (o) {
      al.push({ ico: "&#128722;", t: "Order " + o.id + " needs fulfillment", s: "Stage: " + o.stage, go: "pos" });
    });
    if (st.pendingVaccineUploads) {
      al.push({ ico: "&#128138;", t: st.pendingVaccineUploads + " vaccine record(s) pending", s: "Approve them to unlock grooming and boarding", go: "crm" });
    }
    if (st.unreadMessages) {
      al.push({ ico: "&#9993;", t: st.unreadMessages + " unread customer message(s)", s: "Reply from the CRM", go: "crm" });
    }
    if (st.waitlistCount) {
      al.push({ ico: "&#128276;", t: st.waitlistCount + " customer(s) on the waitlist", s: "Offer an open slot", go: "bookings" });
    }
    const ah = $("#dashAlerts");
    if (ah) {
      ah.innerHTML = al.length ? al.slice(0, 6).map(function (x) {
        return '<button class="kan-card" style="width:100%;text-align:left;cursor:pointer" data-goto="' + x.go + '">' +
          "<b>" + x.ico + " " + esc(x.t) + "</b>" +
          "<p style='margin:3px 0 0'>" + esc(x.s) + "</p></button>";
      }).join("") : emptyState("&#9989;", "All clear", "Nothing needs your attention right now.");
    }

    /* revenue breakdown */
    const rh = $("#dashRevenue");
    if (rh) {
      const max = Math.max(st.revenueServices, st.revenueRetail, 1);
      rh.innerHTML = '<div class="rev-row"><span>Services</span><div class="rev-bar"><i style="width:' +
        Math.round(st.revenueServices / max * 100) + '%"></i></div><b>' + money(st.revenueServices) + "</b></div>" +
        '<div class="rev-row"><span>Retail</span><div class="rev-bar"><i style="width:' +
        Math.round(st.revenueRetail / max * 100) + '%"></i></div><b>' + money(st.revenueRetail) + "</b></div>";
      const note = $("#revNote");
      if (note) note.textContent = "Lifetime booked + paid";
    }

    /* audit */
    const au = $("#dashAudit");
    if (au) {
      const log = (D.db.audit || []).slice(0, 8);
      au.innerHTML = log.length ? log.map(function (a) {
        return '<div class="kan-card"><b>' + esc(a.action) + "</b>" +
          "<p>" + esc(a.detail) + "</p>" +
          "<p style='margin-top:3px;color:var(--ink-soft)'>" + esc(a.adminEmail) + " · " + D.fmtDate(a.at) + "</p></div>";
      }).join("") : emptyState("&#128221;", "No activity yet", "Staff actions are logged here.");
    }
  }

  /* ============================ bookings =========================== */
  function bookingRows() {
    let list = D.db.bookings.slice().sort(function (a, b) {
      return (a.date + String(a.hour)).localeCompare(b.date + String(b.hour));
    });
    if (state.bkFilter && state.bkFilter !== "all") {
      list = list.filter(function (b) { return b.status === state.bkFilter; });
    }
    /* provider scope */
    const a = admin();
    if (a && a.role === "provider" && a.providerId) {
      list = list.filter(function (b) { return b.providerId === a.providerId; });
    }
    return list;
  }

  function renderBookings() {
    const host = $("#bkTable");
    if (!host) return;
    window.PNC_STORE.renderBookingForm();
    const list = bookingRows();

    const fh = $("#bkFilters");
    if (fh) {
      const opts = ["all"].concat(BK_STATUSES);
      fh.innerHTML = opts.map(function (s) {
        return '<button type="button" class="chip' + (state.bkFilter === s ? " active" : "") + '" data-bkf="' + s + '">' +
          (s === "all" ? "All" : D.titleCase(s)) + "</button>";
      }).join("");
      $$("[data-bkf]", fh).forEach(function (b) {
        b.addEventListener("click", function () { state.bkFilter = b.dataset.bkf; renderBookings(); });
      });
    }

    $("#bkCount").textContent = list.length + " appointment" + (list.length === 1 ? "" : "s");
    $("#bkTitle").textContent = state.bkFilter && state.bkFilter !== "all"
      ? D.titleCase(state.bkFilter) + " appointments"
      : "All appointments";

    if (!list.length) {
      host.innerHTML = '<tr><td style="border:0">' + emptyState("&#128197;", "No appointments match", "Try another filter above.") + "</td></tr>";
      renderWaitlist();
      return;
    }

    const canManage = allowed("bookings.manage");
    host.innerHTML = "<thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Pet</th><th>Customer</th><th>Provider</th><th>Status</th><th>Paid</th><th></th></tr></thead><tbody>" +
      list.map(function (b) {
        const pet = petOfId(b.petId) || {};
        const own = ownerOfId(b.ownerId) || {};
        return '<tr>' +
          "<td>" + D.fmtDate(b.date) + "</td>" +
          '<td class="num">' + D.fmtTime(b.hour) + "</td>" +
          "<td><b>" + esc(svcOfId(b.serviceId).name) + "</b></td>" +
          "<td>" + esc(pet.petName || "—") + "</td>" +
          "<td>" + esc(own.fullName || "—") + "</td>" +
          "<td>" + esc(providerName(b.providerId)) + "</td>" +
          "<td>" + pill(b.status, b.status === "completed" ? "primary" : b.status === "cancelled" ? "danger" : "") + "</td>" +
          '<td class="num">' + money(b.paid) + " / " + money(b.total) + "</td>" +
          '<td><div style="display:flex;gap:5px;flex-wrap:wrap">' +
            (canManage && ["pending", "confirmed"].includes(b.status)
              ? '<button class="mini-btn primary" data-bkdone="' + b.id + '">Complete</button><button class="mini-btn" data-bkreschedule="' + b.id + '">Reschedule</button>' : "") +
            (canManage && b.status === "pending" ? '<button class="mini-btn" data-bkconfirm="' + b.id + '">Confirm</button>' : '') +
            (allowed("payments.take") && canManage && !["cancelled", "no-show"].includes(b.status) && b.paid < b.total
              ? '<button class="mini-btn" data-bkpay="' + esc(b.id) + '">Record payment</button>' : "") +
            (allowed("bookings.notes")
              ? '<button class="mini-btn warn" data-bknote="' + b.id + '">Note</button>' : "") +
            (canManage && ["pending", "confirmed"].includes(b.status)
              ? '<button class="mini-btn danger" data-bkcancel="' + b.id + '">Cancel</button>' : "") +
          "</div></td>" +
        "</tr>";
      }).join("") + "</tbody>";

    $$("[data-bkdone]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const r = await Promise.resolve(D.setBookingStatus(b.dataset.bkdone, "completed"));
        if (r.error) return toast(r.error, "err");
        toast("Booking completed");
        render();
      });
    });
    $$("[data-bkcancel]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const r = await Promise.resolve(D.setBookingStatus(b.dataset.bkcancel, "cancelled"));
        if (r.error) return toast(r.error, "err");
        toast("Booking cancelled");
        render();
      });
    });
    $$("[data-bknote]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const note = window.prompt("Internal note for " + b.dataset.bknote + ":");
        if (!note) return;
        const r = await Promise.resolve(D.addBookingNote(b.dataset.bknote, note));
        if (r.error) return toast(r.error, "err");
        toast("Internal note added");
      });
    });

    $$("[data-bkconfirm]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const r = await D.setBookingStatus(button.dataset.bkconfirm, "confirmed");
        if (r.error) return toast(r.error, "err");
        toast("Booking confirmed"); renderBookings();
      });
    });
    $$("[data-bkreschedule]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const booking = D.byId(D.db.bookings, button.dataset.bkreschedule);
        if (!booking) return;
        const date = window.prompt("New date (YYYY-MM-DD):", booking.date);
        if (!date) return;
        const time = window.prompt("New time (e.g. 9, 9.5, 14):", String(booking.hour));
        if (time === null) return;
        const r = await D.rescheduleBooking(booking.id, date, Number(time));
        if (r.error) return toast(r.error, "err");
        toast("Booking rescheduled"); renderBookings();
      });
    });

    renderWaitlist();
  }

  function renderWaitlist() {
    const host = $("#waitlistHost");
    if (!host) return;
    let list = D.db.waitlist || [];
    const a = admin();
    if (a && a.role === "provider" && a.providerId) list = list.filter(w => w.providerId === a.providerId);
    if (!list.length) {
      host.innerHTML = emptyState("&#128276;", "Nobody on the waitlist", "Offered slots free up here when a booking is cancelled.");
      return;
    }
    host.innerHTML = list.map(function (w) {
      const own = ownerOfId(w.ownerId) || {};
      const pet = petOfId(w.petId) || {};
      return '<div class="kan-card">' +
        '<div class="row"><b>' + esc(pet.petName || "—") + " · " + esc(svcOfId(w.serviceId).name) + "</b>" +
        (allowed("bookings.manage") ? '<button class="mini-btn danger" data-wlrm="' + w.id + '">Clear</button>' : '') + '</div>' +
        "<p>" + esc(own.fullName || "—") + " · " + esc(providerName(w.providerId)) + "</p>" +
        (w.note ? "<p style='margin-top:3px'>\"" + esc(w.note) + "\"</p>" : "") +
      "</div>";
    }).join("");
    $$("[data-wlrm]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const r = await Promise.resolve(D.removeWaitlist(b.dataset.wlrm));
        if (r && r.error) return toast(r.error, "err");
        toast("Removed from the waitlist");
        render();
      });
    });
  }

  /* ============================== CRM ============================== */
  function renderCRM() {
    const host = $("#crmTable");
    if (!host) return;
    let list = D.db.owners.slice();

    if (state.crmQ) {
      const q = state.crmQ.toLowerCase();
      list = list.filter(function (o) {
        return (o.fullName + " " + o.email + " " + (o.phone || "")).toLowerCase().indexOf(q) !== -1;
      });
    }
    /* provider scope: only owners with bookings with that provider */
    const a = admin();
    if (a && a.role === "provider" && a.providerId) {
      const mine = new Set(D.db.bookings.filter(function (b) { return b.providerId === a.providerId; }).map(function (b) { return b.ownerId; }));
      list = list.filter(function (o) { return mine.has(o.id); });
    }

    $("#crmCount").textContent = list.length + " customer" + (list.length === 1 ? "" : "s");

    const canEdit = allowed("crm.edit");
    host.innerHTML = "<thead><tr><th>Customer</th><th>Contact</th><th>Pets</th><th>Plan</th><th>Bookings</th><th>Lifetime spend</th><th></th></tr></thead><tbody>" +
      list.map(function (o) {
        const pets = D.petsOf(o.id);
        const bks = D.bookingsOf(o.id);
        const ords = D.ordersOf(o.id);
        const spend = bks.reduce(function (n, b) { return n + (b.paid || 0); }, 0) +
          ords.reduce(function (n, x) { return n + (x.paid || 0); }, 0);
        return "<tr>" +
          "<td><b>" + esc(o.fullName) + "</b><br><small style='color:var(--ink-soft)'>since " + D.fmtDate(o.createdAt) + "</small></td>" +
          "<td>" + esc(o.email) + "<br><small style='color:var(--ink-soft)'>" + esc(o.phone || "—") + "</small></td>" +
          "<td>" + pets.map(function (p) { return D.speciesIcon(p.species) + " " + esc(p.petName); }).join(", ") + "</td>" +
          "<td>" + pill(D.titleCase(o.plan || "puppy")) + "</td>" +
          '<td class="num">' + bks.length + "</td>" +
          '<td class="num"><b>' + money(spend) + "</b></td>" +
          '<td><button class="mini-btn" data-own="' + o.id + '">Open</button></td>' +
        "</tr>";
      }).join("") + "</tbody>";

    $$("[data-own]").forEach(function (b) {
      b.addEventListener("click", function () { openOwner(b.dataset.own); });
    });

    renderPets();
    renderOwnerDetail();
    renderContactRequests();
    $("#newOwnerBtn").hidden = !allowed("crm.edit");
  }

  function renderPets() {
    const host = $("#petHost");
    if (!host) return;
    const a = admin();
    let pets = D.db.pets.slice();
    if (a && a.role === "provider" && a.providerId) {
      const mine = new Set(D.db.bookings.filter(function (b) { return b.providerId === a.providerId; }).map(function (b) { return b.petId; }));
      pets = pets.filter(function (p) { return mine.has(p.id); });
    }
    if (!pets.length) {
      host.innerHTML = emptyState("&#128062;", "No pets on file", "Add a customer in the CRM to get started.");
      return;
    }
    host.innerHTML = '<div class="pet-tile-grid">' + pets.map(function (p) {
      const owner = ownerOfId(p.ownerId) || {};
      const vax = p.vaccines || [];
      const pend = vax.filter(function (v) { return v.status === "pending"; }).length;
      return '<div class="pet-tile">' +
        '<div class="pet-tile-art">' + D.speciesIcon(p.species) + "</div>" +
        '<div class="pet-tile-body">' +
          "<h3>" + esc(p.petName) + ' <span class="sub">' + esc(p.breed || p.species) + "</span></h3>" +
          '<div class="meta" style="font-size:.8rem;color:var(--ink-soft)">' +
            esc(owner.fullName || "—") + " · " + D.petAge(p) + " · " + esc(p.sex) + "</div>" +
          (vax.length
            ? '<table class="vax-table" style="margin-top:8px"><thead><tr><th>Vaccine</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>' +
              vax.map(function (v, i) {
                return '<tr class="vax-row"><td>' + esc(v.name) + "</td><td>" + D.fmtDate(v.date) + "</td>" +
                  "<td>" + pill(v.status, v.status === "approved" ? "primary" : v.status === "rejected" ? "danger" : "warn") + "</td>" +
                  "<td>" + (v.status !== "approved"
                    ? (allowed("crm.edit") ? '<button class="mini-btn primary" data-vok="' + p.id + ":" + i + '">Approve</button>' : "")
                    : "") + "</td></tr>";
              }).join("") + "</tbody></table>"
            : '<p class="hint" style="margin:8px 0 0">No vaccine records on file.</p>') +
          (allowed("crm.edit") ? '<button class="mini-btn" data-store-vaccine="' + esc(p.id) + '">Add vaccine record</button>' : "") +
          (pend ? '<p class="hint" style="margin:8px 0 0;color:var(--yellow)">' + pend + " pending record(s)</p>" : "") +
        "</div></div>";
    }).join("") + "</div>";

    $$("[data-vok]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const parts = b.dataset.vok.split(":");
        const r = await Promise.resolve(D.setVaccineStatus(parts[0], Number(parts[1]), "approved"));
        if (r.error) return toast(r.error, "err");
        toast("Vaccine record approved");
        render();
      });
    });
  }

  function openOwner(id) {
    state.ownerFilter = id || "new";
    go("crm");
    renderOwnerDetail();
    $("#ownerDetail").scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function renderOwnerDetail() {
    const host = $("#ownerDetail");
    if (!host) return;
    const o = ownerOfId(state.ownerFilter);
    host.hidden = !state.ownerFilter;
    if (host.hidden) return;
    const edit = allowed("crm.edit");
    host.innerHTML = '<h2>' + (o ? esc(o.fullName) : "New customer") + '</h2>' +
      (edit ? '<form id="ownerForm"><div class="field"><label for="ownerName">Full name</label><input class="input" id="ownerName" required minlength="2" value="' + esc(o?.fullName || "") + '"></div>' +
      '<div class="field"><label for="ownerEmail">Email (optional for walk-ins)</label><input class="input" id="ownerEmail" type="email" value="' + esc(o?.email || "") + '"></div>' +
      '<div class="field"><label for="ownerPhone">Phone</label><input class="input" id="ownerPhone" type="tel" value="' + esc(o?.phone || "") + '"></div>' +
      '<button class="btn btn-teal" type="submit">Save customer</button><p class="hint">Creates a customer record. Account access uses the customer’s own sign-in.</p></form>' : '') +
      (o && edit ? '<form id="storePetForm"><h3>Register a pet for this customer</h3><input type="hidden" name="ownerId" value="' + esc(o.id) + '"><div class="field"><label for="storePetName">Pet name</label><input class="input" id="storePetName" name="petName" required maxlength="120"></div><div class="field"><label for="storePetSpecies">Species</label><select class="input" id="storePetSpecies" name="species">' + D.SPECIES.map(x => '<option>' + esc(x) + '</option>').join('') + '</select></div><div class="field"><label for="storePetBreed">Breed</label><input class="input" id="storePetBreed" name="breed"></div><button class="btn btn-teal" type="submit">Save pet</button><p role="status"></p></form>' : '') +
      (o && allowed("messages.send") ? '<form id="ownerMessageForm"><h3>Send a portal message</h3><p class="hint">Delivered to the member inbox; no email or SMS is sent.</p>' +
      '<div class="field"><label for="messageSubject">Subject</label><input class="input" id="messageSubject" required maxlength="200"></div>' +
      '<div class="field"><label for="messageBody">Message</label><textarea class="input" id="messageBody" required maxlength="4000"></textarea></div>' +
      '<button class="btn btn-teal" type="submit">Send to member inbox</button></form>' : '') +
      (o ? '<h3>Conversation</h3>' + (D.db.messages || []).filter(m => m.ownerId === o.id).slice().reverse().map(m =>
        '<article class="panel"><b>' + esc(m.subject) + '</b><small> · ' + (m.direction === "out" ? 'To member' : 'From member') + '</small><p>' + esc(m.body) + '</p></article>').join('') : '');
  }

  function renderContactRequests() {
    const host = $("#contactRequests");
    if (!host) return;
    host.hidden = !allowed("crm.edit");
    if (host.hidden) return;
    const rows = (D.db.contactMessages || []).slice().reverse();
    host.innerHTML = '<h2>Contact requests</h2>' + (rows.length ? rows.map(r =>
      '<article class="panel"><b>' + esc(r.subject || 'General inquiry') + '</b><p>' + esc(r.name) + ' · ' + esc(r.email) + '</p><p>' + esc(r.body) + '</p>' +
      '<span>' + esc(r.status || 'new') + '</span> ' +
      (r.ownerId ? '<button class="mini-btn" data-own="' + esc(r.ownerId) + '">Open customer to reply</button> ' : '<p class="hint">Guest request — reply using your email service.</p>') +
      '<button class="mini-btn" data-contact="' + esc(r.id) + '" data-status="' + (r.status === 'resolved' ? 'new' : 'resolved') + '">' + (r.status === 'resolved' ? 'Reopen' : 'Mark resolved') + '</button></article>').join('') : '<p class="hint">No contact requests yet.</p>');
    $$('[data-own]', host).forEach(b => b.addEventListener('click', () => openOwner(b.dataset.own)));
    $$('[data-contact]', host).forEach(b => b.addEventListener('click', async function () {
      b.disabled = true;
      const r = await D.setContactStatus(b.dataset.contact, b.dataset.status);
      if (r?.error) { b.disabled = false; return toast(r.error, 'err'); }
      renderContactRequests();
    }));
  }

  /* ============================== POS =============================== */
  function renderPOS() { window.PNC_STORE.renderPOS(); renderOrders(); }
  function mountPOS() { window.PNC_STORE.mountPOS(); }

  function renderOrders() {
    const host = $("#orderHost");
    if (!host) return;
    const list = (D.db.orders || []).slice().sort(function (a, b) {
      return String(b.placedAt).localeCompare(String(a.placedAt));
    });
    $("#posOrderCount").textContent = list.length + " order" + (list.length === 1 ? "" : "s");
    if (!list.length) {
      host.innerHTML = emptyState("&#128722;", "No orders yet", "Orders recorded in this system will appear here.");
      return;
    }
    const production = D.productionMode && D.productionMode();
    host.innerHTML = (production ? '<p class="hint">Online payments and refunds cannot be processed from this app because no payment provider is connected.</p>' : '') + list.map(function (o) {
      const own = ownerOfId(o.ownerId) || {};
      const items = (o.items || []).map(function (it) {
        const p = D.PRODUCT_BY_ID[it.productId];
        return esc(it.label || (p ? p.name : it.productId)) + " ×" + it.qty;
      }).join(", ");
      const stage = o.stage || (o.status === "delivered" ? "done" : "pending");
      const idx = STAGES.indexOf(stage);
      return '<div class="order-card">' +
        '<div class="order-head"><span><b class="oid">' + esc(o.id) + "</b> " +
          '<span class="odate">' + esc(own.fullName || "Walk-in customer") + " · " + (o.fulfillment === "pos" ? "In-store · " : "Online · ") + D.fmtDate(o.placedAt) + "</span></span>" +
          pill(o.status === "delivered" ? "delivered" : o.status, o.status === "cancelled" ? "danger" : "") + "</div>" +
        '<div class="order-line"><span class="thumb">&#128230;</span><span>' + items + "</span></div>" +
        '<div class="order-foot"><span class="tot">' + money(o.total) + "</span>" +
        '<span style="display:flex;gap:5px;flex-wrap:wrap">' +
          (o.fulfillment === 'pos' ? '<button class="mini-btn" data-receipt="' + esc(o.id) + '">Receipt</button>' : '') +
          (o.fulfillment === 'pos' && o.paid > 0 && allowed("payments.refund")
            ? '<button class="mini-btn danger" data-store-refund="' + esc(o.id) + '">Record refund</button>' : '') +
          (idx > 0 && !["cancelled", "refunded"].includes(o.status) && o.stage !== "done"
            ? '<button class="mini-btn" data-ostage="' + o.id + ":" + STAGES[idx - 1] + '">&larr; ' + esc(STAGES[idx - 1]) + "</button>" : "") +
          (idx >= 0 && idx < STAGES.length - 1 && !["cancelled", "refunded"].includes(o.status) && o.stage !== "done"
            ? '<button class="mini-btn primary" data-ostage="' + o.id + ":" + STAGES[idx + 1] + '">' + esc(STAGES[idx + 1]) + " &rarr;</button>" : "") +
          (allowed("payments.refund") && !production && o.status !== "cancelled" && o.status !== "delivered"
            ? '<button class="mini-btn danger" data-orefund="' + o.id + '">Refund</button>' : "") +
        "</span></div></div>";
    }).join("");

    $$("[data-ostage]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const parts = b.dataset.ostage.split(":");
        const r = await Promise.resolve(D.setOrderStage(parts[0], parts[1]));
        if (r.error) return toast(r.error, "err");
        toast("Order moved to " + parts[1]);
        render();
      });
    });
    $$("[data-orefund]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const o = D.byId(D.db.orders, b.dataset.orefund);
        if (!o) return;
        const amt = window.prompt("Refund amount on " + o.id + " (paid " + money(o.paid) + "):", String(o.paid));
        if (amt === null) return;
        const r = await Promise.resolve(D.refund(o.id, Number(amt)));
        if (r.error) return toast(r.error, "err");
        toast("Refunded " + money(Number(amt)));
        render();
      });
    });
  }

  /* =========================== inventory =========================== */
  function renderInventory() {
    const host = $("#invTable");
    if (!host) return;
    const list = D.db.products.slice();
    const low = list.filter(function (p) { return p.stock <= p.lowAt; });
    $("#invNote").textContent = list.length + " products · " + low.length + " low on stock";

    host.innerHTML = "<thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th></th></tr></thead><tbody>" +
      list.map(function (p) {
        const out = p.stock <= 0;
        const isLow = p.stock <= p.lowAt;
        return "<tr>" +
          "<td><b>" + esc(p.name) + "</b></td>" +
          '<td class="num">' + esc(p.sku || "—") + "</td>" +
          "<td>" + esc(p.cat) + "</td>" +
          '<td class="num">' + money(p.price) + "</td>" +
          '<td class="num">' + money(p.cost || 0) + "</td>" +
          '<td class="num"><b style="color:' + (out ? "var(--danger)" : isLow ? "var(--yellow)" : "var(--ink)") + '">' + p.stock + "</b>" +
            (isLow ? " <span class='mini-btn warn' style='cursor:default'>" + (out ? "Out" : "Low") + "</span>" : "") + "</td>" +
          '<td><div style="display:flex;gap:5px;flex-wrap:wrap">' +
            '<button class="mini-btn" data-stk="' + p.id + ':-1">−1</button>' +
            '<button class="mini-btn primary" data-stk="' + p.id + ':1">+1</button>' +
            '<button class="mini-btn" data-stk="' + p.id + ':10">+10</button>' +
            '<button class="mini-btn warn" data-pedit="' + p.id + '">Edit</button>' +
          "</div></td>" +
        "</tr>";
      }).join("") + "</tbody>";

    $$("[data-stk]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const parts = b.dataset.stk.split(":");
        const r = await Promise.resolve(D.adjustStock(parts[0], Number(parts[1]), "admin adjustment"));
        if (r.error) return toast(r.error, "err");
        toast(r.product.name + " → " + r.product.stock + " in stock");
        render();
      });
    });
    $$("[data-pedit]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const p = D.byId(D.db.products, b.dataset.pedit);
        if (!p) return;
        const price = window.prompt("Price for " + p.name + ":", String(p.price));
        if (price === null) return;
        const stock = window.prompt("Stock level:", String(p.stock));
        if (stock === null) return;
        const r = await Promise.resolve(D.updateProduct(p.id, { price: Number(price), stock: Number(stock) }));
        if (r.error) return toast(r.error, "err");
        toast(p.name + " updated");
        render();
      });
    });

    renderListings();
  }

  function renderListings() {
    const host = $("#listingHost");
    if (!host) return;
    const list = D.db.listings || [];
    if (!list.length) {
      host.innerHTML = emptyState("&#128062;", "No pet listings", "New listings appear here for approval.");
      return;
    }
    host.innerHTML = '<div class="pet-tile-grid">' + list.map(function (l) {
      return '<div class="pet-tile">' +
        '<div class="pet-tile-art">' + D.icon(l.icon) + "</div>" +
        '<div class="pet-tile-body">' +
          "<h3>" + esc(l.name) + ' <span class="sub">' + esc(l.breed) + "</span></h3>" +
          '<div class="meta" style="font-size:.8rem;color:var(--ink-soft)">' +
            D.speciesIcon(l.species) + " " + esc(l.species) + " · " + esc(l.sex) + " · " + money(l.price) + "</div>" +
          '<div class="pet-tile-actions" style="margin-top:10px">' +
            LST_STATUSES.map(function (s) {
              return '<button class="mini-btn' + (l.status === s ? " primary" : "") + '" data-lst="' + l.id + ":" + s + '">' +
                D.titleCase(s) + "</button>";
            }).join("") +
          "</div>" +
        "</div></div>";
    }).join("") + "</div>";

    $$("[data-lst]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const parts = b.dataset.lst.split(":");
        const r = await Promise.resolve(D.setListingStatus(parts[0], parts[1]));
        if (r.error) return toast(r.error, "err");
        toast(r.listing.name + " is now " + parts[1]);
        render();
      });
    });
    const inquiries = D.db.inquiries || [];
    host.insertAdjacentHTML("beforeend", '<h3>Pet inquiries</h3>' + (inquiries.length ? inquiries.map(function (i) {
      const owner = ownerOfId(i.ownerId) || {};
      const listing = D.byId(list, i.listingId) || {};
      return '<article class="kan-card"><b>' + esc(i.ref) + ' · ' + esc(listing.name || i.listingId) + '</b><p>' +
        esc(i.name || owner.fullName || 'Guest') + ' · ' + esc(i.email || owner.email || 'Contact details unavailable') +
        '</p><p>' + esc(i.message) + '</p></article>';
    }).join('') : '<p class="hint">No pet inquiries yet.</p>'));
  }

  /* ============================== CMS ============================== */
  function renderCMS() {
    const cms = D.db.cms;
    if (!cms) return;
    const set = function (id, val) { const el = $(id); if (el) el.value = val == null ? "" : val; };
    set("#cms-banner", cms.banner);
    set("#cms-hero", cms.heroTitle);
    set("#cms-tag", cms.tagline);
    set("#cms-hot", cms.emergencyHotline);
    set("#cms-phone", cms.phone);
    set("#cms-email", cms.email);
    set("#cms-addr", cms.address);
    set("#cms-enote", cms.emergencyNote);
    $("#cmsCatalogConfirmed").checked = cms.catalogConfirmed === true;
    const hoursHost = $("#cmsHours");
    if (hoursHost) {
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const to24 = function (value) {
        const parts = String(value || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!parts) return "";
        const hour = Number(parts[1]) % 12 + (parts[3].toUpperCase() === "PM" ? 12 : 0);
        return String(hour).padStart(2, "0") + ":" + parts[2];
      };
      hoursHost.innerHTML = days.map(function (day) {
        const row = (cms.hours || []).find(h => h.day === day) || {};
        return '<div class="store-hour-row" data-hour-day="' + day + '"><b>' + day + '</b>' +
          '<label>Opens<input class="input" type="time" data-hour-open value="' + esc(to24(row.open)) + '"></label>' +
          '<label>Closes<input class="input" type="time" data-hour-close value="' + esc(to24(row.close)) + '"></label></div>';
      }).join("");
    }

    const pick = $("#svcPick");
    if (pick) {
      const cur = pick.value;
      pick.innerHTML = D.db.services.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.name) + " (" + money(s.price) + ")</option>";
      }).join("");
      if (cur && D.byId(D.db.services, cur)) pick.value = cur;
      fillServiceForm();
      pick.addEventListener("change", fillServiceForm);
    }

    renderStaff();
    renderRoles();
    renderAudit();
  }

  function fillServiceForm() {
    const s = D.byId(D.db.services, $("#svcPick").value);
    if (!s) return;
    $("#svcName").value = s.name;
    $("#svcPrice").value = s.price;
    $("#svcDur").value = s.duration;
    $("#svcPop").value = s.popular ? "1" : "0";
    $("#svcDesc").value = s.desc || "";
  }

  function mountCMS() {
    const form = $("#cmsForm");
    if (form) form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const asClock = function (value) {
        const parts = String(value).split(":").map(Number);
        return String(parts[0] % 12 || 12) + ":" + String(parts[1]).padStart(2, "0") + (parts[0] >= 12 ? " PM" : " AM");
      };
      const hours = [];
      let configured = false;
      for (const row of $$("[data-hour-day]", form)) {
        const open = row.querySelector("[data-hour-open]").value;
        const close = row.querySelector("[data-hour-close]").value;
        if (!!open !== !!close) return toast("Enter both opening and closing times for " + row.dataset.hourDay + ".", "err");
        if (open && close && close <= open) return toast("Closing time must be after opening time for " + row.dataset.hourDay + ".", "err");
        configured ||= !!open;
        hours.push({day: row.dataset.hourDay, open: open ? asClock(open) : "Closed", close: close ? asClock(close) : "Closed"});
      }
      const res = await Promise.resolve(D.updateCMS({
        banner: String(fd.get("banner") || "").trim(),
        heroTitle: String(fd.get("heroTitle") || "").trim(),
        tagline: String(fd.get("tagline") || "").trim(),
        emergencyHotline: String(fd.get("emergencyHotline") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        address: String(fd.get("address") || "").trim(),
        emergencyNote: String(fd.get("emergencyNote") || "").trim(),
        hours: configured ? hours : [],
        catalogConfirmed: $("#cmsCatalogConfirmed").checked
      }));
      if (res && res.error) return toast(res.error, "err");
      $("#cmsMsg").style.color = "var(--ok)";
      $("#cmsMsg").textContent = "Site content saved.";
      toast("Site content saved");
    });

    const sf = $("#svcForm");
    if (sf) sf.addEventListener("submit", async function (e) {
      e.preventDefault();
      const id = $("#svcPick").value;
      const r = await Promise.resolve(D.updateService(id, {
        name: $("#svcName").value.trim(),
        price: Number($("#svcPrice").value),
        duration: Number($("#svcDur").value),
        popular: $("#svcPop").value === "1",
        desc: $("#svcDesc").value
      }));
      if (r.error) {
        $("#svcMsg").style.color = "var(--danger)";
        $("#svcMsg").textContent = r.error;
        return toast(r.error, "err");
      }
      $("#svcMsg").style.color = "var(--ok)";
      $("#svcMsg").textContent = r.service.name + " updated.";
      toast("Service updated");
      renderCMS();
    });

    const lf = $("#leaveForm");
    if (lf) lf.addEventListener("submit", async function (e) {
      e.preventDefault();
      const r = await Promise.resolve(D.addLeave($("#lvWho").value, $("#lvDate").value, $("#lvWhy").value));
      if (r && r.error) {
        $("#lvMsg").style.color = "var(--danger)";
        $("#lvMsg").textContent = r.error;
        return toast(r.error, "err");
      }
      $("#lvMsg").style.color = "var(--ok)";
      $("#lvMsg").textContent = "Day blocked.";
      toast("Leave blocked for " + $("#lvWho").value);
      renderStaff();
      lf.reset();
    });
  }

  function renderStaff() {
    const host = $("#staffHost");
    const sel = $("#lvWho");
    if (!host) return;
    const providers = D.PROVIDERS || [];
    if (sel && !sel.options.length) {
      sel.innerHTML = providers.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>";
      }).join("");
    }
    const leave = D.db.staffLeave || [];
    host.innerHTML = providers.map(function (p) {
      const mine = leave.filter(function (l) { return l.providerId === p.id; });
      return '<div class="kan-card">' +
        '<div class="row"><b>' + D.icon(p.icon) + " " + esc(p.name) + "</b>" +
          pill(p.role, "primary") + "</div>" +
        "<p>" + esc(p.title) + " · " + D.fmtTime(p.start) + "–" + D.fmtTime(p.end) + "</p>" +
        (mine.length
          ? '<div style="margin-top:8px;display:grid;gap:5px">' + mine.map(function (l) {
              return '<div style="display:flex;align-items:center;gap:8px;font-size:.78rem">' +
                '<span class="mini-btn warn" style="cursor:default">' + D.fmtDate(l.date) + "</span>" +
                "<span style='color:var(--ink-soft)'>" + esc(l.reason) + "</span>" +
                '<button class="mini-btn danger" data-lvrm="' + l.id + '">Remove</button></div>';
            }).join("") + "</div>"
          : '<p class="hint" style="margin:6px 0 0">No time off booked.</p>') +
      "</div>";
    }).join("");
    $$("[data-lvrm]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const r = await Promise.resolve(D.removeLeave(b.dataset.lvrm));
        if (r && r.error) return toast(r.error, "err");
        toast("Leave removed");
        renderStaff();
      });
    });
  }

  function renderRoles() {
    const host = $("#rolesHost");
    if (!host) return;
    const roles = Object.keys(D.ADMIN_ROLES).map(function (k) { return D.ADMIN_ROLES[k]; });
    const perms = D.PERMS;
    const keys = Object.keys(perms.super && perms.desk ? perms.desk : {});
    const allKeys = Array.from(new Set(Object.keys(perms.desk || {}).concat(Object.keys(perms.provider || {}), Object.keys(perms.retail || {}))));

    host.innerHTML = '<div class="table-wrap"><table class="adm-table"><thead><tr><th>Permission</th>' +
      roles.map(function (r) { return "<th>" + esc(r.name) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      allKeys.map(function (k) {
        return "<tr><td><b>" + esc(k) + "</b></td>" +
          roles.map(function (r) {
            const v = r.id === "super" ? true : (perms[r.id] || {})[k];
            const cls = v === true ? "primary" : v === "own" ? "warn" : "danger";
            const txt = v === true ? "Yes" : v === "own" ? "Own only" : "No";
            return "<td>" + pill(txt, cls) + "</td>";
          }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="hint" style="margin:10px 0 0">Super Admin has every permission. "Own only" limits a provider to their own schedule and customers.</p>';
  }

  function renderAudit() {
    const host = $("#auditHost");
    if (!host) return;
    const log = D.db.audit || [];
    if (!log.length) {
      host.innerHTML = emptyState("&#128221;", "No audit entries yet", "Every staff action is recorded here.");
      return;
    }
    host.innerHTML = log.slice(0, 30).map(function (a) {
      return '<div class="kan-card"><div class="row"><b>' + esc(a.action) + "</b>" +
        '<small style="color:var(--ink-soft)">' + D.fmtDate(a.at) + "</small></div>" +
        "<p style='margin:4px 0 0'>" + esc(a.detail) + "</p>" +
        "<p style='margin:3px 0 0;color:var(--ink-soft)'>" + esc(a.adminEmail) + "</p></div>";
    }).join("");
  }

  /* ========================== global search ======================== */
  function mountSearch() {
    const input = $("#globalSearch");
    const host = $("#searchResults");
    if (!input || !host) return;

    function close() { host.hidden = true; host.innerHTML = ""; }

    function show(q) {
      const res = D.searchCRM(q);
      const total = res.owners.length + res.pets.length + res.bookings.length;
      if (!q.trim() || !total) { close(); return; }
      host.innerHTML = '<div class="sr-box">' +
        '<div class="sr-head"><b>Results for "' + esc(q) + '"</b>' +
        '<button class="mini-btn" id="srClose">Close</button></div>' +
        '<div class="sr-list">' +
          res.owners.map(function (o) {
            return '<button class="sr-item" data-srowner="' + o.id + '"><span class="ni">&#128100;</span>' +
              "<span><b>" + esc(o.fullName) + "</b><small>" + esc(o.email) + "</small></span></button>";
          }).join("") +
          res.pets.map(function (p) {
            return '<button class="sr-item" data-srpet="' + p.id + '"><span class="ni">' + D.speciesIcon(p.species) + "</span>" +
              "<span><b>" + esc(p.petName) + "</b><small>" + esc(p.breed) + " · " + esc((ownerOfId(p.ownerId) || {}).fullName || "") + "</small></span></button>";
          }).join("") +
          res.bookings.map(function (b) {
            return '<button class="sr-item" data-srbk="' + b.id + '"><span class="ni">&#128197;</span>' +
              "<span><b>" + esc(b.id) + "</b><small>" + esc(svcOfId(b.serviceId).name) + " · " + D.fmtDate(b.date) + "</small></span></button>";
          }).join("") +
        "</div></div>";
      host.hidden = false;
      $("#srClose").addEventListener("click", close);
      $$("[data-srowner]", host).forEach(function (b) {
        b.addEventListener("click", function () { close(); openOwner(b.dataset.srowner); });
      });
      $$("[data-srpet]", host).forEach(function (b) {
        b.addEventListener("click", function () {
          const p = petOfId(b.dataset.srpet);
          close();
          if (p) openOwner(p.ownerId);
        });
      });
      $$("[data-srbk]", host).forEach(function (b) {
        b.addEventListener("click", function () { close(); state.bkFilter = "all"; go("bookings"); });
      });
    }

    input.addEventListener("input", function () { show(input.value); });
    input.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#searchResults") && !e.target.closest("#globalSearch")) close();
    });
  }

  /* ============================== state ============================ */
  const state = {
    section: "dashboard",
    bkFilter: "all",
    crmQ: "",
    ownerFilter: null
  };

  /* ============================== render =========================== */
  function render() {
    if (!admin()) return;
    const s = state.section;
    if (s === "dashboard") renderDashboard();
    else if (s === "bookings") renderBookings();
    else if (s === "crm") renderCRM();
    else if (s === "pos") renderPOS();
    else if (s === "inventory") renderInventory();
    else if (s === "cms") renderCMS();
  }

  function mountShell() {
    document.addEventListener("click", function (e) {
      const shortcut = e.target.closest("[data-goto]");
      if (!shortcut) return;
      e.preventDefault();
      go(shortcut.dataset.goto);
    });
    const t = $("#sideToggle");
    if (t) t.addEventListener("click", function () {
      setSidebar(!$("#adminSide").classList.contains("open"));
    });
    $("#sideClose").addEventListener("click", function () { setSidebar(false); });
    $("#sideBackdrop").addEventListener("click", function () { setSidebar(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && $("#adminSide").classList.contains("open")) setSidebar(false);
    });
    window.addEventListener("resize", function () { setSidebar(false); });
    setSidebar(false);
    const lo = $("#adLogout");
    if (lo) lo.addEventListener("click", leave);
    const rs = $("#adReset");
    if (rs) rs.hidden = D.productionMode();
    if (rs) rs.addEventListener("click", function () {
      if (!window.confirm("Reset all demo data to its seeded state? This cannot be undone.")) return;
      D.reset();
      toast("Demo data reset");
      render();
    });
    const dr = $("#dashRefresh");
    if (dr) dr.addEventListener("click", async function () {
      dr.disabled = true;
      try {
        if (D.productionMode() && !(await window.PNC_CONVEX?.syncBootstrap())) return toast("Could not refresh secure data. Please try again.", "err");
        render(); toast("Dashboard refreshed");
      } finally { dr.disabled = false; }
    });
    const nob = $("#newOwnerBtn");
    if (nob) nob.addEventListener("click", function () { openOwner(null); });
    document.addEventListener("submit", async function (e) {
      if (!["ownerForm", "ownerMessageForm"].includes(e.target.id)) return;
      e.preventDefault();
      const button = e.target.querySelector('button[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      try {
        let result;
        if (e.target.id === "ownerForm") {
          const input = { fullName: $("#ownerName").value, email: $("#ownerEmail").value, phone: $("#ownerPhone").value };
          result = state.ownerFilter === "new" ? await D.createOwner(input) : await D.updateOwner(state.ownerFilter, input);
          if (result?.owner) state.ownerFilter = result.owner.id;
        } else {
          result = await D.sendMessage(state.ownerFilter, $("#messageSubject").value, $("#messageBody").value);
        }
        if (result?.error) return toast(result.error, "err");
        toast(e.target.id === "ownerForm" ? "Customer saved" : "Message sent to member inbox");
        renderCRM();
      } catch (err) { toast("Could not save. Please try again.", "err"); }
      finally { button.disabled = false; }
    });
  }

  /* ============================== boot ============================= */
  function start() {
    try { D.load(); } catch (e) { try { D.reset(); } catch (e2) {} }

    renderCreds();
    mountLogin();
    mountClerkGate();
    mountShell();
    mountPOS();
    mountCMS();
    mountSearch();
    window.addEventListener("pnc:store-saved", render);

    /* Clerk loads asynchronously from a CDN; re-mount the gate and
       re-evaluate the staff session once it reports ready. */
    window.addEventListener("pnc:clerk", function () {
      mountClerkGate();
      if (admin()) enter();
    });

    window.addEventListener("pnc:data-ready", function () {
      if (admin()) enter();
      else { $("#adminShell").hidden = true; $("#adminGate").hidden = false; }
    });
    window.addEventListener("storage", function () {
      if (!admin()) { $("#adminShell").hidden = true; $("#adminGate").hidden = false; }
    });
    const a = admin();
    if (a) enter();
    else document.body.classList.add("admin-body");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
