/* ============================================================
   Paws & Claws — Services & Booking Portal
   Service catalog (CMS-driven), 4-step booking wizard with the
   real-time availability engine, quick-book hero widget,
   provider directory, and waitlist fallback.
   ============================================================ */

(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.PNC_DB;
  const esc = D.esc;
  const money = D.money;

  /* ------------------------- catalog render ------------------------- */
  let activeGroup = "all";

  function serviceCard(s) {
    const providers = s.staff.map((id) => D.PROVIDER_BY_ID[id]).filter(Boolean);
    return (
      '<div class="card svc-card reveal in" data-svc-card="' + s.id + '">' +
        '<div class="flex gap12" style="align-items:flex-start">' +
          '<span class="ico" style="width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:1.5rem;background:var(--ocean-100);flex:none">' + s.icon + "</span>" +
          "<div><h3>" + esc(s.name) + "</h3>" +
          '<div class="svc-meta">' +
            (s.popular ? '<span class="tag tag--yellow">Popular</span>' : "") +
            (s.requiresVaccine ? '<span class="tag tag--yellow">Vaccines required</span>' : '<span class="tag">No vaccine requirement</span>') +
          "</div></div>" +
        "</div>" +
        "<p>" + esc(s.desc) + "</p>" +
        '<p class="small muted" style="margin:0">With ' +
          providers.map((p) => esc(p.name)).join(", ") +
        "</p>" +
        '<div class="svc-foot">' +
          '<span class="svc-price">' + money(s.price) + "</span>" +
          '<span class="svc-dur">' + s.duration + " hr" + (s.duration === 1 ? "" : "s") + "</span>" +
          '<button class="mini-btn primary" data-book="' + s.id + '">Book now</button>' +
        "</div>" +
      "</div>"
    );
  }

  function renderServices() {
    const grid = $("#serviceGrid");
    if (!grid) return;
    const list = D.db.services.filter((s) => activeGroup === "all" || s.group === activeGroup);
    grid.innerHTML = list.map(serviceCard).join("");
    const nav = $("#groupNav");
    if (nav) {
      const items = [{ id: "all", name: "All services" }].concat(D.SERVICE_GROUPS);
      nav.innerHTML = items.map((g) =>
        '<button class="chip' + (g.id === activeGroup ? " active" : "") + '" data-group="' + g.id + '">' +
        (g.icon ? g.icon + " " : "") + esc(g.name).replace(/&amp;/g, "&") + "</button>"
      ).join("");
    }
  }

  function renderProviders() {
    const grid = $("#providerGrid");
    if (!grid) return;
    grid.innerHTML = D.PROVIDERS.map(function (p) {
      const svc = D.db.services.filter((s) => s.staff.indexOf(p.id) !== -1);
      return (
        '<div class="card svc-card reveal in">' +
          '<div class="flex gap12" style="align-items:flex-start">' +
            '<span class="pi" style="width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:1.5rem;background:var(--yellow-100);flex:none">' + p.icon + "</span>" +
            "<div><h3>" + esc(p.name) + "</h3>" +
            '<p class="small muted" style="margin:2px 0 0">' + esc(p.title) + "</p></div>" +
          "</div>" +
          "<p>" + esc(p.bio) + "</p>" +
          '<div class="svc-meta">' +
            '<span class="tag">' + esc(p.role) + "</span>" +
            svc.slice(0, 2).map((s) => '<span class="tag tag--yellow">' + esc(s.name) + "</span>").join("") +
            (svc.length > 2 ? '<span class="tag">+' + (svc.length - 2) + " more</span>" : "") +
          "</div>" +
          '<div class="svc-foot">' +
            '<span class="small muted">Hours<br><b>' + D.fmtTime(p.start) + " – " + D.fmtTime(p.end) + "</b></span>" +
            '<button class="mini-btn" data-provider-book="' + p.id + '">See slots</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderStats() {
    const host = $("#svcStats");
    if (!host) return;
    const svc = D.db.services;
    host.innerHTML =
      "<div><b>" + svc.length + "</b><span>Services on the menu</span></div>" +
      "<div><b>" + D.PROVIDERS.length + "</b><span>Verified providers</span></div>" +
      "<div><b>4.9&#9733;</b><span>Average care rating</span></div>";
  }

  /* --------------------------- quick book --------------------------- */
  function renderQuickBook() {
    const sel = $("#qbService");
    if (!sel) return;
    sel.innerHTML = D.db.services.map((s) => '<option value="' + s.id + '">' + esc(s.name) + " · " + money(s.price) + "</option>").join("");
    refreshQBPets();
  }

  function refreshQBPets() {
    const sel = $("#qbPet");
    if (!sel) return;
    const o = D.currentOwner();
    const pets = o ? D.petsOf(o.id) : [];
    sel.innerHTML = pets.length
      ? pets.map((p) => '<option value="' + p.id + '">' + esc(p.petName) + " (" + esc(p.species) + ")</option>").join("")
      : '<option value="">Add a pet when you book</option>';
  }

  /* ---------------------------- wizard ------------------------------ */
  const W = { step: 1, serviceId: null, date: null, hour: null, providerId: null, petId: null, intake: {} };

  function petsForBooking() {
    const o = D.currentOwner();
    return o ? D.petsOf(o.id) : [];
  }

  function gotoStep(n) {
    W.step = n;
    $$(".wiz-pane").forEach((p) => p.classList.toggle("on", Number(p.dataset.pane) === n));
    $$(".wiz-step").forEach(function (s) {
      const i = Number(s.dataset.step);
      s.classList.toggle("active", i === n);
      s.classList.toggle("done", i < n);
    });
    $("#wizBack").hidden = n === 1;
    $("#wizNext").hidden = n === 4;
    $("#wizConfirm").hidden = n !== 4;
    if (n === 2) renderStep2();
    if (n === 3) renderStep3();
    if (n === 4) renderStep4();
    const wiz = $("#wizard");
    if (wiz) wiz.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderStep1() {
    const host = $("#pickService");
    if (!host) return;
    const groups = D.SERVICE_GROUPS;
    host.innerHTML = groups.map(function (g) {
      const list = D.db.services.filter((s) => s.group === g.id);
      return (
        '<div style="grid-column:1/-1;display:flex;align-items:center;gap:10px;margin-top:8px">' +
          '<span style="font-size:1.3rem">' + g.icon + "</span>" +
          '<b style="font-family:var(--font-display);font-size:1.05rem">' + g.name + "</b>" +
          '<span class="small muted">' + esc(g.blurb) + "</span>" +
        "</div>"
      );
    }).join("") + D.db.services.map(function (s) {
      const on = W.serviceId === s.id;
      return (
        '<button class="pick' + (on ? " on" : "") + '" data-pick="' + s.id + '">' +
          '<span class="pi">' + s.icon + "</span>" +
          "<span><b>" + esc(s.name) + "</b><small>" + money(s.price) + " · " + s.duration + " hr" + (s.duration === 1 ? "" : "s") +
          (s.requiresVaccine ? " · vaccines required" : "") + "</small></span>" +
        "</button>"
      );
    }).join("");
  }

  function datePills() {
    const host = $("#datePills");
    if (!host) return;
    const pills = [];
    for (let i = 0; i < 7; i++) {
      const ds = D.addDays(i);
      const d = D.parseD(ds);
      const open = D.slotsFor(D.db, W.serviceId, ds).filter((s) => s.available).length;
      pills.push(
        '<button class="date-pill' + (W.date === ds ? " on" : "") + '" data-date="' + ds + '"' + (open ? "" : ' disabled style="opacity:.45;cursor:not-allowed"') + ">" +
          ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + " " + (d.getMonth() + 1) + "/" + d.getDate() +
          "<small>" + (open ? open + " open" : "full") + "</small>" +
        "</button>"
      );
    }
    host.innerHTML = pills.join("");
  }

  function renderStep2() {
    const svc = D.SERVICE_BY_ID[W.serviceId];
    $("#step2Hint").innerHTML = "Availability for <b>" + esc(svc.name) + "</b> — live, updated as bookings come in.";
    if (!W.date) W.date = D.firstOpenDate(D.db, W.serviceId);
    const inp = $("#wizDate");
    inp.value = W.date;
    inp.min = D.todayISO();
    datePills();
    renderSlots();
  }

  function renderSlots() {
    const host = $("#slotHost");
    if (!host) return;
    const svc = D.SERVICE_BY_ID[W.serviceId];
    const all = D.slotsFor(D.db, W.serviceId, W.date);
    const open = all.filter((s) => s.available);
    const prov = svc.staff.map((id) => D.PROVIDER_BY_ID[id]).filter(Boolean);

    let html = "";
    /* per-provider columns so you can pick your specialist */
    html += '<div class="grid2" style="gap:18px">' + prov.map(function (p) {
      const mine = all.filter((s) => s.providerId === p.id);
      if (!mine.length) return "";
      const free = mine.filter((s) => s.available);
      return (
        '<div><div class="flex between gap8" style="margin-bottom:10px">' +
          '<b style="font-size:.92rem">' + esc(p.name) + "</b>" +
          '<span class="small muted">' + free.length + "/" + mine.length + " open</span>" +
        "</div>" +
        '<div class="slot-grid">' + mine.map(function (s) {
          const on = W.hour === s.hour && W.providerId === s.providerId;
          return (
            '<button class="slot' + (on ? " on" : "") + '"' + (s.available ? "" : " disabled") +
              ' data-slot="' + s.hour + '" data-provider="' + s.providerId + '">' +
              D.fmtTime(s.hour) +
              "<small>" + (s.available ? esc(p.name.split(" ")[0]) + " · " + Math.round(s.hour + svc.duration) + "h end" : "Booked") + "</small>" +
            "</button>"
          );
        }).join("") + "</div></div>"
      );
    }).join("") + "</div>";

    if (!open.length) {
      html = '<div class="slot-none">&#128197; Nothing open on ' + D.fmtDate(W.date) + ". " +
        "Try another day, or join the waitlist and we'll text you the moment a slot frees up.</div>" +
        '<div style="margin-top:14px"><button class="btn btn-teal" id="wlJoin">Join the waitlist</button></div>';
    }
    host.innerHTML = html;

    const wl = $("#wlJoin");
    if (wl) wl.addEventListener("click", async function () {
      const o = D.currentOwner();
      if (!o) { PNC.toast("Create a free account to join the waitlist", "err"); window.location.href = "membership.html#join"; return; }
      const svc2 = D.SERVICE_BY_ID[W.serviceId];
      const r = await Promise.resolve(D.joinWaitlist(W.serviceId, svc2.staff[0], "No slot on " + W.date));
      if (!r.error) { PNC.toast("Added to the waitlist — we'll text you!"); renderBell(); }
    });
  }

  function vaxWarningHTML(pet, svc) {
    if (!svc.requiresVaccine) return "";
    const chk = D.vaccinesOk(pet, svc);
    if (chk.ok) {
      return '<div class="warn-card">&#9989;<div><b>Vaccines current.</b> ' + esc(pet.petName) +
        " has all required vaccines on file and approved.</div></div>";
    }
    return '<div class="warn-card bad">&#9888;<div><b>Vaccine records needed.</b> ' + esc(pet.petName) +
      " is missing: " + esc(chk.missing.join(", ")) + '. Upload records in <a href="account.html#pets" style="font-weight:700;text-decoration:underline">your account</a> — staff approve them within one business day, and you can book a vaccination visit right now.</div></div>';
  }

  function renderStep3() {
    const pets = petsForBooking();
    const host = $("#petHost");
    if (!host) return;

    if (!pets.length) {
      host.innerHTML =
        '<div class="empty-state"><div class="ico">&#128062;</div>' +
        "<b>No pets on your account yet</b>" +
        "<p>Add your first pet to continue booking.</p>" +
        '<button class="btn btn-primary" id="addPetBtn">+ Add a pet</button></div>';
      $("#addPetBtn").addEventListener("click", function () { PNC.openModal("petModal"); });
      $("#intakeHost").innerHTML = "";
      $("#vaxWarn2").innerHTML = "";
      return;
    }
    if (!W.petId || !pets.some((p) => p.id === W.petId)) W.petId = pets[0].id;

    host.innerHTML = '<div class="pick-grid">' + pets.map(function (p) {
      const on = W.petId === p.id;
      const svc = D.SERVICE_BY_ID[W.serviceId];
      const ok = D.vaccinesOk(p, svc).ok;
      return (
        '<button class="pick' + (on ? " on" : "") + '" data-pet="' + p.id + '">' +
          '<span class="pi">' + D.speciesIcon(p.species) + "</span>" +
          "<span><b>" + esc(p.petName) + "</b><small>" + esc(p.species) + " · " + esc(p.breed || "Mixed") +
          " · " + D.petAge(p) + "</small>" +
          (svc.requiresVaccine
            ? '<br><small style="color:' + (ok ? "var(--ok)" : "var(--yellow-600)") + '">' + (ok ? "✓ Vaccines current" : "⚠ Vaccine records needed") + "</small>"
            : "") +
          "</span>" +
        "</button>"
      );
    }).join("") + "</div>";

    const pet = D.byId(D.db.pets, W.petId);
    const svc = D.SERVICE_BY_ID[W.serviceId];
    $("#vaxWarn2").innerHTML = vaxWarningHTML(pet, svc);

    /* intake form per service group */
    const g = svc.group;
    let f = "";
    if (g === "grooming") {
      f = '<h3 class="sub">&#128136; Grooming details</h3>' +
        '<div class="field"><label for="in-instructions">Instructions for the groomer</label>' +
        '<textarea class="input" id="in-instructions" rows="3" placeholder="e.g. Keep the tail long, trim the paws, she hates the dryer">' + esc(W.intake.instructions || "") + "</textarea></div>" +
        '<div class="intake-tags">' +
          ["OK with clippers", "Needs muzzle", "Anxious", "Cat-friendly shampoo", "Oatmeal shampoo"].map((t) =>
            '<button type="button" class="tag-btn' + ((W.intake.tags || []).indexOf(t) !== -1 ? " on" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</button>"
          ).join("") + "</div>";
    } else if (g === "vet") {
      f = '<h3 class="sub">&#129658; Visit details</h3>' +
        '<div class="field"><label for="in-reason">Reason for the visit</label>' +
        '<textarea class="input" id="in-reason" rows="3" placeholder="e.g. Annual exam + limp on the back leg">' + esc(W.intake.reason || "") + "</textarea></div>" +
        '<label class="checkrow" style="margin-bottom:10px"><input type="checkbox" id="in-carrier"' + (W.intake.carrier ? " checked" : "") + ">" +
        "<span>I'll bring the carrier / leash</span></label>" +
        '<label class="checkrow"><input type="checkbox" id="in-fasted"' + (W.intake.fasted ? " checked" : "") + ">" +
        "<span>Pet has been fasted (needed for bloodwork)</span></label>";
    } else if (g === "sitting") {
      f = '<h3 class="sub">&#127968; Sitting details</h3>' +
        '<div class="field"><label for="in-food">Feeding &amp; care notes</label>' +
        '<textarea class="input" id="in-food" rows="3" placeholder="e.g. 1 cup kibble morning, medication at noon">' + esc(W.intake.food || "") + "</textarea></div>" +
        '<div class="intake-tags">' +
          ["Bringing own food", "Needs medication", "Crate-trained", "Separation anxiety", "No other pets"].map((t) =>
            '<button type="button" class="tag-btn' + ((W.intake.tags || []).indexOf(t) !== -1 ? " on" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</button>"
          ).join("") + "</div>" +
        '<div class="field" style="margin-top:12px"><label for="in-access">Access instructions</label>' +
        '<input class="input" id="in-access" type="text" placeholder="e.g. Key under the mat, code 4242" value="' + esc(W.intake.access || "") + '"></div>';
    } else {
      f = '<h3 class="sub">&#127893; Training details</h3>' +
        '<div class="field"><label for="in-goal">What do you want to work on?</label>' +
        '<textarea class="input" id="in-goal" rows="3" placeholder="e.g. Loose-leash walking and not barging through doors">' + esc(W.intake.goal || "") + "</textarea></div>" +
        '<div class="intake-tags">' +
          ["Reactive to dogs", "Fearful of strangers", "Escape artist", "Food-motivated", "Toy-motivated"].map((t) =>
            '<button type="button" class="tag-btn' + ((W.intake.tags || []).indexOf(t) !== -1 ? " on" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</button>"
          ).join("") + "</div>";
    }
    $("#intakeHost").innerHTML = f;
  }

  function collectIntake() {
    const svc = D.SERVICE_BY_ID[W.serviceId];
    const g = svc.group;
    const get = (id) => { const el = $(id); return el ? el.value : ""; };
    if (g === "grooming") W.intake.instructions = get("#in-instructions");
    if (g === "vet") { W.intake.reason = get("#in-reason"); W.intake.carrier = !!$("#in-carrier").checked; W.intake.fasted = !!$("#in-fasted").checked; }
    if (g === "sitting") { W.intake.food = get("#in-food"); W.intake.access = get("#in-access"); }
    if (g === "training") W.intake.goal = get("#in-goal");
  }

  function balanceDue() {
    const svc = D.SERVICE_BY_ID[W.serviceId];
    const o = D.currentOwner();
    /* Mirror createBooking: members get their plan discount. */
    const rate = o ? (D.PLAN_DISCOUNT[o.plan] || 0) : 0;
    const net = Math.round(svc.price * (1 - rate) * 100) / 100;
    const dep = svc.deposit ? Math.round(net * D.DEPOSIT_RATE * 100) / 100 : net;
    return { deposit: dep, remainder: Math.round((net - dep) * 100) / 100, net, rate };
  }

  function renderStep4() {
    const svc = D.SERVICE_BY_ID[W.serviceId];
    const pet = D.byId(D.db.pets, W.petId);
    const prov = D.PROVIDER_BY_ID[W.providerId];
    const o = D.currentOwner();
    const b = balanceDue();

    $("#wizSummary").innerHTML =
      '<div class="row"><span>Service</span><span><b>' + esc(svc.name) + "</b></span></div>" +
      '<div class="row"><span>Specialist</span><span>' + esc(prov.name) + "</span></div>" +
      '<div class="row"><span>When</span><span>' + D.fmtDate(W.date) + " at " + D.fmtTime(W.hour) + "</span></div>" +
      '<div class="row"><span>Pet</span><span>' + esc(pet ? pet.petName : "—") + " (" + esc(pet ? pet.species : "") + ")</span></div>" +
      (Object.keys(W.intake).length
        ? '<div class="row"><span>Notes</span><span style="max-width:60%;text-align:right">' + esc(JSON.stringify(W.intake)).slice(0, 180) + "</span></div>"
        : "") +
      '<div class="row"><span>Service total</span><span>' + money(svc.price) + "</span></div>" +
      (b.rate
        ? '<div class="row"><span>Member discount (' + Math.round(b.rate * 100) + '%)</span><span style="color:var(--ok)">&minus;' + money(Math.round(svc.price * b.rate * 100) / 100) + "</span></div>"
        : "") +
      '<div class="row"><span>Deposit today (30%)</span><span><b>' + money(b.deposit) + "</b></span></div>" +
      '<div class="row"><span>Balance at the visit</span><span>' + money(b.remainder) + "</span></div>" +
      '<div class="row total"><span>Charged now</span><span>' + money(b.deposit) + "</span></div>" +
      '<p class="tiny muted" style="margin:10px 0 0">Free cancellation up to 24 hours before. Demo checkout — no real card is charged.</p>';

    $("#acctGate").innerHTML = o
      ? '<p class="small muted" style="margin:14px 0 0">Booking as <b>' + esc(o.fullName) + "</b> · " + esc(o.email) + "</p>"
      : '<div class="warn-card" style="margin-top:16px">&#128274;<div><b>Sign in to finish.</b> You need a free account so we can attach the booking to your pet. ' +
        '<a href="membership.html#join" style="font-weight:700;text-decoration:underline">Create one in 30 seconds</a>.</div></div>';
  }

  function canNext() {
    if (W.step === 1) return !!W.serviceId;
    if (W.step === 2) return W.hour != null && !!W.providerId;
    if (W.step === 3) return !!W.petId;
    return true;
  }

  function refreshNext() {
    const n = $("#wizNext");
    if (!n) return;
    n.disabled = !canNext();
  }

  function startBooking(serviceId) {
    W.serviceId = serviceId;
    W.date = null; W.hour = null; W.providerId = null;
    gotoStep(2);
    refreshNext();
  }

  /* ---------------------------- events ------------------------------ */
  document.addEventListener("pnc:nav-ready", function () {
    renderStats();
    renderServices();
    renderProviders();
    renderQuickBook();
    renderStep1();
    refreshNext();

    /* hero title from CMS */
    const t = D.db.cms.heroTitle;
    if (t) $("#heroTitle").innerHTML = esc(t).replace("best friend", "<em>best friend</em>");

    /* group filter */
    $("#groupNav").addEventListener("click", function (e) {
      const b = e.target.closest("[data-group]");
      if (!b) return;
      activeGroup = b.dataset.group;
      renderServices();
    });

    /* open a service card's booking */
    document.addEventListener("click", function (e) {
      const b = e.target.closest("[data-book]");
      if (b) { startBooking(b.dataset.book); return; }
      const pb = e.target.closest("[data-provider-book]");
      if (pb) {
        const svc = D.db.services.find((s) => s.staff.indexOf(pb.dataset.providerBook) !== -1);
        if (svc) {
          startBooking(svc.id);
          W.providerId = pb.dataset.providerBook;
          renderStep2();
        }
      }
    });

    /* wizard */
    $("#groupNav");
    $("#wizNext").addEventListener("click", function () {
      if (!canNext()) { PNC.toast("Make a selection to continue", "err"); return; }
      if (W.step === 3) collectIntake();
      gotoStep(W.step + 1);
      refreshNext();
    });
    $("#wizBack").addEventListener("click", function () { gotoStep(W.step - 1); refreshNext(); });

    $("#pickService").addEventListener("click", function (e) {
      const b = e.target.closest("[data-pick]");
      if (!b) return;
      W.serviceId = b.dataset.pick;
      W.date = null; W.hour = null; W.providerId = null;
      $$("#pickService .pick").forEach((x) => x.classList.toggle("on", x === b));
      refreshNext();
    });

    $("#datePills").addEventListener("click", function (e) {
      const b = e.target.closest("[data-date]");
      if (!b || b.disabled) return;
      W.date = b.dataset.date;
      W.hour = null; W.providerId = null;
      $("#wizDate").value = W.date;
      datePills();
      renderSlots();
      refreshNext();
    });

    $("#wizDate").addEventListener("change", function (e) {
      W.date = e.target.value || D.todayISO();
      W.hour = null; W.providerId = null;
      datePills();
      renderSlots();
      refreshNext();
    });

    $("#slotHost").addEventListener("click", function (e) {
      const b = e.target.closest("[data-slot]");
      if (!b || b.disabled) return;
      W.hour = Number(b.dataset.slot);
      W.providerId = b.dataset.provider;
      $$("#slotHost .slot").forEach((x) => x.classList.toggle("on", x === b));
      refreshNext();
    });

    $("#petHost").addEventListener("click", function (e) {
      const b = e.target.closest("[data-pet]");
      if (!b) return;
      W.petId = b.dataset.pet;
      $$("#petHost .pick").forEach((x) => x.classList.toggle("on", x === b));
      const pet = D.byId(D.db.pets, W.petId);
      $("#vaxWarn2").innerHTML = vaxWarningHTML(pet, D.SERVICE_BY_ID[W.serviceId]);
      refreshNext();
    });

    $("#intakeHost").addEventListener("click", function (e) {
      const t = e.target.closest("[data-tag]");
      if (!t) return;
      W.intake.tags = W.intake.tags || [];
      const i = W.intake.tags.indexOf(t.dataset.tag);
      if (i === -1) W.intake.tags.push(t.dataset.tag); else W.intake.tags.splice(i, 1);
      t.classList.toggle("on");
    });

    $("#wizConfirm").addEventListener("click", async function () {
      const o = D.currentOwner();
      if (!o) { PNC.toast("Sign in to complete this booking", "err"); window.location.href = "membership.html#join"; return; }
      collectIntake();
      const r = await Promise.resolve(D.createBooking({
        serviceId: W.serviceId,
        petId: W.petId,
        date: W.date,
        hour: W.hour,
        providerId: W.providerId,
        intake: W.intake
      }));
      if (r.error) { PNC.toast(r.error, "err"); return; }
      const bk = r.booking;
      const svc = D.SERVICE_BY_ID[bk.serviceId];
      PNC.toast("Booked! " + svc.name + " on " + D.fmtDate(bk.date));
      if (window.PNC_NAV) window.PNC_NAV.renderBell();
      gotoStep(1);
      W.serviceId = null; W.petId = null; W.hour = null; W.providerId = null; W.intake = {};
      renderStep1();
      renderQuickBook();
      setTimeout(function () { window.location.href = "account.html#bookings"; }, 900);
    });

    /* quick book */
    $("#qbGo").addEventListener("click", function () {
      const sid = $("#qbService").value;
      const pid = $("#qbPet").value;
      const date = D.firstOpenDate(D.db, sid);
      const open = D.slotsFor(D.db, sid, date).filter((s) => s.available);
      const msg = $("#qbMsg");
      if (!open.length) {
        msg.style.color = "var(--yellow-600)";
        msg.textContent = "No open slots in the next 60 days — try the waitlist.";
        return;
      }
      const first = open[0];
      msg.style.color = "var(--ok)";
      msg.innerHTML = "Next opening: <b>" + D.fmtDate(date) + " at " + D.fmtTime(first.hour) + "</b> with " +
        esc(D.PROVIDER_BY_ID[first.providerId].name) + ".";
      W.serviceId = sid;
      W.date = date;
      W.hour = first.hour;
      W.providerId = first.providerId;
      W.petId = pid || null;
      gotoStep(4);
      refreshNext();
    });

    /* quick add-pet modal */
    $("#quickPetForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const o = D.currentOwner();
      if (!o) { PNC.toast("Create an account first", "err"); window.location.href = "membership.html#join"; return; }
      const name = $("#qp-name").value.trim();
      if (name.length < 1) { PNC.toast("Give your pet a name", "err"); return; }
      const r = await Promise.resolve(D.addPet(o.id, {
        petName: name,
        species: $("#qp-species").value || "Dog",
        breed: $("#qp-breed").value.trim(),
        dob: $("#qp-dob").value || ""
      }));
      if (r && r.error) { PNC.toast(r.error, "err"); return; }
      PNC.toast(name + " added to your account 🐾");
      PNC.closeModal("petModal");
      e.target.reset();
      refreshQBPets();
      if (W.step === 3) renderStep3();
    });

    /* species dropdown */
    $("#qp-species").innerHTML = D.SPECIES.map((s) => "<option>" + s + "</option>").join("");

    document.addEventListener("pnc:auth", function () {
      refreshQBPets();
      if (W.step === 3) renderStep3();
      if (W.step === 4) renderStep4();
    });
  });
})();
