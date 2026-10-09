/* ============================================================
   Paws & Claws — Shop & Marketplace controller
   Facets: category / species / life stage / size / price
   Fulfillment: delivery vs pickup · real checkout via PNC_DB
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.PNC_DB;
  const PNC = window.PNC;

  const state = {
    cats: new Set(),
    species: new Set(),
    ages: new Set(),
    sizes: new Set(),
    maxPrice: null,
    sort: 'featured',
    query: '',
    ful: 'delivery'
  };

  /* The cart lives in the shared PNC chrome and stores {id, qty} lines.
     Use the platform catalog as the source of truth — it carries species,
     life stage, size and stock, which the static app.js list does not. */
  function store() { return D.db.products; }
  function catalog() { return D.PRODUCTS; }
  function member() { return D.currentOwner(); }
  function product(id) {
    const p = store().find(x => x.id === id);
    return p || catalog().find(x => x.id === id);
  }

  function applied() {
    const out = [];
    if (state.query) out.push({ k: 'query', v: state.query, label: 'Search: ' + state.query });
    state.cats.forEach(v => out.push({ k: 'cats', v: v, label: v }));
    state.species.forEach(v => out.push({ k: 'species', v: v, label: D.speciesIcon(v) + ' ' + v }));
    state.ages.forEach(v => out.push({ k: 'ages', v: v, label: D.titleCase(v) }));
    state.sizes.forEach(v => out.push({ k: 'sizes', v: v, label: 'Size ' + v }));
    if (state.maxPrice !== null) out.push({ k: 'price', v: state.maxPrice, label: 'Up to ' + D.money(state.maxPrice) });
    return out;
  }

  /* ---------- facets ---------- */
  function buildFacets() {
    const cats = Array.from(new Set(catalog().map(p => p.cat))).sort();
    $('#filterCats').innerHTML = cats.map(c =>
      '<button type="button" class="f-chip" data-f="cats" data-v="' + D.esc(c) + '">' + D.esc(c) + '</button>').join('');

    const sp = Array.from(new Set(catalog().flatMap(p => p.species))).sort();
    $('#filterSpecies').innerHTML = sp.map(s =>
      '<button type="button" class="f-chip" data-f="species" data-v="' + D.esc(s) + '">' +
      D.speciesIcon(s) + ' ' + D.esc(s) + '</button>').join('');

    const ages = ['puppy', 'kitten', 'adult', 'senior'];
    $('#filterAge').innerHTML = ages.map(a => {
      const n = catalog().filter(p => (p.age || []).indexOf(a) !== -1).length;
      return n ? '<button type="button" class="f-chip" data-f="ages" data-v="' + a + '">' +
        D.titleCase(a) + ' <span class="f-n">' + n + '</span></button>' : '';
    }).join('');

    const sizes = Array.from(new Set(catalog().flatMap(p => p.size))).sort();
    $('#filterSize').innerHTML = sizes.map(s =>
      '<button type="button" class="f-chip" data-f="sizes" data-v="' + D.esc(s) + '">' +
      D.esc(s) + '</button>').join('');

    const top = Math.max(1, ...catalog().map(p => p.price));
    const range = $('#priceRange');
    if (range) { range.max = String(Math.max(top, state.maxPrice || 0)); range.value = String(state.maxPrice ?? top); }
    const readout = $('#priceReadout');
    if (readout) readout.textContent = state.maxPrice === null ? 'Any price' : 'Up to ' + D.money(state.maxPrice);
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
    $('#activeChips').innerHTML = a.length
      ? a.map(x => '<button type="button" class="chip" data-rk="' + x.k + '" data-rv="' +
          D.esc(String(x.v)) + '">' + D.esc(x.label) + ' &times;</button>').join('')
      : '<span class="chip chip-muted">No filters yet — showing everything</span>';
  }

  /* ---------- product cards ---------- */
  function badge(p) {
    if (p.stock <= 0) return '<span class="badge badge-out">Sold out</span>';
    if (p.stock <= (p.lowAt || 3)) return '<span class="badge badge-low">Only ' + p.stock + ' left</span>';
    if (p.badge) return '<span class="badge badge-tag">' + D.esc(p.badge) + '</span>';
    return '';
  }

  function card(p) {
    return '<article class="product-card" data-id="' + p.id + '">' +
      '<div class="product-art">' +
        (p.imageUrl ? '<img src="' + D.esc(p.imageUrl) + '" alt="' + D.esc(p.name) + '" style="width:100%;height:100%;object-fit:cover">' : '<span class="product-emoji" aria-hidden="true">' + (D.icon ? D.icon(p.icon) : D.esc(p.icon)) + '</span>') +
        badge(p) +
      '</div>' +
      '<div class="product-body">' +
        '<span class="product-cat">' + D.esc(p.cat) + '</span>' +
        '<h3>' + D.esc(p.name) + '</h3>' +
        '<p>' + D.esc(p.desc || '') + '</p>' +
        '<div class="product-meta">' +
          ((p.species || []).length ? '<span>' + D.speciesIcon(p.species[0]) + ' ' + D.esc(p.species.join(', ')) + '</span>' : '') +
          '<span>' + D.esc((p.age || []).map(D.titleCase).join(', ')) + '</span>' +
          ((p.size || []).length ? '<span>Size ' + D.esc(p.size.join('/')) + '</span>' : '') +
        '</div>' +
        '<div class="price-row">' +
          '<span class="price">' + (D.catalogReady() ? D.money(p.price) : 'Price confirmed in store') + '</span>' +
          '<button type="button" class="btn btn-teal btn-sm add-btn" data-add="' + p.id + '"' +
            (p.stock <= 0 || !D.catalogReady() ? ' disabled' : '') + '>' +
            (!D.catalogReady() ? 'Visit the store' : p.stock <= 0 ? 'Sold out' : 'Add to cart') + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function filtered() {
    const list = catalog().filter(p => {
      if (state.query && ![p.name, p.desc, p.cat, ...(p.species || [])].join(' ').toLowerCase().includes(state.query)) return false;
      if (state.cats.size && !state.cats.has(p.cat)) return false;
      if (state.species.size && !(p.species || []).some(s => state.species.has(s))) return false;
      if (state.ages.size && !(p.age || []).some(a => state.ages.has(a))) return false;
      if (state.sizes.size && !(p.size || []).some(s => state.sizes.has(s))) return false;
      if (state.maxPrice !== null && p.price > state.maxPrice) return false;
      return true;
    });
    const s = state.sort;
    list.sort((a, b) => {
      if (s === 'price-asc') return a.price - b.price;
      if (s === 'price-desc') return b.price - a.price;
      if (s === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (s === 'name') return a.name.localeCompare(b.name);
      return (b.badge ? 1 : 0) - (a.badge ? 1 : 0) || (b.rating || 0) - (a.rating || 0);
    });
    return list;
  }

  function render() {
    const list = D.catalogReady() ? filtered() : [];
    if (D.productionMode && D.productionMode()) {
      const lead = $('#shopLead');
      if (lead) lead.textContent = D.catalogReady()
        ? 'Browse our range, then visit our Amasoma store. Pay in naira by cash or bank transfer; no account required. Online checkout is not available yet.'
        : 'Our product catalog is being confirmed. Visit our Amasoma store and ask about current stock and naira prices. Pay by cash or bank transfer; no account required.';
    }
    const filters = $('#shopFilters');
    if (filters) filters.hidden = !D.catalogReady();
    const search = $('.shop-search');
    if (search) search.hidden = !D.catalogReady();
    const toolbar = $('.shop-toolbar');
    if (toolbar) toolbar.hidden = !D.catalogReady();
    const reset = $('#resetEmpty');
    if (reset) reset.hidden = !D.catalogReady();
    $('#productGrid').innerHTML = list.map(card).join('');
    $('#resultCount').textContent = D.catalogReady() ? list.length + (list.length === 1 ? ' product' : ' products') : 'Catalog pending';
    $('#noResults').style.display = list.length ? 'none' : 'block';
    if (!D.catalogReady()) $('#noResults').firstChild.textContent = 'Our product catalog is being updated with verified naira prices. Contact the store to ask about stock. ';
    renderChips();
    if (!D.catalogReady()) $('#activeChips').innerHTML = '';
    syncFacets();
  }

  function reset() {
    state.query = '';
    $('#productSearch').value = '';
    state.cats.clear();
    state.species.clear();
    state.ages.clear();
    state.sizes.clear();
    state.maxPrice = null;
    const r = $('#priceRange');
    if (r) r.value = r.max;
    const ro = $('#priceReadout');
    if (ro) ro.textContent = 'Any price';
    render();
  }

  /* ---------- fulfillment ---------- */
  function setFul(v) {
    state.ful = v;
    $$('.ful-opt').forEach(b => {
      const on = b.dataset.ful === v;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const note = $('#fulNote');
    if (note) {
      note.textContent = D.productionMode && D.productionMode()
        ? 'Online ordering and fulfillment are not available yet.'
        : (v === 'pickup' ? 'Demo pickup at our Amasoma store' : 'Demo delivery');
    }
    PNC.toast((D.productionMode && D.productionMode()) ? 'Online ordering is not available yet' : (v === 'pickup' ? 'Demo pickup selected' : 'Demo delivery selected'));
  }

  /* ---------- totals & checkout ---------- */

  async function checkout() {
    const items = PNC.Cart.items;
    if (!items.length) { PNC.toast('Your cart is empty'); return; }
    if (D.productionMode && D.productionMode()) {
      PNC.toast('Online checkout is disabled until a payment processor is configured.', 'err');
      return;
    }
    const m = member();
    if (!m) {
      PNC.toast('Create a free account to check out');
      window.location.href = 'account.html?next=' + encodeURIComponent('shop.html');
      return;
    }
    const lines = items.map(i => {
      const p = product(i.id);
      return p ? { id: p.id, qty: Math.min(i.qty, p.stock) } : null;
    }).filter(Boolean);
    if (!lines.length) { PNC.toast('Those items are no longer available'); return; }
    const res = await Promise.resolve(D.placeOrder(lines, state.ful));
    if (res.error) { PNC.toast(res.error, 'err'); return; }
    PNC.Cart.clear();
    PNC.closeModal();
    if (res.order && res.order.paymentStatus === 'pending') {
      PNC.toast('Order ' + res.order.id + ' created. Payment is still pending.');
    } else {
      PNC.toast('Order ' + res.order.id + ' placed! Track it in your account.');
    }
    setTimeout(function () { window.location.href = 'account.html#orders'; }, 1100);
  }

  /* ---------- init ---------- */
  function init() {
    window.addEventListener('pnc:data-ready', function () { buildFacets(); render(); });
    $('#toggleFilters').addEventListener('click', function () {
      const open = $('#shopFilters').classList.toggle('filters-open');
      this.setAttribute('aria-expanded', String(open));
      this.textContent = open ? 'Hide filters' : 'Show filters';
    });
    buildFacets();
    render();

    document.addEventListener('click', function (e) {
        const b = e.target.closest('.f-chip');
        if (!b) return;
        const set = state[b.dataset.f];
        if (!set) return;
        if (set.has(b.dataset.v)) set.delete(b.dataset.v); else set.add(b.dataset.v);
        render();
    });

    $('#activeChips').addEventListener('click', function (e) {
      const c = e.target.closest('.chip[data-rk]');
      if (!c) return;
      const k = c.dataset.rk;
      if (k === 'price') {
        state.maxPrice = null;
        const r = $('#priceRange');
        if (r) r.value = r.max;
        const ro = $('#priceReadout');
        if (ro) ro.textContent = 'Any price';
      } else if (k === 'query') {
        state.query = '';
        $('#productSearch').value = '';
      } else if (state[k]) {
        state[k].delete(c.dataset.rv);
      }
      render();
    });

    const range = $('#priceRange');
    if (range?.closest('.filter-group')) range.closest('.filter-group').hidden = !D.catalogReady();
    if (range) {
      range.addEventListener('input', function (e) {
        const v = Number(e.target.value), max = Number(e.target.max);
        state.maxPrice = v >= max ? null : v;
        const ro = $('#priceReadout');
        if (ro) ro.textContent = state.maxPrice !== null ? 'Up to ' + D.money(state.maxPrice) : 'Any price';
        render();
      });
    }

    $('#productSearch').addEventListener('input', function (e) {
      state.query = e.target.value.trim().toLowerCase();
      render();
    });

    $('#clearFilters').addEventListener('click', reset);
    $('#resetEmpty').addEventListener('click', reset);
    $('#sortBy').addEventListener('change', function (e) { state.sort = e.target.value; render(); });

    $$('.ful-opt').forEach(function (b) {
      b.addEventListener('click', function () { setFul(b.dataset.ful); });
    });

    /* deep link: shop.html?cat=Toys */
    const cat = new URLSearchParams(window.location.search).get('cat');
    if (cat && catalog().some(function (p) { return p.cat === cat; })) {
      state.cats.add(cat);
      render();
    }

    /* member pricing note */
    const m = member();
    if (m) {
      const lead = $('#shopLead');
      if (lead && !(D.productionMode && D.productionMode())) {
        const pct = Math.round((D.PLAN_DISCOUNT[m.plan] || 0) * 100);
        lead.textContent = pct
          ? "Demo members save " + pct + "% on eligible demo orders."
          : "Browse the catalog and check local availability.";
      }
    }

    /* the checkout button lives in the shared cart modal */
    const co = $('#cartCheckout');
    if (co) co.addEventListener('click', checkout);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
