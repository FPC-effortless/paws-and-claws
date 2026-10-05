/* ============================================================
   Paws & Claws — Member Portal controller
   Tabs: Overview / Pets / Bookings / Orders / Inbox / Payment / Settings
   Gates on PNC_DB auth; everything persists.
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.PNC_DB;
  const PNC = window.PNC;

  let tab = 'overview';
  let vaxPetId = null;
  let editingPetId = null;

  function me() { return D.currentOwner(); }
  function pets() { return D.petsOf(me().id); }
  function bookings() { return D.bookingsOf(me().id); }
  function orders() { return D.ordersOf(me().id); }
  function messages() { return (D.db.messages || []).filter(m => m.ownerId === me().id); }
  function cards() { return (D.db.payments || []).filter(p => p.ownerId === me().id); }

  const PLAN_LABEL = { puppy: 'Puppy Pass', adult: 'Adult Adventurer', senior: 'Senior Snuggler' };
  const PLAN_DISCOUNT = { puppy: '5%', adult: '15%', senior: '25%' };

  /* ================= gate (auth) ================= */
  function showGate() {
    $('#acctGate').style.display = '';
    $('#acctApp').style.display = 'none';
  }

  function showApp() {
    $('#acctGate').style.display = 'none';
    $('#acctApp').style.display = '';
    renderAll();
  }

  function syncView() {
    const m = me();
    if (!m) showGate(); else showApp();
  }

  /* ------------------- Clerk gate ------------------- */
  /* REPLACE mode: when Clerk is active the gate IS Clerk's
     <SignIn/>. The local forms are hidden, and sign-out goes through
     Clerk. Without a publishable key the site is in DEMO MODE and
     the local forms stay as the documented demo path. */
  function mountClerkGate() {
    const ck = window.PNC_CLERK;
    const holder = $('#clerkMemberHolder');
    if (!holder) return;
    if (!ck || !ck.active) { holder.hidden = true; return; }
    holder.hidden = false;
    ck.mountSignIn(holder, {
      appearance: { elements: { rootBox: 'width:100%' } }
    });
    const gate = $('#acctGate');
    if (gate) {
      /* Keep the tab UI but hide the local forms, which Clerk has
         replaced. */
      $$('.gate-form', gate).forEach(f => f.style.display = 'none');
      $$('.gate-tab', gate).forEach(t => t.style.display = 'none');
    }
    /* Clerk sessions change asynchronously; re-evaluate the gate on
       every state change so a completed sign-in flips to the app. */
    if (ck.clerk && ck.clerk.addListener) {
      ck.clerk.addListener(function () { syncView(); });
    }
  }

  function setGate(which) {
    $$('.gate-tab').forEach(b => {
      const on = b.dataset.gate === which;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#signInForm').style.display = which === 'signIn' ? '' : 'none';
    $('#signUpForm').style.display = which === 'signUp' ? '' : 'none';
  }

  async function doSignIn(e) {
    e.preventDefault();
    const email = $('#siEmail').value;
    const pw = $('#siPw').value;
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      /* When the optional Convex backend is connected the server owns
         the password hashes, so verify against it; otherwise fall
         back to the local store. */
      const res = D.logInRemote && (await D.logInRemote(email, pw)) || D.logIn(email, pw);
      if (res.error) { PNC.toast(res.error, 'err'); $('#siPw').focus(); return; }
      PNC.toast('Welcome back, ' + res.owner.fullName.split(' ')[0]);
      window.dispatchEvent(new CustomEvent('pnc:auth'));
      syncView();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function doSignUp(e) {
    e.preventDefault();
    const res = D.signUp({
      fullName: $('#suName').value,
      email: $('#suEmail').value,
      password: $('#suPw').value,
      phone: $('#suPhone').value,
      petName: $('#suPet').value
    });
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    PNC.toast('Account created — welcome to Paws & Claws!');
    window.dispatchEvent(new CustomEvent('pnc:auth'));
    syncView();
  }

  /* ================= tabs ================= */
  function setTab(t) {
    tab = t;
    $$('.acct-tab').forEach(b => {
      const on = b.dataset.tab === t;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.acct-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === t);
    });
    renderTab(t);
    const h = window.location.hash.split('?')[0];
    if (h !== '#' + t) history.replaceState(null, '', '#' + t);
  }

  /* ================= overview ================= */
  function renderOverview() {
    const m = me();
    const up = bookings().filter(b => b.status !== 'cancelled' && b.date >= D.todayISO());
    const open = orders().filter(o => o.status === 'open');
    const inbox = messages().filter(x => !x.read && x.direction === 'in');
    const ps = pets();

    $('#panelOverview').innerHTML =
      '<div class="acct-hero">' +
        '<div class="avatar">' + D.initials(m.fullName) + '</div>' +
        '<div><h2>' + D.esc(m.fullName) + '</h2><p>' + D.esc(m.email) + '</p></div>' +
        '<span class="status-pill available" style="margin-left:auto;align-self:center">' +
          PLAN_LABEL[m.plan] || 'Member' + '</span>' +
      '</div>' +
      '<div class="stat-row">' +
        statBox(D.speciesIcon(ps[0] ? ps[0].species : 'Dog'), ps.length, 'pets in your family') +
        statBox('&#128197;', up.length, 'upcoming appointments') +
        statBox('&#128722;', open.length, 'open orders') +
        statBox('&#128236;', inbox.length, 'unread messages') +
      '</div>' +
      '<div class="panel">' +
        '<h3>Next up</h3>' +
        (up.length
          ? up.slice(0, 3).map(nextRow).join('')
          : '<p class="muted">Nothing booked yet. <a class="teal" href="services.html">Book an appointment &rarr;</a></p>') +
      '</div>' +
      '<div class="panel">' +
        '<h3>Member perks</h3>' +
        '<div class="perk-row">' +
          '<div class="perk"><span class="perk-ico">&#128375;</span><div><strong>' +
            PLAN_DISCOUNT[m.plan] + ' off everything</strong><small>Applied automatically at checkout</small></div></div>' +
          '<div class="perk"><span class="perk-ico">&#128666;</span><div><strong>' +
            'Free delivery, no minimum' +
            '</strong><small>Within Riverton and nearby</small></div></div>' +
          '<div class="perk"><span class="perk-ico">&#129389;</span><div><strong>Birthday treat box</strong>' +
            '<small>Every pet, every year</small></div></div>' +
        '</div>' +
        '<a class="btn btn-ghost btn-sm" href="membership.html">Compare plans</a>' +
      '</div>';
  }

  function statBox(ico, n, label) {
    return '<div class="stat-box"><span class="stat-ico">' + ico + '</span><span><strong>' +
      n + '</strong><small>' + label + '</small></span></div>';
  }

  function nextRow(b) {
    const s = D.SERVICE_BY_ID[b.serviceId] || {};
    const p = D.db.pets.find(x => x.id === b.petId);
    return '<div class="slot-mini"><b>' + D.fmtDate(b.date) + ' &middot; ' + D.fmtTime(b.hour) +
      '</b><span class="pet">' + D.esc(s.name || 'Appointment') + '</span><span class="pet">' +
      D.esc(p ? p.petName : '') + '</span><span class="note">' + D.titleCase(b.status || 'confirmed') +
      '</span></div>';
  }

  /* ================= pets ================= */
  function renderPets() {
    const ps = pets();
    $('#panelPets').innerHTML =
      '<div class="panel-head">' +
        '<h3>Your pet family</h3>' +
        '<button type="button" class="btn btn-teal btn-sm" id="addPetBtn">&#43; Add a pet</button>' +
      '</div>' +
      (ps.length
        ? '<div class="pet-tile-grid">' + ps.map(petTile).join('') + '</div>'
        : '<div class="empty-card"><h3>No pets yet</h3><p>Add your first pet to unlock booking, ' +
          'vaccine records and personalized care notes.</p>' +
          '<button type="button" class="btn btn-primary" id="addPetBtn2">&#43; Add a pet</button></div>');
  }

  function petTile(p) {
    const vax = p.vaccines || [];
    const ok = D.vaccinesOk(p);
    return '<article class="pet-tile" data-id="' + p.id + '">' +
      '<div class="pet-tile-art">' + D.speciesIcon(p.species) + '</div>' +
      '<div class="pet-tile-body">' +
        '<h3>' + D.esc(p.petName) + '</h3>' +
        '<p class="muted small">' + D.esc(p.breed || D.titleCase(p.species)) + ' &middot; ' +
          D.petAge(p) + ' &middot; ' + D.esc(p.sex) + '</p>' +
        '<div class="kv-row">' +
          '<span>Weight</span><span>' + (p.weightKg ? p.weightKg + ' kg' : '—') + '</span></div>' +
        '<div class="kv-row"><span>Microchip</span><span>' + D.esc(p.microchip || 'Not recorded') + '</span></div>' +
        '<div class="kv-row"><span>Coat</span><span>' + D.esc(p.coat || '—') + '</span></div>' +
        '<div class="kv-row"><span>Vaccines</span><span>' +
          (ok.ok ? '<span class="status-pill available">Up to date</span>'
                 : '<span class="status-pill reserved">' + (ok.missing.length) + ' due</span>') +
          '</span></div>' +
        '<div class="vax-table">' +
          (vax.length ? vax.map(function (v, i) {
            return '<div class="vax-row"><span>' + D.esc(v.name) + '</span>' +
              '<span class="muted small">' + D.fmtDate(v.date) + '</span>' +
              '<span class="status-pill ' + (v.status === 'approved' ? 'available' : 'reserved') +
                '">' + D.titleCase(v.status) + '</span>' +
              '<button type="button" class="btn btn-ghost btn-sm vax-add" data-vax="' + p.id +
                '" data-name="' + D.esc(v.name) + '">Re-upload</button></div>';
          }).join('') : '<p class="muted small">No records on file yet.</p>') +
        '</div>' +
        '<div class="pet-tile-actions">' +
          '<button type="button" class="btn btn-teal btn-sm vax-add" data-vax="' + p.id + '">&#129529; Upload vaccine</button>' +
          '<button type="button" class="btn btn-ghost btn-sm pet-edit" data-pet="' + p.id + '">Edit</button>' +
          '<button type="button" class="btn btn-ghost btn-sm pet-rm" data-pet="' + p.id + '">Remove</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function openPetModal(id) {
    editingPetId = id || null;
    const p = id ? D.db.pets.find(x => x.id === id) : null;
    $('#petModalTitle').textContent = p ? 'Edit ' + p.petName : 'Add a pet';
    $('#pfName').value = p ? p.petName : '';
    $('#pfSpecies').value = p ? p.species : 'Dog';
    $('#pfBreed').value = p ? p.breed : '';
    $('#pfDob').value = p ? p.dob : '';
    $('#pfSex').value = p ? p.sex : 'Male';
    $('#pfAltered').value = p ? p.altered : 'Intact';
    $('#pfWeight').value = p ? p.weightKg : '';
    $('#pfChip').value = p ? p.microchip : '';
    $('#pfNotes').value = p ? (p.notes || '') : '';
    PNC.openModal('petModal');
  }

  function savePet(e) {
    e.preventDefault();
    const name = $('#pfName').value.trim();
    if (name.length < 1) { PNC.toast('Give your pet a name', 'err'); return; }
    const input = {
      petName: name,
      species: $('#pfSpecies').value,
      breed: $('#pfBreed').value.trim(),
      dob: $('#pfDob').value,
      sex: $('#pfSex').value,
      altered: $('#pfAltered').value,
      weightKg: Number($('#pfWeight').value) || 0,
      microchip: $('#pfChip').value.trim(),
      notes: $('#pfNotes').value.trim()
    };
    const res = editingPetId
      ? D.updatePet(editingPetId, input)
      : D.addPet(me().id, input);
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    PNC.closeModal();
    PNC.toast(editingPetId ? 'Pet profile updated' : name + ' added to your family');
    window.dispatchEvent(new CustomEvent('pnc:auth'));
    renderTab('pets');
  }

  function removePet(id) {
    const p = D.db.pets.find(x => x.id === id);
    if (!p) return;
    if (!window.confirm('Remove ' + p.petName + ' from your family? Any upcoming appointments are cancelled automatically.')) return;
    D.removePet(id);
    PNC.toast(p.petName + ' removed');
    renderTab('pets');
    renderBellBadge();
  }

  function openVaxModal(petId, presetName) {
    const p = D.db.pets.find(x => x.id === petId);
    if (!p) return;
    vaxPetId = petId;
    $('#vaxPetName').textContent = 'For ' + p.petName + ' — ' + (p.breed || p.species);
    $('#vfName').value = presetName || $('#vfName').options[0].value;
    $('#vfDate').value = '';
    $('#vfLot').value = '';
    PNC.openModal('vaxModal');
  }

  function saveVax(e) {
    e.preventDefault();
    if (!vaxPetId) return;
    const date = $('#vfDate').value;
    if (!date) { PNC.toast('Pick the administration date', 'err'); return; }
    const res = D.addVaccine(vaxPetId, $('#vfName').value, date, $('#vfLot').value.trim());
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    PNC.closeModal();
    PNC.toast('Vaccine record submitted for review');
    renderTab('pets');
    vaxPetId = null;
  }

  /* ================= bookings ================= */
  function renderBookings() {
    const all = bookings().slice().sort((a, b) => (b.date + b.hour) - (a.date + a.hour));
    $('#panelBookings').innerHTML =
      '<div class="panel-head"><h3>Appointments</h3>' +
      '<a class="btn btn-teal btn-sm" href="services.html">&#43; Book a visit</a></div>' +
      (all.length ? all.map(bookingRow).join('') : emptyBlock(
        'No appointments yet', 'Book grooming, a vet visit, sitting or training in under a minute.',
        'services.html', 'Book an appointment'));
  }

  function bookingRow(b) {
    const s = D.SERVICE_BY_ID[b.serviceId] || {};
    const p = D.db.pets.find(x => x.id === b.petId);
    const prov = D.PROVIDER_BY_ID[b.providerId] || {};
    const past = b.date < D.todayISO();
    const st = b.status || 'confirmed';
    return '<div class="timeline-row">' +
      '<div class="timeline-date"><b>' + D.fmtDate(b.date) + '</b><small>' + D.fmtTime(b.hour) +
        '</small></div>' +
      '<div class="timeline-main">' +
        '<h4>' + D.esc(s.name || 'Appointment') + ' &middot; <span class="muted">' +
          D.money(s.price || 0) + '</span></h4>' +
        '<p class="muted small">' + D.esc(p ? p.petName : 'No pet') + ' &middot; ' +
          D.esc(prov.name || 'Any available provider') + ' &middot; ' + D.esc(b.id) + '</p>' +
        (b.notes ? '<p class="small">' + D.esc(b.notes) + '</p>' : '') +
        '<div class="timeline-actions">' +
          '<span class="status-pill ' + (st === 'cancelled' ? 'sold' : st === 'completed' ? 'reserved' : 'available') +
            '">' + D.titleCase(st) + '</span>' +
          (past || st === 'cancelled' ? '' :
            '<button type="button" class="btn btn-ghost btn-sm" data-resched="' + b.id + '">Reschedule</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-cancel="' + b.id + '">Cancel</button>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function cancelBooking(id) {
    const b = D.db.bookings.find(x => x.id === id);
    if (!b) return;
    if (!window.confirm('Cancel this appointment? A 30% deposit hold may apply.')) return;
    const res = D.cancelBooking(id);
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    PNC.toast('Appointment cancelled');
    renderTab('bookings');
    renderBellBadge();
  }

  function rescheduleBooking(id) {
    const b = D.db.bookings.find(x => x.id === id);
    if (!b) return;
    const d = window.prompt('New date (YYYY-MM-DD):', D.addDays(2));
    if (!d) return;
    const h = window.prompt('New time (e.g. 9, 9.5, 14):', String(b.hour));
    const hour = Number(h);
    if (!hour) { PNC.toast('Time must be a number like 9 or 9.5', 'err'); return; }
    const res = D.rescheduleBooking(id, d, hour);
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    PNC.toast('Moved to ' + D.fmtDate(d) + ' at ' + D.fmtTime(hour));
    renderTab('bookings');
    renderBellBadge();
  }

  /* ================= orders ================= */
  function renderOrders() {
    const all = orders().slice().sort((a, b) => b.placedAt.localeCompare(a.placedAt));
    $('#panelOrders').innerHTML =
      '<div class="panel-head"><h3>Order history</h3>' +
      '<a class="btn btn-teal btn-sm" href="shop.html">&#128722; Shop again</a></div>' +
      (all.length ? all.map(orderRow).join('') : emptyBlock(
        'No orders yet', 'Food, toys, grooming gear and more — members save up to 25%.',
        'shop.html', 'Browse the shop'));
  }

  function orderRow(o) {
    const lines = (o.items || []).map(function (i) {
      const p = D.PRODUCT_BY_ID[i.productId];
      return '<div class="ord-line"><span>' + D.esc(p ? p.name : i.productId) +
        '</span><span class="muted small">&times;' + i.qty + '</span><span>' +
        D.money(i.price * i.qty) + '</span></div>';
    }).join('');
    const stage = o.stage || o.status || 'pending';
    return '<div class="order-card">' +
      '<div class="order-head">' +
        '<div><b>' + D.esc(o.id) + '</b><span class="muted small"> &middot; ' +
          D.fmtDate(o.placedAt) + ' &middot; ' + D.titleCase(o.fulfillment) + '</span></div>' +
        '<span class="status-pill ' + (stage === 'done' || stage === 'delivered' ? 'available' :
          stage === 'cancelled' ? 'sold' : 'reserved') + '">' + D.titleCase(stage) + '</span>' +
      '</div>' +
      lines +
      '<div class="order-foot"><span>Total</span><b>' + D.money(o.total) + '</b>' +
        '<span class="muted small">paid ' + D.money(o.paid) + ' via ' + D.esc(o.method || 'card') +
          '</span></div>' +
    '</div>';
  }

  /* ================= inbox ================= */
  function renderInbox() {
    const all = messages().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    $('#panelInbox').innerHTML =
      '<div class="panel-head"><h3>Messages</h3>' +
      '<a class="btn btn-ghost btn-sm" href="contact.html">Contact us</a></div>' +
      (all.length ? all.map(msgRow).join('') : emptyBlock(
        'Inbox is empty', 'Booking confirmations, order updates and care reminders land here.',
        'contact.html', 'Send us a message'));
  }

  function msgRow(m) {
    return '<div class="msg-row' + (m.read ? '' : ' unread') + '">' +
      '<span class="msg-ico">' + (m.direction === 'in' ? '&#128172;' : '&#128233;') + '</span>' +
      '<div class="msg-main"><b>' + D.esc(m.subject || '(no subject)') + '</b>' +
        '<small>' + D.titleCase(m.channel || 'email') + ' &middot; ' + D.fmtDate(m.createdAt) + '</small>' +
        '<p>' + D.esc(m.body) + '</p></div>' +
      '<span class="status-pill ' + (m.read ? 'sold' : 'available') + '">' +
        (m.read ? 'Read' : 'New') + '</span>' +
    '</div>';
  }

  /* ================= payment ================= */
  function renderPayment() {
    const cs = cards();
    $('#panelPayment').innerHTML =
      '<div class="panel-head"><h3>Payment methods</h3>' +
      '<button type="button" class="btn btn-teal btn-sm" id="addCardBtn">&#43; Add a card</button></div>' +
      (cs.length ? '<div class="pay-grid">' + cs.map(cardRow).join('') + '</div>'
        : '<div class="empty-card"><h3>No cards on file</h3>' +
          '<p>Add a card for one-tap checkout and automatic member discounts.</p></div>') +
      '<form id="cardForm" class="pay-form" style="display:none;margin-top:18px" novalidate>' +
        '<div class="grid2">' +
          '<div class="field"><label for="cfBrand">Brand</label>' +
            '<select class="input" id="cfBrand"><option>Visa</option><option>Mastercard</option>' +
            '<option>Amex</option><option>Discover</option></select></div>' +
          '<div class="field"><label for="cfLast4">Last 4 digits</label>' +
            '<input class="input" id="cfLast4" type="text" inputmode="numeric" maxlength="4" placeholder="4242" required></div>' +
          '<div class="field"><label for="cfM">Expiry month</label>' +
            '<input class="input" id="cfM" type="number" min="1" max="12" placeholder="09" required></div>' +
          '<div class="field"><label for="cfY">Expiry year</label>' +
            '<input class="input" id="cfY" type="number" min="2026" max="2040" placeholder="2029" required></div>' +
        '</div>' +
        '<button class="btn btn-primary" type="submit">Save card</button>' +
        '<p class="cart-note">Demo only — no card data is stored or transmitted.</p>' +
      '</form>';
  }

  function cardRow(c) {
    return '<div class="pay-card' + (c.primary ? ' primary' : '') + '">' +
      '<div class="pay-card-top"><span class="pay-brand">' + D.esc(c.brand) + '</span>' +
        (c.primary ? '<span class="status-pill available">Primary</span>' : '') + '</div>' +
      '<div class="pay-num">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; ' +
        D.esc(c.last4) + '</div>' +
      '<div class="pay-exp">Expires ' + String(c.expMonth).padStart(2, '0') + '/' + c.expYear + '</div>' +
      '<div class="pay-actions">' +
        (c.primary ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-primary="' + c.id +
          '">Make primary</button>') +
        '<button type="button" class="btn btn-ghost btn-sm" data-rmcard="' + c.id + '">Remove</button>' +
      '</div>' +
    '</div>';
  }

  function saveCard(e) {
    e.preventDefault();
    const last4 = $('#cfLast4').value.trim();
    if (!/^\d{4}$/.test(last4)) { PNC.toast('Enter the last 4 digits', 'err'); return; }
    D.addPaymentMethod(me().id, $('#cfBrand').value, last4,
      Number($('#cfM').value), Number($('#cfY').value));
    PNC.toast('Card added');
    renderTab('payment');
  }

  /* ================= settings ================= */
  function renderSettings() {
    const m = me();
    $('#panelSettings').innerHTML =
      '<div class="panel">' +
        '<h3>Profile</h3>' +
        '<form id="profileForm" novalidate>' +
          '<div class="grid2">' +
            '<div class="field"><label for="stName">Full name</label>' +
              '<input class="input" id="stName" type="text" value="' + D.esc(m.fullName) + '" required></div>' +
            '<div class="field"><label for="stEmail">Email</label>' +
              '<input class="input" id="stEmail" type="email" value="' + D.esc(m.email) + '" required></div>' +
            '<div class="field"><label for="stPhone">Phone</label>' +
              '<input class="input" id="stPhone" type="tel" value="' + D.esc(m.phone || '') + '"></div>' +
            '<div class="field"><label for="stEmerg">Emergency contact</label>' +
              '<input class="input" id="stEmerg" type="text" value="' + D.esc(m.emergencyContact || '') +
                '" placeholder="Name and phone"></div>' +
          '</div>' +
          '<div class="field"><label for="stAddr">Delivery address</label>' +
            '<input class="input" id="stAddr" type="text" value="' + D.esc(m.address || '') +
              '" placeholder="Street, city, ZIP"></div>' +
          '<button class="btn btn-primary" type="submit">Save profile</button>' +
        '</form>' +
      '</div>' +
      '<div class="panel">' +
        '<h3>Membership plan</h3>' +
        '<div class="plan-row">' +
          '<span><b>' + PLAN_LABEL[m.plan] + '</b><br><span class="muted small">' +
            PLAN_DISCOUNT[m.plan] + ' off everything</span></span>' +
          '<a class="btn btn-ghost btn-sm" href="membership.html">Change plan</a>' +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<h3>Danger zone</h3>' +
        '<button type="button" class="btn btn-ghost" id="signOutBtn">Sign out</button>' +
      '</div>';
  }

  function saveProfile(e) {
    e.preventDefault();
    const res = D.updateOwner(me().id, {
      fullName: $('#stName').value.trim(),
      email: $('#stEmail').value.trim(),
      phone: $('#stPhone').value.trim(),
      emergencyContact: $('#stEmerg').value.trim(),
      address: $('#stAddr').value.trim()
    });
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    PNC.toast('Profile saved');
    window.dispatchEvent(new CustomEvent('pnc:auth'));
    renderAll();
  }

  /* ================= shared bits ================= */
  function emptyBlock(title, body, href, cta) {
    return '<div class="empty-card"><h3>' + title + '</h3><p>' + body + '</p>' +
      '<a class="btn btn-primary" href="' + href + '">' + cta + '</a></div>';
  }

  function renderBellBadge() {
    if (window.PNC_NAV && window.PNC_NAV.renderBell) window.PNC_NAV.renderBell();
  }

  function renderTab(t) {
    if (t === 'overview') renderOverview();
    else if (t === 'pets') renderPets();
    else if (t === 'bookings') renderBookings();
    else if (t === 'orders') renderOrders();
    else if (t === 'inbox') renderInbox();
    else if (t === 'payment') renderPayment();
    else if (t === 'settings') renderSettings();
  }

  function renderAll() {
    const m = me();
    if (!m) return;
    $('#acctHello').textContent = 'Hi, ' + m.fullName.split(' ')[0];
    $('#acctSub').textContent = pets().length + ' pet' + (pets().length === 1 ? '' : 's') +
      ' · ' + bookings().length + ' appointments · ' + PLAN_LABEL[m.plan];
    const unread = messages().filter(x => !x.read && x.direction === 'in').length;
    const badge = $('#inboxBadge');
    badge.hidden = !unread;
    badge.textContent = String(unread);
    renderTab(tab);
  }

  /* ================= init ================= */
  function init() {
    /* gate tabs */
    $$('.gate-tab').forEach(b => b.addEventListener('click', () => setGate(b.dataset.gate)));
    $('#signInForm').addEventListener('submit', doSignIn);
    $('#signUpForm').addEventListener('submit', doSignUp);

    /* main tabs */
    $$('.acct-tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

    /* account-level actions */
    $('#acctLogout').addEventListener('click', async function () {
      await D.logOut();
      window.dispatchEvent(new CustomEvent('pnc:auth'));
      PNC.toast('Signed out');
      syncView();
    });

    /* select options */
    $('#pfSpecies').innerHTML = D.SPECIES.map(s => '<option>' + s + '</option>').join('');
    $('#pfSex').innerHTML = D.SEXES.map(s => '<option>' + s + '</option>').join('');
    $('#pfAltered').innerHTML = D.ALTERED.map(s => '<option>' + s + '</option>').join('');
    $('#vfName').innerHTML = D.VACCINES.map(v => '<option>' + v + '</option>').join('');

    /* forms */
    $('#petForm').addEventListener('submit', savePet);
    $('#vaxForm').addEventListener('submit', saveVax);

    /* delegated panel clicks */
    document.addEventListener('click', function (e) {
      const addBtn = e.target.closest('#addPetBtn, #addPetBtn2');
      if (addBtn) { openPetModal(null); return; }
      const edit = e.target.closest('.pet-edit');
      if (edit) { openPetModal(edit.dataset.pet); return; }
      const rm = e.target.closest('.pet-rm');
      if (rm) { removePet(rm.dataset.pet); return; }
      const vx = e.target.closest('.vax-add');
      if (vx) { openVaxModal(vx.dataset.vax, vx.dataset.name); return; }
      const cx = e.target.closest('[data-cancel]');
      if (cx) { cancelBooking(cx.dataset.cancel); return; }
      const rs = e.target.closest('[data-resched]');
      if (rs) { rescheduleBooking(rs.dataset.resched); return; }
      const addCard = e.target.closest('#addCardBtn');
      if (addCard) {
        const f = $('#cardForm');
        f.style.display = f.style.display === 'none' ? '' : 'none';
        return;
      }
      const prim = e.target.closest('[data-primary]');
      if (prim) { D.setPrimaryPayment(prim.dataset.primary); PNC.toast('Primary card updated'); renderTab('payment'); return; }
      const rmc = e.target.closest('[data-rmcard]');
      if (rmc) { D.removePaymentMethod(rmc.dataset.rmcard); PNC.toast('Card removed'); renderTab('payment'); return; }
      const so = e.target.closest('#signOutBtn');
      if (so) {
        D.logOut().then(function () {
          window.dispatchEvent(new CustomEvent('pnc:auth'));
          PNC.toast('Signed out');
          syncView();
        });
        return;
      }
    });

    $('#profileForm') && null;
    document.addEventListener('submit', function (e) {
      if (e.target.id === 'profileForm') saveProfile(e);
      else if (e.target.id === 'cardForm') saveCard(e);
    });

    window.addEventListener('pnc:auth', function () {
      if (me()) { showApp(); } else { showGate(); }
    });

    /* deep link: account.html#bookings */
    const h = window.location.hash.replace('#', '');
    if (h && ['overview', 'pets', 'bookings', 'orders', 'inbox', 'payment', 'settings'].indexOf(h) !== -1) {
      tab = h;
    }
    mountClerkGate();
    /* Clerk loads asynchronously; re-mount the gate and re-evaluate
       the view once it reports ready. */
    window.addEventListener('pnc:clerk', function () {
      mountClerkGate();
      syncView();
      if (me()) setTab(tab);
    });
    syncView();
    if (me()) setTab(tab);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();