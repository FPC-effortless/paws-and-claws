/* Public editorial content. Text is deliberately applied as textContent so
   CMS users cannot inject markup into a public page. */
(function (global) {
  "use strict";

  const fields = [
    ["home", "Home page", "home.eyebrow", "Welcome label"], ["home", "Home page", "home.lead", "Hero introduction"],
    ["home", "Home page", "home.servicesTitle", "Services heading"], ["home", "Home page", "home.servicesLead", "Services introduction"],
    ["home", "Home page", "home.marketplaceTitle", "Marketplace heading"], ["home", "Home page", "home.marketplaceLead", "Marketplace introduction"],
    ["home", "Home page", "home.catalogTitle", "Catalog heading"], ["home", "Home page", "home.catalogLead", "Catalog introduction"],
    ["home", "Home page", "home.accountTitle", "Account heading"], ["home", "Home page", "home.accountLead", "Account introduction"],
    ["home", "Home page", "home.ctaTitle", "Closing call to action"], ["home", "Home page", "home.ctaLead", "Closing call-to-action text"],
    ["services", "Services", "services.eyebrow", "Welcome label"], ["services", "Services", "services.lead", "Hero introduction"],
    ["services", "Services", "services.menuTitle", "Menu heading"], ["services", "Services", "services.menuLead", "Menu introduction"],
    ["services", "Services", "services.teamTitle", "Team heading"], ["services", "Services", "services.teamLead", "Team introduction"],
    ["services", "Services", "services.bookingTitle", "Booking heading"], ["services", "Services", "services.bookingLead", "Booking introduction"],
    ["shop", "Shop", "shop.eyebrow", "Welcome label"], ["shop", "Shop", "shop.title", "Hero heading"], ["shop", "Shop", "shop.lead", "Hero introduction"],
    ["pets", "Marketplace", "pets.eyebrow", "Welcome label"], ["pets", "Marketplace", "pets.lead", "Marketplace introduction"],
    ["events", "Events", "events.eyebrow", "Welcome label"], ["events", "Events", "events.lead", "Hero introduction"],
    ["events", "Events", "events.featureTitle", "Featured event title"], ["events", "Events", "events.featureBody", "Featured event description"],
    ["events", "Events", "events.featureDate", "Featured event date"], ["events", "Events", "events.featureTime", "Featured event time"], ["events", "Events", "events.featureVenue", "Featured event venue"],
    ["events", "Events", "events.nextTitle", "Upcoming-events heading"], ["events", "Events", "events.event1Title", "Upcoming event 1 title"], ["events", "Events", "events.event1Body", "Upcoming event 1 description"], ["events", "Events", "events.event1Meta", "Upcoming event 1 details"],
    ["events", "Events", "events.event2Title", "Upcoming event 2 title"], ["events", "Events", "events.event2Body", "Upcoming event 2 description"], ["events", "Events", "events.event2Meta", "Upcoming event 2 details"],
    ["events", "Events", "events.event3Title", "Upcoming event 3 title"], ["events", "Events", "events.event3Body", "Upcoming event 3 description"], ["events", "Events", "events.event3Meta", "Upcoming event 3 details"],
    ["events", "Events", "events.ctaTitle", "Closing call to action"], ["events", "Events", "events.ctaLead", "Closing call-to-action text"],
    ["contact", "Contact", "contact.eyebrow", "Welcome label"], ["contact", "Contact", "contact.title", "Contact heading"], ["contact", "Contact", "contact.lead", "Contact introduction"],
    ["contact", "Contact", "contact.directions", "Directions note"], ["contact", "Contact", "contact.payments", "Payment note"],
    ["contact", "Contact", "contact.faq1Question", "Emergency FAQ question"], ["contact", "Contact", "contact.faq1Answer", "Emergency FAQ answer"], ["contact", "Contact", "contact.faq2Question", "Appointments FAQ question"], ["contact", "Contact", "contact.faq2Answer", "Appointments FAQ answer"],
    ["contact", "Contact", "contact.faq3Question", "Vaccines FAQ question"], ["contact", "Contact", "contact.faq3Answer", "Vaccines FAQ answer"], ["contact", "Contact", "contact.faq4Question", "Returns FAQ question"], ["contact", "Contact", "contact.faq4Answer", "Returns FAQ answer"],
    ["join", "Join now", "join.eyebrow", "Welcome label"], ["join", "Join now", "join.title", "Hero heading"], ["join", "Join now", "join.lead", "Hero introduction"],
    ["join", "Join now", "join.featuresTitle", "Features heading"], ["join", "Join now", "join.featuresLead", "Features introduction"],
    ["join", "Join now", "join.faqTitle", "FAQ heading"], ["join", "Join now", "join.faq1Question", "Free-account FAQ question"], ["join", "Join now", "join.faq1Answer", "Free-account FAQ answer"],
    ["join", "Join now", "join.faq2Question", "Cancellation FAQ question"], ["join", "Join now", "join.faq2Answer", "Cancellation FAQ answer"], ["join", "Join now", "join.faq3Question", "In-store FAQ question"], ["join", "Join now", "join.faq3Answer", "In-store FAQ answer"],
    ["global", "Shared site", "global.footerLead", "Footer introduction"]
  ];

  function read(content, path) {
    return path.split(".").reduce(function (value, key) { return value && typeof value === "object" ? value[key] : undefined; }, content);
  }
  function set(object, path, value) {
    const keys = path.split("."); let target = object;
    keys.slice(0, -1).forEach(function (key) { target[key] = target[key] && typeof target[key] === "object" ? target[key] : {}; target = target[key]; });
    target[keys[keys.length - 1]] = value;
  }
  function apply() {
    const content = global.PNC_DB && global.PNC_DB.db && global.PNC_DB.db.cms && global.PNC_DB.db.cms.content;
    if (!content) return;
    document.querySelectorAll("[data-cms]").forEach(function (element) {
      const value = read(content, element.dataset.cms);
      if (typeof value === "string" && value.trim()) element.textContent = value;
    });
  }
  function valuesFromDocument(content) {
    const result = JSON.parse(JSON.stringify(content || {}));
    fields.forEach(function (field) {
      const path = field[2], element = document.querySelector('[data-cms="' + path + '"]');
      if (read(result, path) === undefined && element) set(result, path, element.textContent.trim());
    });
    return result;
  }
  const pagePaths = { home: "index.html", services: "services.html", shop: "shop.html", pets: "pets.html", events: "events.html", contact: "contact.html", join: "membership.html" };
  let defaultsPromise;
  function defaults() {
    if (defaultsPromise) return defaultsPromise;
    defaultsPromise = Promise.all(Object.keys(pagePaths).map(function (page) {
      return fetch((location.pathname.indexOf("/admin/") !== -1 ? "../" : "") + pagePaths[page])
        .then(function (response) { if (!response.ok) throw new Error("Could not load " + page); return response.text(); })
        .then(function (html) {
          const document2 = new DOMParser().parseFromString(html, "text/html"), output = {};
          document2.querySelectorAll("[data-cms]").forEach(function (element) { set(output, element.dataset.cms, element.textContent.trim()); });
          return output;
        });
    })).then(function (pages) { return pages.reduce(function (all, page) { return Object.assign(all, page); }, {}); }).catch(function () { return {}; });
    return defaultsPromise;
  }

  global.PNC_CONTENT = { fields: fields, read: read, set: set, apply: apply, valuesFromDocument: valuesFromDocument, defaults: defaults };
  document.addEventListener("pnc:ready", apply);
  window.addEventListener("pnc:data-ready", apply);
})(window);
