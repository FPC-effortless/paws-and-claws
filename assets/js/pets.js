/* ============================================================
   Paws & Claws — Pet Marketplace controller
   Facets: species / status / sex / price / temperament
   Listings with health records, pedigree and inquiry flow.
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.PNC_DB;
  const PNC = window.PNC;

  const state = {
    species: new Set(),
    status: new Set(),
    sex: new Set(),
    temps: new Set(),
    maxPrice: null,
    sort: 'new'
  };

  let inqId = null;

  function listings() { return D.catalogReady() ? D.db.listings : []; }
  function member() { return D.currentOwner(); }

  function ageLabel(m) {
    if (m < 12) return m + (m === 1 ? ' month' : ' months');
    const y = Math.floor(m / 12), r = m % 12;
    return y + (y === 1 ? ' yr' : ' yrs') + (r ? ' ' + r + 'mo' : '');
  }

  function applied() {
    const out = [];
    state.species.forEach(v => out.push({ k: 'species', v: v, label: D.speciesIcon(v) + ' ' + v }));
    state.status.forEach(v => out.push({ k: 'status', v: v, label: D.titleCase(v) }));
    state.sex.forEach(v => out.push({ k: 'sex', v: v, label: v }));
    state.temps.forEach(v => out.push({ k: 'temps', v: v, label: v }));
    if (state.maxPrice !== null) out.push({ k: 'price', v: state.maxPrice, label: 'Up to ' + D.money(state.maxPrice) });
    return out;
  }

  /* ---------- facets ---------- */
  function buildFacets() {
    const sp = Array.from(new Set(listings().map(l => l.species))).sort();
    $('#fSpecies').innerHTML = sp.map(s =>
      '<button type="button" class="f-chip" data-f="species" data-v="' + D.esc(s) + '">' +
      D.speciesIcon(s) + ' ' + D.esc(s) + '</button>').join('');

    const st = ['available', 'reserved'];
    $('#fStatus').innerHTML = st.map(s => {
      const n = listings().filter(l => l.status === s).length;
      return '<button type="button" class="f-chip" data-f="status" data-v="' + s + '">' +
        D.titleCase(s) + ' <span class="f-n">' + n + '</span></button>';
    }).join('');

    const sx = Array.from(new Set(listings().map(l => l.sex))).sort();
    $('#fSex').innerHTML = sx.map(s =>
      '<button type="button" class="f-chip" data-f="sex" data-v="' + D.esc(s) + '">' +
      D.esc(s) + '</button>').join('');

    const temps = Array.from(new Set(listings().flatMap(l => l.temperament || []))).sort();
    $('#fTemp').innerHTML = temps.map(t =>
      '<button type="button" class="f-chip" data-f="temps" data-v="' + D.esc(t) + '">' +
      D.esc(t) + '</button>').join('');

    const top = Math.max(1, ...listings().map(l => l.price));
    const r = $('#petPriceRange');
    if (r) { r.max = String(top); r.value = String(top); }
    state.maxPrice = null;
    const ro = $('#petPriceReadout');
    if (ro) ro.textContent = 'Any price';
  }

  function syncFacets() {
    $$('.f-chip').forEach(b => {
      const on = state[b.dataset.f] && state[b.dataset.f].has(b.dataset.v);
      b.classList.toggle('active', !!on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderChips() {
    const a = applied();
    $('#petChips').innerHTML = a.length
      ? a.map(x => '<button type="button" class="chip" data-rk="' + x.k + '" data-rv="' +
          D.esc(String(x.v)) + '">' + D.esc(x.label) + ' &times;</button>').join('')
      : '<span class="chip chip-muted">No filters yet — showing all available pets</span>';
  }

  /* ---------- facts strip ---------- */
  function renderFacts() {
    $('#petFacts').hidden = !D.catalogReady();
    if (!D.catalogReady()) return;
    const all = listings();
    const avail = all.filter(l => l.status === 'available').length;
    const checked = all.reduce((n, l) => n + (l.health || []).length, 0);
    $('#petFacts').innerHTML = [
      ['&#129462;', all.length, 'pets in our network'],
      ['&#9989;', avail, 'available now'],
      ['&#129656;', checked, 'health records on file']
    ].map(function (f) {
      return '<div class="pet-fact"><span class="pet-fact-ico">' + f[0] + '</span><span><strong>' +
        f[1] + '</strong>' + f[2] + '</span></div>';
    }).join('');
  }

  /* ---------- listing cards ---------- */
  function statusPill(l) {
    if (l.status === 'reserved') return '<span class="status-pill reserved">Reserved</span>';
    if (l.status === 'sold') return '<span class="status-pill sold">Adopted</span>';
    return '<span class="status-pill available">Available</span>';
  }

  function card(l) {
    const vax = l.health || [];
    return '<article class="pet-card" data-id="' + l.id + '">' +
      '<div class="pet-art">' +
        '<span class="pet-emoji" aria-hidden="true">' + D.icon(l.icon) + '</span>' +
        statusPill(l) +
        '<span class="pet-price">' + D.money(l.price) + '</span>' +
      '</div>' +
      '<div class="pet-body">' +
        '<h3>' + D.esc(l.name) + '</h3>' +
        '<p class="pet-breed">' + D.esc(l.breed) + '</p>' +
        '<div class="pet-meta">' +
          '<span>' + D.speciesIcon(l.species) + ' ' + D.esc(l.species) + '</span>' +
          '<span>' + ageLabel(l.ageMonths) + '</span>' +
          '<span>' + D.esc(l.sex) + '</span>' +
          (l.photos ? '<span>' + l.photos + ' photos</span>' : '') +
        '</div>' +
        '<p class="pet-bio">' + D.esc(l.bio || '') + '</p>' +
        '<ul class="health-list">' +
          vax.slice(0, 3).map(function (h) {
            return '<li><span class="tick">&#10003;</span>' + D.esc(h) + '</li>';
          }).join('') +
        '</ul>' +
        ((l.pedigree && l.pedigree !== 'Unregistered')
          ? '<p class="pedigree"><span>Pedigree</span>' + D.esc(l.pedigree) + '</p>'
          : '') +
        '<div class="tag-row">' +
          (l.temperament || []).map(function (t) { return '<span class="tag-btn">' + D.esc(t) + '</span>'; }).join('') +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-block inq-btn" data-inq="' + l.id + '"' +
          (l.status !== 'available' ? ' disabled' : '') + '>' +
          (l.status === 'available' ? 'Ask about ' + D.esc(l.name) : D.titleCase(l.status)) + '</button>' +
      '</div>' +
    '</article>';
  }

  function filtered() {
    const list = listings().filter(l => {
      if (state.species.size && !state.species.has(l.species)) return false;
      if (state.status.size && !state.status.has(l.status)) return false;
      if (state.sex.size && !state.sex.has(l.sex)) return false;
      if (state.temps.size && !(l.temperament || []).some(t => state.temps.has(t))) return false;
      if (state.maxPrice !== null && l.price > state.maxPrice) return false;
      return true;
    });
    const s = state.sort;
    list.sort(function (a, b) {
      if (s === 'price-asc') return a.price - b.price;
      if (s === 'price-desc') return b.price - a.price;
      if (s === 'age-asc') return a.ageMonths - b.ageMonths;
      return String(b.listedAt).localeCompare(String(a.listedAt));
    });
    return list;
  }

  function render() {
    const list = filtered();
    const facets = $('.pet-facets');
    if (facets) facets.hidden = !D.catalogReady();
    const toolbar = $('.shop-toolbar');
    if (toolbar) toolbar.hidden = !D.catalogReady();
    const reset = $('#petResetEmpty');
    if (reset) reset.hidden = !D.catalogReady();
    $('#petGrid').innerHTML = list.map(card).join('');
    $('#petCount').textContent = D.catalogReady() ? list.length + (list.length === 1 ? ' pet' : ' pets') : 'Listings pending';
    $('#petEmpty').style.display = list.length ? 'none' : 'block';
    if (!D.catalogReady()) $('#petEmpty').firstChild.textContent = 'Pet listings are being confirmed. Contact the store to ask about availability. ';
    renderChips();
    if (!D.catalogReady()) $('#petChips').innerHTML = '';
    syncFacets();
    renderCta();
  }

  function reset() {
    state.species.clear();
    state.status.clear();
    state.sex.clear();
    state.temps.clear();
    state.maxPrice = null;
    const r = $('#petPriceRange');
    if (r) r.value = r.max;
    const ro = $('#petPriceReadout');
    if (ro) ro.textContent = 'Any price';
    render();
  }

  /* ---------- reassurance CTA under the grid ---------- */
  function renderCta() {
    const el = $('#petCta');
    if (!el) return;
    el.innerHTML = '<div class="pet-cta-card">' +
      '<h3>Ask about available pets</h3>' +
      '<p>Contact the store for current pet listings, health details and visit arrangements.</p>' +
      '<a class="btn btn-teal" href="contact.html">Contact the team</a>' +
      ' <a class="btn btn-ghost" href="services.html">See our care services</a>' +
    '</div>';
  }

  /* ---------- inquiry flow ---------- */
  function openInquiry(id) {
    const l = listings().find(x => x.id === id);
    if (!l) return;
    if (l.status !== 'available') { PNC.toast(l.name + ' is ' + l.status + ' right now'); return; }
    inqId = id;
    $('#inqPetName').textContent = l.name;
    $('#inqPetMeta').innerHTML = D.speciesIcon(l.species) + ' ' + D.esc(l.species) + ' &middot; ' +
      D.esc(l.breed) + ' &middot; ' + ageLabel(l.ageMonths) + ' &middot; ' + D.esc(l.sex) +
      ' &middot; <strong>' + D.money(l.price) + '</strong>';
    const m = member();
    $('#inqName').value = m ? m.fullName : '';
    $('#inqEmail').value = m ? m.email : '';
    $('#inqMsg').value = '';
    PNC.openModal('inqModal');
  }

  async function submitInquiry(e) {
    e.preventDefault();
    if (!inqId) return;
    const name = $('#inqName').value.trim();
    const email = $('#inqEmail').value.trim();
    if (name.length < 2) { PNC.toast('Please tell us your name', 'err'); $('#inqName').focus(); return; }
    if (!D.isValidEmail(email)) { PNC.toast('Enter a valid email address', 'err'); $('#inqEmail').focus(); return; }
    const button = e.target.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    let res;
    try { res = await Promise.resolve(D.submitInquiry(inqId, $('#inqMsg').value.trim(), { name, email })); }
    finally { button.disabled = false; }
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    const l = listings().find(x => x.id === inqId);
    PNC.closeModal();
    PNC.toast('Inquiry ' + res.ref + ' saved for the team. They can reply using your contact details.');
    inqId = null;
  }

  /* ---------- init ---------- */
  function init() {
    window.addEventListener('pnc:data-ready', function () { renderFacts(); render(); });
    const filterToggle = $('#togglePetFilters');
    if (filterToggle) filterToggle.addEventListener('click', function () {
      const open = $('#petFilters').classList.toggle('filters-open');
      this.setAttribute('aria-expanded', String(open));
      this.textContent = open ? 'Hide pet filters' : 'Show pet filters';
    });
    buildFacets();
    renderFacts();
    render();

    $('#petGrid').addEventListener('click', function (e) {
      const b = e.target.closest('.inq-btn');
      if (b && !b.disabled) openInquiry(b.dataset.inq);
    });

    $$('.f-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        const set = state[b.dataset.f];
        if (!set) return;
        if (set.has(b.dataset.v)) set.delete(b.dataset.v); else set.add(b.dataset.v);
        render();
      });
    });

    $('#petChips').addEventListener('click', function (e) {
      const c = e.target.closest('.chip[data-rk]');
      if (!c) return;
      const k = c.dataset.rk;
      if (k === 'price') {
        state.maxPrice = null;
        const r = $('#petPriceRange');
        if (r) r.value = r.max;
        const ro = $('#petPriceReadout');
        if (ro) ro.textContent = 'Any price';
      } else if (state[k]) {
        state[k].delete(c.dataset.rv);
      }
      render();
    });

    const range = $('#petPriceRange');
    if (range) {
      range.addEventListener('input', function (e) {
        const v = Number(e.target.value), max = Number(e.target.max);
        state.maxPrice = v >= max ? null : v;
        const ro = $('#petPriceReadout');
        if (ro) ro.textContent = state.maxPrice !== null ? 'Up to ' + D.money(state.maxPrice) : 'Any price';
        render();
      });
    }

    $('#petClear').addEventListener('click', reset);
    $('#petResetEmpty').addEventListener('click', reset);
    $('#petSort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });

    $('#inqForm').addEventListener('submit', submitInquiry);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
