document.addEventListener("pnc:ready", function () {
      var grid = document.getElementById("planGrid");
      if (grid) {
        var current = PNC_DB.currentOwner();
        var currentPlan = current ? current.plan : null;
        var plans = [
          { id: "puppy", name: "Puppy Pass", price: "Free", period: "forever", badge: "", featured: false,
            blurb: "A free account for pet profiles and messages.",
            perks: ["Member account", "Pet profiles", "Member messages"] },
          { id: "adult", name: "Adult Adventurer", price: "Demo only", period: "", badge: "", featured: false,
            blurb: PNC_DB.productionMode() ? "Paid subscriptions are not connected yet." : "Demo tier for testing local membership discounts.",
            perks: PNC_DB.productionMode() ? ["Billing setup required"] : ["Demo discount rules", "No real subscription is created"] },
          { id: "senior", name: "Senior Snuggler", price: "Demo only", period: "", badge: "", featured: false,
            blurb: PNC_DB.productionMode() ? "Paid subscriptions are not connected yet." : "Demo tier for testing local membership discounts.",
            perks: PNC_DB.productionMode() ? ["Billing setup required"] : ["Demo discount rules", "No real subscription is created"] }
        ];
        if (PNC_DB.productionMode()) plans = plans.filter(function (pl) { return pl.id === "puppy"; });
        grid.innerHTML = plans.map(function (pl) {
          var isCur = pl.id === currentPlan;
          return '<div class="plan' + (pl.featured ? " featured" : "") + (isCur ? " current" : "") + '">' +
            (pl.badge ? '<span class="tag tag--yellow plan-flag">' + pl.badge + "</span>" : "") +
            "<h3>" + pl.name + "</h3>" +
            '<p style="margin:0;font-size:.92rem">' + pl.blurb + "</p>" +
            '<div class="price">' + pl.price + ' <small>' + pl.period + "</small></div>" +
            "<ul>" + pl.perks.map(function (perk) {
              return '<li><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' + perk + "</li>";
            }).join("") + "</ul>" +
            (isCur
              ? '<button class="btn btn-ghost btn-block" disabled>Your current plan</button>'
              : '<button class="btn ' + (pl.featured ? "btn-primary" : "btn-teal") + ' btn-block" ' + (PNC_DB.productionMode() && pl.id !== "puppy" ? 'disabled' : '') + ' data-plan="' + pl.id + '">' +
                (PNC_DB.productionMode() && pl.id !== "puppy" ? "Billing setup required" : (current ? "Switch to " + pl.name : "Choose " + pl.name)) + "</button>") +
            "</div>";
        }).join("");
      }

      var tabSignup = document.getElementById("tabSignup");
      var tabLogin = document.getElementById("tabLogin");
      var paneSignup = document.getElementById("paneSignup");
      var paneLogin = document.getElementById("paneLogin");
      function show(which) {
        var onSignup = which === "signup";
        tabSignup.classList.toggle("active", onSignup);
        tabLogin.classList.toggle("active", !onSignup);
        tabSignup.setAttribute("aria-selected", String(onSignup));
        tabLogin.setAttribute("aria-selected", String(!onSignup));
        paneSignup.hidden = !onSignup;
        paneLogin.hidden = onSignup;
      }
      tabSignup.addEventListener("click", function () { show("signup"); });
      tabLogin.addEventListener("click", function () { show("login"); });
      document.getElementById("toLogin").addEventListener("click", function () { show("login"); });
      document.getElementById("toSignup").addEventListener("click", function () { show("signup"); });

      /* platform auth: creates a real owner so the member can book */
      function bindPlatform(form, mode) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var res = mode === "signup"
            ? PNC_DB.signUp({
                fullName: [document.getElementById("su-first").value, document.getElementById("su-last").value].join(" ").trim(),
                email: document.getElementById("su-email").value,
                password: document.getElementById("su-pw").value,
                phone: document.getElementById("su-phone").value,
                petName: document.getElementById("su-pet").value,
                petSpecies: document.getElementById("su-type").value,
                plan: (form.querySelector('input[name="plan"]:checked') || {}).value
              })
            : PNC_DB.logIn(
                document.getElementById("li-email").value,
                document.getElementById("li-pw").value
              );
          if (res.error) { PNC.toast(res.error, "err"); return; }
          document.dispatchEvent(new CustomEvent("pnc:auth"));
          PNC.toast(mode === "signup" ? "Welcome to the pack!" : "Welcome back!");
          window.location.href = "account.html";
        }, true);
      }
      bindPlatform(document.getElementById("signupForm"), "signup");
      bindPlatform(document.getElementById("loginForm"), "login");
      grid && grid.addEventListener("click", async function (e) {
        var b = e.target.closest("[data-plan]");
        if (!b || b.disabled) return;
        var owner = PNC_DB.currentOwner();
        if (!owner) {
          if (PNC_DB.productionMode()) { location.hash = "join"; return; }
          show("signup");
          var radio = document.querySelector('input[name="plan"][value="' + b.dataset.plan + '"]');
          if (radio) radio.checked = true;
          return;
        }
        var r = await Promise.resolve(PNC_DB.updateOwner(owner.id, { plan: b.dataset.plan }));
        if (r && r.error) return PNC.toast(r.error, "err");
        PNC.toast("Plan updated to " + b.dataset.plan);
        location.reload();
      });

      /* Clerk (REPLACE mode): with a publishable key configured, this
         page mounts Clerk's <SignUp/> and the local forms are hidden.
         Without a key the site is in DEMO MODE and the local forms
         above remain the documented demo path. */
      function mountClerkJoin() {
        var ck = window.PNC_CLERK;
        var holder = document.getElementById("clerkMemberHolder");
        var profileStep = document.getElementById("memberProfileStep");
        var unavailable = document.getElementById("accountUnavailable");
        if (!holder) return;
        if (PNC_DB.productionMode() && (!ck || !ck.active)) {
          if (profileStep) profileStep.hidden = true;
          unavailable.hidden = false;
          document.querySelector(".auth-tabs").hidden = true;
          paneSignup.hidden = true;
          paneLogin.hidden = true;
          return;
        }
        if (!ck || !ck.active) return;
        unavailable.hidden = true;
        var pending = null;
        try { pending = JSON.parse(sessionStorage.getItem("pnc_pending_signup_profile") || "null"); } catch {}
        if (!pending && profileStep) {
          profileStep.hidden = false;
          holder.hidden = true;
          return;
        }
        if (profileStep) profileStep.hidden = true;
        var card = holder.closest(".auth-card");
        if (card) card.classList.add("clerk-active");
        holder.hidden = false;
        if (!holder.dataset.mounted) ck.mountSignUp(holder, {
          appearance: { elements: { rootBox: "width:100%" } }
        });
        holder.dataset.mounted = "1";
        document.querySelector(".auth-tabs").style.display = "none";
        document.getElementById("paneSignup").style.display = "none";
        document.getElementById("paneLogin").style.display = "none";
      }
      mountClerkJoin();
      window.addEventListener("pnc:clerk", mountClerkJoin);
      document.getElementById("memberProfileForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var first = document.getElementById("reg-first").value.trim();
        var last = document.getElementById("reg-last").value.trim();
        var phone = document.getElementById("reg-phone").value.trim();
        if (!first || !last) { PNC.toast("Enter your first and last name.", "err"); return; }
        if (!phone) { PNC.toast("Enter a phone number.", "err"); return; }
        try { sessionStorage.setItem("pnc_pending_signup_profile", JSON.stringify({ fullName: first + " " + last, phone: phone })); } catch {}
        mountClerkJoin();
      });

      var pre = new URLSearchParams(location.search).get("plan");
      if (pre && !PNC_DB.productionMode()) {
        var radio = document.querySelector('input[name="plan"][value="' + pre + '"]');
        if (radio) radio.checked = true;
        show("signup");
      }
    });
