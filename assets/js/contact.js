/* ============================================================
   Paws & Claws — Contact & Emergency page controller
   CMS-driven hotline / address / hours, "open now" status,
   and a contact form that files into the CRM message log.
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const D = window.PNC_DB;
  const PNC = window.PNC;

  function esc(s) { return PNC ? PNC.esc(s) : D.esc(s); }

  function telHref(num) {
    return "tel:" + String(num || "").replace(/[^+0-9]/g, "");
  }

  /* ------------------------------ CMS -------------------------------- */
  function renderCMS() {
    const cms = D.db.cms;
    if (!cms) return;

    const hot = $("#emergHotline");
    if (hot) hot.textContent = cms.emergencyHotline ? "Call " + cms.emergencyHotline : "Need urgent veterinary care?";
    const note = $("#emergNote");
    if (note) note.textContent = cms.emergencyNote;
    const call = $("#emergCall");
    if (call) {
      call.hidden = !cms.emergencyHotline;
      call.href = telHref(cms.emergencyHotline);
      call.innerHTML = "&#128222; Call " + esc(cms.emergencyHotline);
    }
    const h2 = $("#cmsHotline2");
    if (h2) h2.textContent = cms.emergencyHotline || "Please contact a local veterinary clinic";

    const addr = $("#cmsAddress");
    if (addr) addr.textContent = cms.address;
    const ph = $("#cmsPhone");
    if (ph) ph.textContent = cms.phone || "Phone number coming soon";
    const em = $("#cmsEmail");
    if (em) em.textContent = cms.email || "Use the contact form below";

    document.title = "Contact & Emergency — " + cms.siteName;
  }

  /* ------------------------------ hours ------------------------------- */
  function renderHours() {
    const cms = D.db.cms;
    const body = $("#hoursBody");
    if (!body || !cms) return;
    const hours = Array.isArray(cms.hours) ? cms.hours : [];
    const status = $("#openNow");
    if (!hours.length) {
      body.innerHTML = '<tr><td colspan="2">Opening hours will be confirmed.</td></tr>';
      if (status) status.textContent = 'Please contact the team before visiting.';
      return;
    }

    const now = new Date(new Date().toLocaleString("en-US", {timeZone:"Africa/Lagos"}));
    const jsDow = now.getDay(); /* 0 = Sun */
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = names[jsDow];
    const rows = hours;

    body.innerHTML = rows.map(function (h) {
      const isToday = h.day === todayName;
      return '<tr class="' + (isToday ? "is-today" : "") + '">' +
        "<th scope=\"row\">" + esc(h.day) + (isToday ? " <span class=\"tag tag--yellow\">Today</span>" : "") + "</th>" +
        "<td>" + (h.open === "Closed" ? "Closed" : esc(h.open) + " &ndash; " + esc(h.close)) + "</td>" +
      "</tr>";
    }).join("");

    const today = hours.find(function (h) { return h.day === todayName; });
    if (!today) return;
    if (today.open === "Closed") { status.textContent = "Closed today"; return; }
    const mins = now.getHours() + now.getMinutes() / 60;
    const openM = toMin(today.open);
    const closeM = toMin(today.close);
    if (mins >= openM && mins < closeM) {
      status.innerHTML = '<span style="color:var(--ok);font-weight:700">&#128994; Open now</span> — closes at ' + esc(today.close);
    } else if (mins < openM) {
      status.innerHTML = '<span style="color:var(--ink-soft);font-weight:700">&#128992; Closed</span> — opens at ' + esc(today.open);
    } else {
      const tmr = names[(jsDow + 1) % 7];
      const tmrRow = hours.find(function (h) { return h.day === tmr; });
      status.innerHTML = '<span style="color:var(--danger);font-weight:700">&#128308; Closed</span>' + (tmrRow && tmrRow.open !== "Closed" ? ' — opens ' + esc(tmr) + " at " + esc(tmrRow.open) : ' — see opening hours below');
    }
  }

  function toMin(str) {
    const p = String(str || "").match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!p) return 0;
    let h = Number(p[1]) % 12;
    if (/PM/i.test(p[3])) h += 12;
    return h + Number(p[2]) / 60;
  }

  /* ----------------------------- form --------------------------------- */
  function mountForm() {
    const form = $("#contactForm");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const subject = String(fd.get("subject") || "");
      const body = String(fd.get("body") || "").trim();

      form.querySelectorAll("[data-err]").forEach(function (el) { el.textContent = ""; });
      ["name", "email", "body"].forEach(function (n) {
        const input = form.querySelector('[name="' + n + '"]');
        if (input) input.removeAttribute("aria-invalid");
      });
      const status = $("#cf-msg");

      function fail(field, msg) {
        const input = form.querySelector('[name="' + field + '"]');
        const err = form.querySelector('[data-err="' + field + '"]');
        if (input) input.setAttribute("aria-invalid", "true");
        if (err) err.textContent = msg;
      }

      let ok = true;
      if (name.length < 2) { fail("name", "Please tell us your name."); ok = false; }
      const validEmail = PNC && PNC.isValidEmail ? PNC.isValidEmail(email) : D.isValidEmail(email);
      if (!validEmail) { fail("email", "Enter a valid email address."); ok = false; }
      if (body.length < 10) { fail("body", "Please write at least a few words."); ok = false; }
      if (!ok) {
        status.textContent = "";
        if (PNC) PNC.toast("Please fix the highlighted fields", "err");
        return;
      }

      if (D.productionMode && D.productionMode()) {
        if (!window.PNC_CONVEX || !window.PNC_CONVEX.active) {
          status.style.color = "var(--danger)";
          status.textContent = "Messaging is temporarily unavailable. Please call the store.";
          if (PNC) PNC.toast("Secure messaging is unavailable", "err");
          return;
        }
        const res = await window.PNC_CONVEX.mutate("submitContact", { name, email, subject, body });
        if (res && res.error) {
          status.style.color = "var(--danger)";
          status.textContent = "We could not send your message. Please try again.";
          if (PNC) PNC.toast(res.error, "err");
          return;
        }
        await window.PNC_CONVEX.syncBootstrap();
      } else {
        /* Demo/local mode: file into the local CRM log. */
        const owner = D.currentOwner();
        (D.db.contactMessages || (D.db.contactMessages = [])).push({
          id: D.uid("ct"), name, email, subject, body, ownerId: owner ? owner.id : undefined,
          createdAt: D.todayISO(), status: "new"
        });
        if (owner) D.message(owner.id, "portal", subject, body, "in");
        D.persist();
      }

      status.style.color = "var(--ok)";
      status.textContent = "Thanks, " + name.split(" ")[0] + "! Your message has been saved for our team.";
      form.reset();
      if (PNC) PNC.toast("Message saved for the team.");
    });
  }

  /* ------------------------------- mount ------------------------------ */
  function start() {
    try { D.load(); } catch (e) { try { D.reset(); } catch (e2) {} }
    renderCMS();
    renderHours();
    mountForm();
    window.addEventListener("pnc:data-ready", function () { renderCMS(); renderHours(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
