/* ============================================================
   Paws & Claws — Shop page logic
   Filtering, sorting, URL param support. No dependencies.
   ============================================================ */

(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const PRICE_STEPS = [10, 20, 30, 40, 65, 100];
  const state = { cat: "All", maxPrice: 100, sort: "featured", query: "" };

  // Pre-select a category from ?cat=
  const params = new URLSearchParams(location.search);
  const catParam = params.get("cat");
  if (catParam) {
    const match = PNC.PRODUCTS.find((p) => p.cat.toLowerCase() === catParam.toLowerCase());
    if (match) state.cat = match.cat;
  }
  const qParam = params.get("q");
  if (qParam) state.query = qParam.trim();

  const CATS = ["All"].concat(Array.from(new Set(PNC.PRODUCTS.map((p) => p.cat))).sort());

  function productCard(p) {
    const badge = p.badge
      ? '<span class="badge tag ' + (p.badge === "New" ? "tag--gold" : "tag--coral") + '">' + esc(p.badge) + "</span>"
      : "";
    return (
      '<div class="card product">' +
        '<div class="product-art">' + badge + p.icon +
          '<button class="fav" aria-label="Add ' + esc(p.name) + ' to wishlist">' +
            '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 7.6 4.1 4.1 0 0 1 19 10.6c0 5-7 9.4-7 9.4Z"/></svg>' +
          "</button>" +
        "</div>" +
        '<div class="product-body">' +
          '<div class="stars">★★★★★<small>(' + p.rating + ")</small></div>" +
          "<h3>" + esc(p.name) + "</h3>" +
          "<p>" + esc(p.desc) + "</p>" +
          '<div class="product-foot">' +
            '<span class="product-price">' + PNC.money(p.price) + "</span>" +
            '<button class="add-btn" data-add="' + p.id + '">' +
              '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Add' +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function filtered() {
    let list = PNC.PRODUCTS.filter((p) => p.price <= state.maxPrice);
    if (state.cat !== "All") list = list.filter((p) => p.cat === state.cat);
    if (state.query) {
      const q = state.query.toLowerCase();
      list = list.filter((p) => (p.name + " " + p.desc + " " + p.cat).toLowerCase().includes(q));
    }
    const by = {
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      "rating": (a, b) => b.rating - a.rating || a.price - b.price,
      "name": (a, b) => a.name.localeCompare(b.name),
      "featured": (a, b) => Number(!!b.badge) - Number(!!a.badge) || b.rating - a.rating
    }[state.sort];
    return list.sort(by);
  }

  function render() {
    const list = filtered();
    const grid = $("#productGrid");
    grid.innerHTML = list.map(productCard).join("");
    grid.parentElement.previousElementSibling; // no-op keep flow explicit
    $("#noResults").style.display = list.length ? "none" : "block";
    $("#resultCount").textContent = list.length + (list.length === 1 ? " product" : " products");

    // active filter chips
    const chips = [];
    if (state.cat !== "All") chips.push({ k: "cat", label: state.cat });
    if (state.maxPrice < 100) chips.push({ k: "price", label: "Under " + PNC.money(state.maxPrice) });
    if (state.query) chips.push({ k: "q", label: '“' + state.query + "”" });
    $("#activeChips").innerHTML = chips.length
      ? chips.map((c) => '<button class="chip active" data-clear="' + c.k + '">' + esc(c.label) + " ✕</button>").join("")
      : "";

    // highlight selected filter controls
    document.querySelectorAll("[data-cat]").forEach((el) => {
      el.checked = el.dataset.cat === state.cat;
    });
    document.querySelectorAll("[data-price]").forEach((el) => {
      el.checked = Number(el.dataset.price) === state.maxPrice;
    });
  }

  function buildFilters() {
    $("#filterCats").innerHTML = CATS.map((c) => {
      const n = c === "All" ? PNC.PRODUCTS.length : PNC.PRODUCTS.filter((p) => p.cat === c).length;
      return (
        '<label class="f-radio"><input type="radio" name="cat" data-cat="' + esc(c) + '"' + (c === state.cat ? " checked" : "") + ">" +
        "<span>" + esc(c) + "</span>" +
        '<span class="f-count">' + n + "</span></label>"
      );
    }).join("");

    $("#filterPrice").innerHTML = PRICE_STEPS.map((amt) => {
      const n = PNC.PRODUCTS.filter((p) => p.price <= amt).length;
      return (
        '<label class="f-radio"><input type="radio" name="price" data-price="' + amt + '"' + (amt === state.maxPrice ? " checked" : "") + ">" +
        "<span>Up to " + PNC.money(amt) + "</span>" +
        '<span class="f-count">' + n + "</span></label>"
      );
    }).join("");
  }

  document.addEventListener("pnc:ready", function () {
    buildFilters();
    render();

    $("#filterCats").addEventListener("change", (e) => {
      if (e.target.dataset.cat) { state.cat = e.target.dataset.cat; render(); }
    });
    $("#filterPrice").addEventListener("change", (e) => {
      if (e.target.dataset.price) { state.maxPrice = Number(e.target.dataset.price); render(); }
    });
    $("#sortBy").addEventListener("change", (e) => { state.sort = e.target.value; render(); });

    function resetAll() {
      state.cat = "All"; state.maxPrice = 100; state.sort = "featured"; state.query = "";
      $("#sortBy").value = "featured";
      buildFilters();
      render();
    }
    $("#clearFilters").addEventListener("click", resetAll);
    $("#resetEmpty").addEventListener("click", resetAll);

    $("#activeChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-clear]");
      if (!b) return;
      const k = b.dataset.clear;
      if (k === "cat") state.cat = "All";
      if (k === "price") state.maxPrice = 100;
      if (k === "q") { state.query = ""; history.replaceState(null, "", "shop.html"); }
      buildFilters();
      render();
    });
  });
})();
