/* ============================================================
   Paws & Claws — Platform data layer ("ERP + CRM" core)
   ------------------------------------------------------------
   Vanilla JS, zero dependencies. Built for static hosting
   (GitHub Pages): every mutation persists to localStorage, and the
   store re-seeds deterministically on first load so the demo
   is never empty.

   Relational model
   ----------------
   Owner 1 -- n Pet            (pet.ownerId  -> owner.id)
   Owner 1 -- n Booking        (booking.ownerId -> owner.id)
   Booking n -- 1 Pet          (booking.petId -> pet.id)
   Booking n -- 1 Service      (booking.serviceId -> service.id)
   Booking n -- 1 Provider     (booking.providerId -> provider.id)
   Owner 1 -- n Order          (order.ownerId -> owner.id)
   Order 1 -- n OrderLine      (order.items[].productId)
   Listing (pet for sale)      standalone; Retail Manager owned
   AdminUser 1 -- n AuditEvent (audit.adminEmail)
   ============================================================ */

(function (global) {
  "use strict";

  const KEY = "pnc_db_v1";
  const CURRENCY = "$";
  const DEPOSIT_RATE = 0.3; /* 30% deposit at booking checkout */
  /* Membership plan discount, applied to shop orders and bookings.
     Keep in sync with the PLAN_DISCOUNT labels in account.js. */
  const PLAN_DISCOUNT = { puppy: 0.05, adult: 0.15, senior: 0.25 };
  const discountRate = (owner) =>
    owner ? (PLAN_DISCOUNT[owner.plan] || 0) : 0;

  /* ------------------------------ utils ------------------------------ */
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const money = (n) => CURRENCY + Number(n == null ? 0 : n).toFixed(2);
  const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
  const todayISO = () => isoDate(new Date());
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
  const parseD = (s) => { const p = String(s).split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmtDate = (s) => {
    if (!s) return "—";
    const d = parseD(s);
    return DOW[d.getDay()] + ", " + MON[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  };
  const fmtTime = (h) => {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    const ap = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return h12 + (mm ? ":" + String(mm).padStart(2, "0") : ":00") + " " + ap;
  };
  const fmtDT = (s, h) => fmtDate(s) + " &middot; " + fmtTime(h);
  const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e).trim());
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const titleCase = (s) =>
    String(s == null ? "" : s).replace(/(^|[\s_\-])([a-z])/g, (m, a, c) => (a === "" ? "" : " ") + c.toUpperCase());
  const speciesIcon = (sp) =>
    ({ Dog: "&#128021;", Cat: "&#128008;", Bird: "&#129436;", Rabbit: "&#128007;", Reptile: "&#129422;", "Small Mammal": "&#128057;", Fish: "&#128031;" }[sp] || "&#128062;");
  const initials = (n) =>
    String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  /* --------------------- reference / seed catalog --------------------- */
  const SPECIES = ["Dog", "Cat", "Bird", "Rabbit", "Reptile", "Small Mammal", "Fish"];
  const SEXES = ["Male", "Female"];
  const ALTERED = ["Intact", "Neutered", "Spayed"];
  const VACCINES = ["Rabies", "DHPP", "Bordetella", "FVRCP", "Leptospirosis", "Canine Influenza"];
  const TEMPERAMENTS = ["Friendly", "Energetic", "Shy", "Good with kids", "Good with dogs", "Good with cats", "Vocal", "Cuddly", "Independent", "Needs experienced handler"];
  const SERVICE_GROUPS = [
    { id: "vet", name: "Veterinary", icon: "&#129658;", blurb: "Wellness exams, vaccinations, and surgery with licensed veterinarians." },
    { id: "grooming", name: "Grooming &amp; Washing", icon: "&#128136;", blurb: "Baths, haircuts, nail trims and spa add-ons by certified groomers." },
    { id: "sitting", name: "Pet Sitting &amp; Boarding", icon: "&#127968;", blurb: "Daycare, overnight stays and in-home sitting with daily photo updates." },
    { id: "training", name: "Behavioral Training", icon: "&#127893;", blurb: "Puppy basics, obedience and agility with positive-reinforcement trainers." }
  ];
  const ADMIN_ROLES = {
    super: { id: "super", name: "Super Admin", scope: "*", level: 100 },
    desk: { id: "desk", name: "Front Desk / Support", scope: "desk", level: 40 },
    provider: { id: "provider", name: "Service Provider", scope: "provider", level: 20 },
    retail: { id: "retail", name: "Retail Manager", scope: "retail", level: 30 }
  };
  const STAGES = ["pending", "packing", "ready", "shipped", "done", "cancelled"];

  /* ----------------------------- products ----------------------------- */
  /* Shop catalog extended with species / age / size filters
     ("Toy & Supply Store" module) plus inventory fields for the
     Retail Manager (stock, lowAt, cost, sku). */
  const PRODUCTS = [
    { id: "p1", name: "Salmon & Sweet Potato Kibble", cat: "Food", price: 24.99, badge: "Bestseller", rating: 4.9, icon: "&#129424;", desc: "Grain-free, wild-caught salmon recipe for dogs of all sizes. 5 lb bag.", species: ["Dog"], age: ["adult", "senior"], size: ["small", "medium", "large"], stock: 38, sku: "FD-KBL-005", lowAt: 8, cost: 11.4 },
    { id: "p2", name: "Feather Wand Cat Teaser", cat: "Toys", price: 8.49, badge: "", rating: 4.7, icon: "&#129718;", desc: "Hand-wand teaser with natural feathers and a jingle bell. Cats go wild.", species: ["Cat"], age: ["kitten", "adult", "senior"], size: ["small"], stock: 64, sku: "TY-WND-012", lowAt: 12, cost: 2.1 },
    { id: "p3", name: "Cozy Donut Pet Bed", cat: "Beds", price: 39.0, badge: "New", rating: 4.8, icon: "&#128716;", desc: "Orthopedic memory-foam donut bed with a machine-washable cover.", species: ["Dog", "Cat"], age: ["adult", "senior"], size: ["small", "medium"], stock: 4, sku: "BD-DNT-031", lowAt: 5, cost: 16.5 },
    { id: "p4", name: "Aloe Oatmeal Pet Shampoo", cat: "Grooming", price: 12.95, badge: "Eco", rating: 4.6, icon: "&#129529;", desc: "Soothing, tear-free formula for sensitive skin. 16 oz, pH balanced.", species: ["Dog", "Cat"], age: ["puppy", "kitten", "adult", "senior"], size: ["small", "medium", "large"], stock: 52, sku: "GR-SHM-004", lowAt: 10, cost: 4.2 },
    { id: "p5", name: "No-Pull Padded Harness", cat: "Walking", price: 27.5, badge: "", rating: 4.8, icon: "&#129454;", desc: "Front-clip reflective harness in 4 sizes. chest 18-34 in.", species: ["Dog"], age: ["puppy", "adult"], size: ["medium", "large"], stock: 29, sku: "WK-HAR-008", lowAt: 6, cost: 9.8 },
    { id: "p6", name: "Dental Chew Trio Pack", cat: "Treats", price: 15.75, badge: "", rating: 4.5, icon: "&#129712;", desc: "Three textures of vet-approved dental sticks. Fresh breath in a week.", species: ["Dog"], age: ["adult", "senior"], size: ["small", "medium", "large"], stock: 41, sku: "TR-DNT-019", lowAt: 10, cost: 5.6 },
    { id: "p7", name: "Tough Rope Tug", cat: "Toys", price: 11.2, badge: "", rating: 4.4, icon: "&#129682;", desc: "Knotted cotton-blend rope for heavy chewers and tug-of-war champs.", species: ["Dog"], age: ["puppy", "adult"], size: ["medium", "large"], stock: 33, sku: "TY-RPE-021", lowAt: 8, cost: 3.4 },
    { id: "p8", name: "Stainless Slow Feeder Bowl", cat: "Feeding", price: 18.9, badge: "", rating: 4.7, icon: "&#129373;", desc: "Non-slip stainless bowl with a maze insert to slow fast eaters.", species: ["Dog", "Cat"], age: ["adult", "senior"], size: ["small", "medium"], stock: 22, sku: "FE-BWL-014", lowAt: 6, cost: 7.1 },
    { id: "p9", name: "Cat Scratching Post Tower", cat: "Furniture", price: 64.0, badge: "New", rating: 4.9, icon: "&#127913;", desc: "Multi-level tower with sisal posts and a lookout platform. 32 in.", species: ["Cat"], age: ["kitten", "adult", "senior"], size: ["medium", "large"], stock: 9, sku: "FR-TWR-002", lowAt: 3, cost: 26.0 },
    { id: "p10", name: "Grain-Free Puppy Pate", cat: "Food", price: 21.4, badge: "", rating: 4.6, icon: "&#127811;", desc: "Wet pate packed with chicken and pumpkin. 12 x 12.5 oz cans.", species: ["Dog"], age: ["puppy"], size: ["small", "medium"], stock: 26, sku: "FD-PUP-007", lowAt: 8, cost: 8.9 },
    { id: "p11", name: "Retractable LED Leash", cat: "Walking", price: 22.99, badge: "", rating: 4.5, icon: "&#128294;", desc: "16 ft retractable leash with an LED handle for night walks.", species: ["Dog"], age: ["adult"], size: ["small", "medium", "large"], stock: 5, sku: "WK-LED-016", lowAt: 6, cost: 8.2 },
    { id: "p12", name: "De-Shedding Grooming Glove", cat: "Grooming", price: 9.99, badge: "Eco", rating: 4.3, icon: "&#129508;", desc: "Silicone glove that gently lifts loose fur. One size fits all.", species: ["Dog", "Cat"], age: ["adult", "senior"], size: ["small", "medium", "large"], stock: 47, sku: "GR-GLV-023", lowAt: 10, cost: 2.8 }
  ];

  const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  /* ---------------------------- services ------------------------------ */
  /* CMS-editable catalog. `duration` is in hours and drives slot
     availability; `requiresVaccine` blocks booking until the pet's
     records are approved by staff. */
  const SERVICES = [
    { id: "sv-wellness", group: "vet", name: "Wellness Exam", icon: "&#129658;", price: 65, duration: 0.5, deposit: true, requiresVaccine: false, staff: ["Dana", "Marcus"], desc: "Full nose-to-tail exam, weight and dental check, plus a nutrition chat.", popular: true },
    { id: "sv-vaccination", group: "vet", name: "Vaccination Visit", icon: "&#128137;", price: 38, duration: 0.25, deposit: false, requiresVaccine: false, staff: ["Dana", "Marcus"], desc: "Rabies, DHPP, Bordetella and more. Bring your records book." },
    { id: "sv-dental", group: "vet", name: "Dental Cleaning", icon: "&#129702;", price: 240, duration: 2, deposit: true, requiresVaccine: true, staff: ["Dana"], desc: "Anesthesia-free scaling and polishing under vet supervision." },
    { id: "sv-surgery", group: "vet", name: "Spay / Neuter Surgery", icon: "&#128712;", price: 320, duration: 3, deposit: true, requiresVaccine: true, staff: ["Dana", "Marcus"], desc: "Pre-op bloodwork, monitoring, and post-op pain relief included." },

    { id: "sv-bath", group: "grooming", name: "Bath & Blowout", icon: "&#128704;", price: 28, duration: 1, deposit: true, requiresVaccine: true, staff: ["Rosa", "Talia"], desc: "Warm bath, tear-free shampoo, blowout and a finishing bandana." },
    { id: "sv-haircut", group: "grooming", name: "Breed-Specific Haircut", icon: "&#128136;", price: 52, duration: 1.5, deposit: true, requiresVaccine: true, staff: ["Rosa", "Talia"], desc: "Breed-standard clip or a custom look. Add coat-specific shampoo.", popular: true },
    { id: "sv-nails", group: "grooming", name: "Nail Trim & File", icon: "&#128063;", price: 18, duration: 0.5, deposit: false, requiresVaccine: false, staff: ["Rosa", "Talia"], desc: "Quick, gentle trim with a smoothing file. Clipped with love." },
    { id: "sv-deshed", group: "grooming", name: "De-Shed Treatment", icon: "&#129508;", price: 42, duration: 1.5, deposit: true, requiresVaccine: true, staff: ["Rosa"], desc: "Undercoat blast-out that saves your couch. Best done monthly." },

    { id: "sv-daycare", group: "sitting", name: "Daycare (Full Day)", icon: "&#128021;", price: 38, duration: 8, deposit: true, requiresVaccine: true, staff: ["Priya", "Owen"], desc: "Group play, nap schedule and a report card at pickup.", popular: true },
    { id: "sv-overnight", group: "sitting", name: "Overnight Boarding", icon: "&#127968;", price: 58, duration: 24, deposit: true, requiresVaccine: true, staff: ["Priya", "Owen"], desc: "Cozy private suite, evening storytime and two walks a day." },
    { id: "sv-dropin", group: "sitting", name: "Drop-In Visit", icon: "&#128694;", price: 24, duration: 1, deposit: false, requiresVaccine: false, staff: ["Priya", "Owen"], desc: "In-home feed, walk and cuddle visit while you are out." },

    { id: "sv-puppy", group: "training", name: "Puppy Basics", icon: "&#128062;", price: 45, duration: 1, deposit: true, requiresVaccine: false, staff: ["Coach Ray"], desc: "Socialization, name response, and the potty-training playbook." },
    { id: "sv-obedience", group: "training", name: "Obedience Level 1", icon: "&#127893;", price: 60, duration: 1.5, deposit: true, requiresVaccine: true, staff: ["Coach Ray"], desc: "Sit, stay, loose-leash walking and rock-solid recall basics.", popular: true },
    { id: "sv-agility", group: "training", name: "Agility Intro", icon: "&#127919;", price: 75, duration: 1.5, deposit: true, requiresVaccine: true, staff: ["Coach Ray"], desc: "Jumps, tunnels and weave poles for high-energy dogs." }
  ];

  const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
  const groupById = (gid) => SERVICE_GROUPS.find((g) => g.id === gid);

  /* ---------------------------- providers ----------------------------- */
  /* staff[] on each service lists provider ids; the availability
     engine below turns provider working hours + leave into slots. */
  const PROVIDERS = [
    { id: "Dana", name: "Dr. Dana Whitfield", role: "Veterinarian", title: "DVM, Chief of Medicine", group: "vet", icon: "&#129658;", start: 8, end: 16, off: [0], bio: "14 years in small-animal practice. Loves a good dental." },
    { id: "Marcus", name: "Dr. Marcus Ito", role: "Veterinarian", title: "DVM, Surgery", group: "vet", icon: "&#129658;", start: 10, end: 18, off: [0], bio: "Soft-tissue surgery and dentals. Cat whisperer." },
    { id: "Rosa", name: "Rosa Delgado", role: "Groomer", title: "Certified Master Groomer", group: "grooming", icon: "&#128136;", start: 9, end: 17, off: [0], bio: "Breed-standard clips and de-shed wizard." },
    { id: "Talia", name: "Talia Nguyen", role: "Groomer", title: "Groomer & Spa Lead", group: "grooming", icon: "&#128136;", start: 9, end: 17, off: [1, 0], bio: "Cat specialist. Zero scraches per week, on average." },
    { id: "Priya", name: "Priya Raman", role: "Sitter", title: "Daycare & Boarding Lead", group: "sitting", icon: "&#127968;", start: 7, end: 19, off: [], bio: "Runs the play yard and sends the best photo updates." },
    { id: "Owen", name: "Owen Brooks", role: "Sitter", title: "In-Home Sitting Specialist", group: "sitting", icon: "&#127968;", start: 8, end: 20, off: [0], bio: "Overnights and drop-ins for senior and shy pets." },
    { id: "Coach Ray", name: "Ray Carter", role: "Trainer", title: "CPDT-KA Trainer", group: "training", icon: "&#127893;", start: 10, end: 19, off: [0], bio: "Positive reinforcement only. Agility course builder." }
  ];
  const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

  /* -------------------------- availability ---------------------------- */
  /* Deterministic pseudo-random so a given date always yields the
     same slots — the "real-time availability" feel without a server. */
  function hash01(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h / 0x100000000;
  }
  const DAY_START = 8;    /* facility open hour */
  const DAY_END = 19;     /* facility close hour */
  const STEP = 0.5;       /* 30-minute grid */

  function providerLeave(dbArg, pid) {
    const dbz = dbArg && dbArg.staffLeave ? dbArg : db;
    return (dbz && dbz.staffLeave ? dbz.staffLeave : []).filter((l) => l.providerId === pid);
  }
  /* Args may be (db, provider, dateStr) or (provider, dateStr). */
  function providerWorking(dbArg, providerArg, dateArg) {
    let provider = providerArg, dateStr = dateArg;
    if (!dateStr && typeof providerArg === "string") { provider = dbArg; dateStr = providerArg; }
    if (!provider || !dateStr) return false;
    const dow = parseD(dateStr).getDay();
    if (provider.off == null || provider.off.indexOf(dow) !== -1) return false;
    return !providerLeave(dbArg && dbArg.staffLeave ? dbArg : db, provider.id).some((l) => l.date === dateStr);
  }

  /** Slots for (service, date) honoring duration + capacity + leave. */
  function slotsFor(db, serviceId, dateStr) {
    const svc = byId(db && db.services ? db.services : [], serviceId) || SERVICE_BY_ID[serviceId];
    if (!svc) return [];
    const out = [];
    PROVIDERS.filter((p) => svc.staff.indexOf(p.id) !== -1).forEach((p) => {
      if (!providerWorking(db, p, dateStr)) return;
      let t = Math.max(DAY_START, p.start);
      while (t + svc.duration <= Math.min(DAY_END, p.end)) {
        const seed = dateStr + "|" + p.id + "|" + t;
        const rnd = hash01(seed);
        /* 22% of start times are naturally unavailable */
        const natural = rnd > 0.22;
        /* already booked by this provider at that start? */
        const clash = (db.bookings || []).some(
          (b) => b.providerId === p.id && b.date === dateStr &&
            b.status !== "cancelled" && b.status !== "no-show" &&
            t < b.hour + b.duration && b.hour < t + svc.duration
        );
        out.push({
          hour: t,
          providerId: p.id,
          label: fmtTime(t) + " - " + fmtTime(t + svc.duration),
          available: natural && !clash
        });
        t += STEP;
      }
    });
    out.sort((a, b) => a.hour - b.hour || a.providerId.localeCompare(b.providerId));
    return out;
  }

  function firstOpenDate(db, serviceId) {
    let d = 0;
    while (d < 60) {
      const ds = addDays(d);
      if (slotsFor(db, serviceId, ds).some((s) => s.available)) return ds;
      d++;
    }
    return todayISO();
  }

  /* ----------------------------- seeding ------------------------------ */
  function seed() {
    const now = new Date().toISOString();

    const owners = [
      { id: "ow-1", fullName: "Elena Vasquez", email: "elena@example.com", phone: "(555) 014-2288", emergencyContact: "(555) 014-9911", address: "88 Alder Brook Ln, Riverton, OR 97008", createdAt: addDays(-420), notes: "", plan: "adult", passwordHash: hashPw("member123") },
      { id: "ow-2", fullName: "Marcus Dunn", email: "marcus@example.com", phone: "(555) 014-7732", emergencyContact: "(555) 014-7733", address: "12 Cedar Row, Riverton, OR 97008", createdAt: addDays(-300), notes: "Prefers email contact.", plan: "puppy", passwordHash: hashPw("member123") },
      { id: "ow-3", fullName: "Priya Raman", email: "priya@example.com", phone: "(555) 014-4410", emergencyContact: "(555) 014-4411", address: "5 Willow Court, Riverton, OR 97008", createdAt: addDays(-180), notes: "", plan: "senior", passwordHash: hashPw("member123") }
    ];

    const pets = [
      { id: "pt-1", ownerId: "ow-1", petName: "Charlie", species: "Dog", breed: "Golden Retriever", dob: addDays(-1280), sex: "Male", altered: "Neutered", weightKg: 31.4, microchip: "985141002651478", coat: "Cream", tags: [], vaccines: [ { name: "Rabies", date: addDays(-210), lot: "RB-8841", status: "approved" }, { name: "DHPP", date: addDays(-190), lot: "DH-2210", status: "approved" }, { name: "Bordetella", date: addDays(-120), lot: "BD-4417", status: "approved" } ], notes: "Allergic to chicken. Loves water.", createdAt: addDays(-420) },
      { id: "pt-2", ownerId: "ow-1", petName: "Miso", species: "Cat", breed: "Domestic Shorthair", dob: addDays(-640), sex: "Female", altered: "Spayed", weightKg: 4.2, microchip: "985141002651902", coat: "Tabby", tags: ["Shy"], vaccines: [ { name: "Rabies", date: addDays(-300), lot: "RB-8890", status: "approved" }, { name: "FVRCP", date: addDays(-285), lot: "FV-1102", status: "approved" } ], notes: "Hides when strangers visit.", createdAt: addDays(-410) },
      { id: "pt-3", ownerId: "ow-2", petName: "Bruno", species: "Dog", breed: "French Bulldog", dob: addDays(-900), sex: "Male", altered: "Intact", weightKg: 11.8, microchip: "985141002651113", coat: "Brindle", tags: ["Bites during nail trims"], vaccines: [ { name: "Rabies", date: addDays(-400), lot: "RB-7712", status: "approved" }, { name: "DHPP", date: addDays(-380), lot: "DH-1902", status: "pending" } ], notes: "Needs two handlers for nails.", createdAt: addDays(-300) },
      { id: "pt-4", ownerId: "ow-2", petName: "Pepper", species: "Bird", breed: "Cockatiel", dob: addDays(-1500), sex: "Female", altered: "Intact", weightKg: 0.1, microchip: "", coat: "Lutino", tags: ["Vocal"], vaccines: [], notes: "Whistles the theme from the show.", createdAt: addDays(-290) },
      { id: "pt-5", ownerId: "ow-3", petName: "Luna", species: "Dog", breed: "Border Collie", dob: addDays(-460), sex: "Female", altered: "Spayed", weightKg: 19.6, microchip: "985141002651734", coat: "Black & white", tags: ["Energetic", "Needs experienced handler"], vaccines: [ { name: "Rabies", date: addDays(-150), lot: "RB-9001", status: "approved" }, { name: "DHPP", date: addDays(-140), lot: "DH-3310", status: "approved" }, { name: "Bordetella", date: addDays(-60), lot: "BD-5501", status: "approved" }, { name: "Canine Influenza", date: addDays(-55), lot: "CI-2201", status: "approved" } ], notes: "High drive; agility candidate.", createdAt: addDays(-180) },
      { id: "pt-6", ownerId: "ow-3", petName: "Biscuit", species: "Rabbit", breed: "Holland Lop", dob: addDays(-300), sex: "Male", altered: "Neutered", weightKg: 1.8, microchip: "", coat: "Broken tort", tags: ["Cuddly"], vaccines: [], notes: "Loves cilantro.", createdAt: addDays(-170) }
    ];

    const bookings = [
      { id: "bk-1001", ownerId: "ow-1", petId: "pt-1", serviceId: "sv-haircut", providerId: "Rosa", date: addDays(2), hour: 10, duration: 1.5, status: "confirmed", deposit: 15.6, total: 52, paid: 15.6, intake: { instructions: "Keep the tail long." }, createdAt: addDays(-3), createdBy: "self" },
      { id: "bk-1002", ownerId: "ow-1", petId: "pt-2", serviceId: "sv-wellness", providerId: "Dana", date: addDays(4), hour: 9, duration: 0.5, status: "confirmed", deposit: 19.5, total: 65, paid: 19.5, intake: {}, createdAt: addDays(-1), createdBy: "self" },
      { id: "bk-1003", ownerId: "ow-2", petId: "pt-3", serviceId: "sv-nails", providerId: "Talia", date: addDays(1), hour: 13, duration: 0.5, status: "confirmed", deposit: 0, total: 18, paid: 18, intake: { muzzleOk: true, handlers: "Two" }, createdAt: addDays(-2), createdBy: "desk" },
      { id: "bk-1004", ownerId: "ow-3", petId: "pt-5", serviceId: "sv-agility", providerId: "Coach Ray", date: addDays(6), hour: 17, duration: 1.5, status: "confirmed", deposit: 22.5, total: 75, paid: 22.5, intake: {}, createdAt: addDays(-1), createdBy: "self" },
      { id: "bk-1005", ownerId: "ow-1", petId: "pt-1", serviceId: "sv-wellness", providerId: "Marcus", date: addDays(-24), hour: 11, duration: 0.5, status: "completed", deposit: 19.5, total: 65, paid: 65, intake: {}, createdAt: addDays(-30), createdBy: "self" },
      { id: "bk-1006", ownerId: "ow-2", petId: "pt-3", serviceId: "sv-bath", providerId: "Rosa", date: addDays(-12), hour: 14, duration: 1, status: "completed", deposit: 8.4, total: 28, paid: 28, intake: { shampoo: "Oatmeal" }, createdAt: addDays(-18), createdBy: "desk" },
      { id: "bk-1007", ownerId: "ow-3", petId: "pt-5", serviceId: "sv-daycare", providerId: "Priya", date: addDays(-5), hour: 8, duration: 8, status: "completed", deposit: 11.4, total: 38, paid: 38, intake: { lunch: "Own food" }, createdAt: addDays(-9), createdBy: "self" },
      { id: "bk-1008", ownerId: "ow-1", petId: "pt-2", serviceId: "sv-dropin", providerId: "Owen", date: addDays(-2), hour: 16, duration: 1, status: "completed", deposit: 0, total: 24, paid: 24, intake: {}, createdAt: addDays(-7), createdBy: "self" }
    ];

    const orders = [
      { id: "or-2001", ownerId: "ow-1", placedAt: addDays(-9), items: [ { productId: "p1", qty: 1, price: 24.99 }, { productId: "p2", qty: 2, price: 8.49 } ], fulfillment: "delivery", status: "delivered", address: "88 Alder Brook Ln, Riverton, OR 97008", stage: "done", total: 41.97, paid: 41.97, method: "Visa ending 4242" },
      { id: "or-2002", ownerId: "ow-2", placedAt: addDays(-4), items: [ { productId: "p7", qty: 1, price: 11.2 }, { productId: "p6", qty: 1, price:  15.75 } ], fulfillment: "pickup", status: "open", address: "", stage: "packing", total: 26.95, paid: 26.95, method: "Visa ending 1881" },
      { id: "or-2003", ownerId: "ow-3", placedAt: addDays(-1), items: [ { productId: "p9", qty: 1, price: 64 } ], fulfillment: "delivery", status: "open", address: "5 Willow Court, Riverton, OR 97008", stage: "pending", total: 64, paid: 64, method: "Mastercard ending 0905" }
    ];

    const listings = [
      { id: "lt-1", species: "Dog", name: "Willow", breed: "Labrador Retriever", sex: "Female", ageMonths: 14, price: 650, status: "available", icon: "&#128021;", photos: 3, breeder: "Riverton Retriever Co.", health: [ "Vet wellness check passed", "Rabies + DHPP current", "Hip/elbow prelim clear" ], pedigree: "Ch. Sunnybrook Max x Riverbend Bella", temperament: ["Friendly", "Good with kids", "Energetic"], bio: "Willow is a sunbeam with legs. House-trained, crate-trained, and obsessed with tennis balls.", listedAt: addDays(-6) },
      { id: "lt-2", species: "Cat", name: "Mochi", breed: "Ragdoll", sex: "Male", ageMonths: 9, price: 480, status: "available", icon: "&#128008;", photos: 4, breeder: "Cloudwell Ragdolls", health: [ "First two rounds of vaccines complete", "FIV/FeLV negative" ], pedigree: "Gr. Ch. Cloudwell Merlin x Belladonna Sue", temperament: ["Cuddly", "Shy", "Good with cats"], bio: "Mochi melts into your arms the moment you pick him up. Quiet, gentle, perfect for a calm home.", listedAt: addDays(-4) },
      { id: "lt-3", species: "Dog", name: "Theo", breed: "Border Terrier", sex: "Male", ageMonths: 22, price: 400, status: "available", icon: "&#128021;", photos: 2, breeder: "Private surrender", health: [ "Dental cleaning completed", "Vaccines current" ], pedigree: "Unregistered", temperament: ["Independent", "Good with dogs", "Vocal"], bio: "Theo would like a yard and a person with a lap. No cats, please.", listedAt: addDays(-11) },
      { id: "lt-4", species: "Bird", name: "Kiwi", breed: "Green-Cheek Conure", sex: "Female", ageMonths: 18, price: 320, status: "available", icon: "&#129436;", photos: 3, breeder: "Willow Wing Aviary", health: [ "Avian vet exam passed" ], pedigree: "Unregistered", temperament: ["Vocal", "Friendly", "Energetic"], bio: "Kiwi does a little dance before breakfast. Hand-tame and step-up trained.", listedAt: addDays(-2) },
      { id: "lt-5", species: "Cat", name: "Marble", breed: "Maine Coon", sex: "Female", ageMonths: 30, price: 720, status: "reserved", icon: "&#128008;", photos: 5, breeder: "Cloudwell Ragdolls", health: [ "Full panel clear", "Vaccines current", "Spayed" ], pedigree: "Ch. Northwood Hilda x Cloudwell Titan", temperament: ["Cuddly", "Good with kids", "Good with cats"], bio: "Marble is currently meeting her future family; ask us about similar cats.", listedAt: addDays(-14) },
      { id: "lt-6", species: "Rabbit", name: "Clover", breed: "Mini Lop", sex: "Male", ageMonths: 6, price: 120, status: "available", icon: "&#128007;", photos: 2, breeder: "Hollow Trail Hoppers", health: [ "Vet wellness check passed" ], pedigree: "Unregistered", temperament: ["Cuddly", "Good with kids"], bio: "Clover is a professional binky performer and hay enthusiast.", listedAt: addDays(-3) }
    ];

    const admins = [
      { email: "owner@pawsandclaws.example", name: "Avery Stone", role: "super", password: "admin123" },
      { email: "front@pawsandclaws.example", name: "Jordan Pike", role: "desk", password: "desk123" },
      { email: "rosa@pawsandclaws.example", name: "Rosa Delgado", role: "provider", providerId: "Rosa", password: "rosa123" },
      { email: "retail@pawsandclaws.example", name: "Sam Okafor", role: "retail", password: "retail123" }
    ];

    const db = {
      version: 1,
      owners,
      pets,
      bookings,
      orders,
      listings,
      products: clone(PRODUCTS),
      services: clone(SERVICES),
      serviceGroups: clone(SERVICE_GROUPS),
      providers: clone(PROVIDERS),
      staffLeave: [
        { id: "lv-1", providerId: "Marcus", date: addDays(3), reason: "Surgery conference" },
        { id: "lv-2", providerId: "Talia", date: addDays(1), reason: "Personal day" },
        { id: "lv-3", providerId: "Coach Ray", date: addDays(2), reason: "Off-site workshop" }
      ],
      waitlist: [
        { id: "wl-1", ownerId: "ow-2", petId: "pt-3", serviceId: "sv-haircut", providerId: "Rosa", note: "After 4pm preferred", createdAt: addDays(-1) }
      ],
      messages: [
        { id: "msg-1", ownerId: "ow-1", direction: "out", channel: "sms", subject: "", body: "Charlie's haircut is Thursday at 10am. See you then!", read: true, createdAt: addDays(-1) },
        { id: "msg-2", ownerId: "ow-2", direction: "out", channel: "email", subject: "Vaccine record received", body: "Thanks for uploading Bruno's DHPP record. We'll review it within one business day.", read: false, createdAt: addDays(-1) },
        { id: "msg-3", ownerId: "ow-3", direction: "in", channel: "email", subject: "Agility question", body: "Can I bring Luna's own treats to the intro class?", read: false, createdAt: addDays(-2) }
      ],
      notifications: [
        { id: "nt-1", kind: "booking", title: "Charlie's haircut is in 2 days", body: "Thursday, " + fmtDate(addDays(2)) + " at 10:00 AM with Rosa.", read: false, createdAt: addDays(0), ownerId: "ow-1" },
        { id: "nt-2", kind: "vaccine", title: "Miso's Rabies is due in 10 weeks", body: "Book a vaccination visit to stay current.", read: false, createdAt: addDays(-1), ownerId: "ow-1" },
        { id: "nt-3", kind: "order", title: "Your order is packing", body: "Order or-2002 is being packed for store pickup.", read: true, createdAt: addDays(-4), ownerId: "ow-2" }
      ],
      payments: [
        { id: "pm-1", ownerId: "ow-1", brand: "Visa", last4: "4242", expMonth: 9, expYear: 2029, primary: true },
        { id: "pm-2", ownerId: "ow-1", brand: "Mastercard", last4: "1188", expMonth: 1, expYear: 2028, primary: false },
        { id: "pm-3", ownerId: "ow-3", brand: "Mastercard", last4: "0905", expMonth: 4, expYear: 2027, primary: true }
      ],
      audit: [
        { id: "au-1", adminEmail: "owner@pawsandclaws.example", action: "Refund issued", detail: "or-2001 — $12.00", at: addDays(-3) },
        { id: "au-2", adminEmail: "front@pawsandclaws.example", action: "Booking created", detail: "bk-1003 for Bruno", at: addDays(-2) }
      ],
      admins,
      cms: {
        siteName: "Paws & Claws",
        tagline: "Pet Co.",
        banner: "",
        heroTitle: "Everything your best friend needs, all under one woof.",
        emergencyHotline: "(555) 018-4400",
        emergencyNote: "Staffed 24/7 by licensed vets. Members and non-members welcome.",
        hours: [
          { day: "Monday", open: "9:00 AM", close: "7:00 PM" },
          { day: "Tuesday", open: "9:00 AM", close: "7:00 PM" },
          { day: "Wednesday", open: "9:00 AM", close: "7:00 PM" },
          { day: "Thursday", open: "9:00 AM", close: "7:00 PM" },
          { day: "Friday", open: "9:00 AM", close: "7:00 PM" },
          { day: "Saturday", open: "9:00 AM", close: "7:00 PM" },
          { day: "Sunday", open: "10:00 AM", close: "4:00 PM" }
        ],
        toggles: { appointmentReminder: true, vaccineRenewal: true, abandonedCart: true, waitlistAlerts: true },
        address: "142 Alder Brook Lane, Suite 3, Riverton, OR 97008",
        phone: "(555) 018-4427",
        email: "hello@pawsandclaws.example"
      },
      inquiries: [],
      inquiryCounter: 2,
      createdAt: now
    };
    return db;
  }

  /* ----------------------------- store -------------------------------- */
  let db = null;

  function productionMode() {
    try {
      const h = String(global.location && global.location.hostname || "").toLowerCase();
      return !!h && h !== "localhost" && h !== "127.0.0.1" && h !== "::1" && h.indexOf(".local") === -1;
    } catch {
      return false;
    }
  }

  function publicSnapshot(source) {
    const x = clone(source || seed());
    x.owners = [];
    x.pets = [];
    x.bookings = [];
    x.orders = [];
    x.waitlist = [];
    x.messages = [];
    x.notifications = [];
    x.payments = [];
    x.audit = [];
    x.admins = [];
    x.inquiries = [];
    return x;
  }

  function remoteEnabled() {
    const cv = global.PNC_CONVEX;
    return productionMode() && clerkOn() && !!(cv && cv.active);
  }

  function applyRemoteSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || snapshot.version !== 1) return false;
    db = snapshot;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    try { if (global.PNC && global.PNC.onDbChange) global.PNC.onDbChange(); } catch {}
    global.dispatchEvent(new CustomEvent("pnc:data-ready", { detail: { db: db } }));
    return true;
  }

  async function remoteMutation(op, payload) {
    const cv = global.PNC_CONVEX;
    if (!cv || !cv.active) return { error: "Secure backend is not available." };
    try {
      const res = await cv.mutate(op, payload || {});
      if (cv.syncBootstrap) await cv.syncBootstrap();
      const out = res || { ok: true };
      if (out.bookingId) out.booking = byId(db.bookings || [], out.bookingId);
      if (out.orderId) out.order = byId(db.orders || [], out.orderId);
      if (out.productId) out.product = byId(db.products || [], out.productId);
      if (out.ownerId) out.owner = byId(db.owners || [], out.ownerId);
      if (out.petId) out.pet = byId(db.pets || [], out.petId);
      if (out.listingId) out.listing = byId(db.listings || [], out.listingId);
      if (out.serviceId) out.service = byId(db.services || [], out.serviceId);
      return out;
    } catch (err) {
      return { error: String(err && err.message || err || "Request failed.") };
    }
  }

  function load() {
    if (db) return db;
    if (productionMode()) {
      db = publicSnapshot(seed());
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
      return db;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const parsed = JSON.parse(raw); if (parsed && parsed.version === 1) { db = parsed; return db; } }
    } catch {}
    db = seed();
    persist();
    return db;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    if (global.PNC && global.PNC.onDbChange) { try { global.PNC.onDbChange(); } catch {} }
  }

  function reset() { db = seed(); persist(); return db; }

  /* --------------------------- derived lookups ------------------------ */
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const petsOf = (ownerId) => db.pets.filter((p) => p.ownerId === ownerId);
  const ownerOf = (petId) => byId(db.owners, (byId(db.pets, petId) || {}).ownerId);
  const bookingsOf = (ownerId) =>
    db.bookings.filter((b) => b.ownerId === ownerId).sort((a, b) => (a.date + a.hour).localeCompare(b.date + String(b.hour)) * -1);
  const ordersOf = (ownerId) => db.orders.filter((o) => o.ownerId === ownerId).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const upcoming = () =>
    db.bookings.filter((b) => b.status !== "completed" && b.status !== "cancelled" && b.date >= todayISO())
      .sort((a, b) => (a.date + a.hour).localeCompare(b.date + String(b.hour)));
  const past = () =>
    db.bookings.filter((b) => b.status === "completed" || b.date < todayISO())
      .sort((a, b) => (b.date + b.hour).localeCompare(a.date + String(a.hour)));

  function petAge(pet) {
    if (!pet || !pet.dob) return "—";
    const days = daysBetween(pet.dob, todayISO());
    if (days < 0) return "Unborn";
    if (days < 60) return days + " days";
    const months = Math.floor(days / 30.44);
    if (months < 24) return months + (months === 1 ? " month" : " months");
    const years = Math.floor(months / 12);
    return years + (years === 1 ? " year" : " years");
  }
  function petStage(pet) {
    if (!pet || !pet.dob) return "adult";
    const m = daysBetween(pet.dob, todayISO()) / 30.44;
    if (m < 12) return pet.species === "Cat" ? "kitten" : "puppy";
    if (m < 84) return "adult";
    return "senior";
  }
  function vaccinesOk(pet, service) {
    if (!pet || !service || !service.requiresVaccine) return { ok: true, missing: [] };
    const have = (pet.vaccines || []).filter((v) => v.status === "approved").map((v) => v.name);
    const required = pet.species === "Cat" ? ["Rabies", "FVRCP"] : ["Rabies", "DHPP", "Bordetella"];
    const missing = required.filter((r) => have.indexOf(r) === -1);
    return { ok: missing.length === 0, missing };
  }

  /* ------------------------------ stats ------------------------------- */
  function stats() {
    const revenueServices = db.bookings.filter((b) => b.status !== "cancelled")
      .reduce((n, b) => n + (b.paid || 0), 0);
    const revenueRetail = db.orders.filter((o) => o.status !== "cancelled")
      .reduce((n, o) => n + (o.paid || 0), 0);
    const lowStock = db.products.filter((p) => p.stock <= p.lowAt);
    const pending = db.orders.filter((o) => o.status === "open");
    return {
      revenueServices,
      revenueRetail,
      revenue: revenueServices + revenueRetail,
      bookingsToday: db.bookings.filter((b) => b.date === todayISO() && b.status !== "cancelled").length,
      upcomingCount: upcoming().length,
      owners: db.owners.length,
      pets: db.pets.length,
      lowStock,
      lowStockCount: lowStock.length,
      pendingOrders: pending,
      pendingCount: pending.length,
      pendingVaccineUploads: db.pets.reduce((n, p) => n + (p.vaccines || []).filter((v) => v.status === "pending").length, 0),
      waitlistCount: db.waitlist.length,
      unreadNotifs: db.notifications.filter((n) => !n.read).length,
      unreadMessages: db.messages.filter((m) => !m.read && m.direction === "in").length,
      availableListings: db.listings.filter((l) => l.status === "available").length
    };
  }

  /* ----------------------- notification engine ------------------------ */
  function notify(ownerId, kind, title, body) {
    db.notifications.push({ id: uid("nt"), kind, title, body, read: false, createdAt: todayISO(), ownerId });
    persist();
  }
  function message(ownerId, channel, subject, body, direction) {
    db.messages.push({ id: uid("msg"), ownerId, direction: direction || "out", channel, subject: subject || "", body, read: false, createdAt: todayISO() });
    persist();
  }
  function audit(action, detail) {
    const s = session();
    db.audit.unshift({ id: uid("au"), adminEmail: s ? s.email : "system", action, detail, at: todayISO() });
    persist();
  }

  /* ----------------------------- auth --------------------------------- */
  const SESSION_KEY = "pnc_session_v1";
  const MEMBER_KEY = "pnc_member_v1";

  function hashPw(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return "h" + h.toString(16).padStart(8, "0") + ":" + s.length;
  }

  /* Owner session. The legacy `pnc_users` map from the original
     build is migrated on first load so existing members keep
     their accounts. */
  function migrateLegacy() {
    try {
      const legacy = JSON.parse(localStorage.getItem("pnc_users") || "{}");
      const member = JSON.parse(localStorage.getItem("pnc_member") || "null");
      if (!member || !legacy[member.email]) return null;
      const rec = legacy[member.email];
      let owner = db.owners.find((o) => o.email === member.email);
      if (!owner) {
        owner = {
          id: uid("ow"), fullName: rec.name, email: member.email,
          phone: rec.phone || "", emergencyContact: "", address: rec.address || "",
          createdAt: todayISO(), notes: "", plan: rec.plan || "puppy", passwordHash: rec.hash,
          migrated: true
        };
        db.owners.push(owner);
      }
      if (rec.petName && !db.pets.some((p) => p.ownerId === owner.id)) {
        db.pets.push({
          id: uid("pt"), ownerId: owner.id, petName: rec.petName,
          species: rec.petType === "Cat" ? "Cat" : "Dog",
          breed: "", dob: "", sex: "Male", altered: "Intact", weightKg: 0,
          microchip: "", coat: "", tags: [], vaccines: [],
          notes: "Migrated from your original membership.", createdAt: todayISO()
        });
      }
      persist();
      delete localStorage.pnc_users; delete localStorage.pnc_member;
      return owner;
    } catch { return null; }
  }

  function signUp(input) {
    if (productionMode()) return { error: "Sign-up is unavailable until secure identity is configured." };
    const name = String(input.fullName || "").trim();
    const email = String(input.email || "").trim().toLowerCase();
    const pw = String(input.password || "");
    if (name.length < 2) return { error: "Please tell us your full name." };
    if (!isValidEmail(email)) return { error: "Enter a valid email address." };
    if (pw.length < 8) return { error: "Password must be at least 8 characters." };
    if (db.owners.some((o) => o.email === email)) return { error: "An account with this email already exists." };
    const owner = {
      id: uid("ow"), fullName: name, email, phone: String(input.phone || "").trim(),
      emergencyContact: String(input.emergencyContact || "").trim(),
      address: String(input.address || "").trim(),
      plan: input.plan || "puppy", passwordHash: hashPw(pw),
      createdAt: todayISO(), notes: ""
    };
    db.owners.push(owner);
    const petName = String(input.petName || "").trim();
    if (petName) {
      db.pets.push({
        id: uid("pt"), ownerId: owner.id, petName,
        species: input.petSpecies || "Dog", breed: String(input.petBreed || "").trim(),
        dob: input.petDob || "", sex: input.petSex || "Male", altered: "Intact",
        weightKg: Number(input.petWeight) || 0, microchip: "", coat: "",
        tags: [], vaccines: [], notes: "", createdAt: todayISO()
      });
    }
    notify(owner.id, "welcome", "Welcome to the pack!", "Your account is ready. Add your pet's details to make booking a breeze.");
    persist();
    setSession(owner.id);
    return { owner };
  }

  function logIn(email, pw) {
    if (productionMode()) return { error: "Sign-in is unavailable until secure identity is configured." };
    email = String(email || "").trim().toLowerCase();
    const owner = db.owners.find((o) => o.email === email);
    if (!owner || !owner.passwordHash || owner.passwordHash !== hashPw(pw)) return { error: "Incorrect email or password." };
    setSession(owner.id);
    return { owner };
  }
  /* When the optional Convex backend is active, the server owns the
     password hashes, so hand off to it instead. */
  async function logInRemote(email, pw) {
    const cv = global.PNC_CONVEX;
    if (!cv || !cv.active) return null;
    const res = await cv.logIn(email, pw);
    if (!res || res.error) return res ? res : { error: "Sign-in service unavailable." };
    const owner = db.owners.find((o) => o.email === String(email).trim().toLowerCase()) ||
      (res.ownerId && byId(db.owners, res.ownerId));
    if (!owner) return { error: "Account exists on the server but not in this browser. Reload the page." };
    setSession(owner.id);
    return { owner };
  }

  function setSession(ownerId) {
    try { localStorage.setItem(MEMBER_KEY, ownerId); } catch {}
  }
  /* Sign out of whichever identity provider is in charge. Returns a
     promise so callers can await before redirecting/re-rendering;
     resolves immediately when there is nothing async to do. */
  function logOut() {
    clearSession();
    const c = clerk();
    if (!c || !c.active) return Promise.resolve();
    return Promise.resolve(c.signOut()).catch(function () {});
  }
  function clearSession() { try { localStorage.removeItem(MEMBER_KEY); } catch {} }
  function localOwner() {
    if (productionMode()) return null;
    let id = null;
    try { id = localStorage.getItem(MEMBER_KEY); } catch {}
    return id ? byId(db.owners, id) : null;
  }

  /* ------------------- Clerk identity bridge ---------------------- */
  /* Clerk is the sole identity provider. When a Clerk session is
     present it is authoritative: `currentOwner` and `currentAdmin`
     resolve the Clerk user to a row in this store so bookings,
     orders and notifications still attach. Passwords are never
     read from localStorage in Clerk mode.

     DEMO MODE is not an authentication fallback. It is engaged only
     when no Clerk publishable key is configured (or ?demo=1 is
     present), so the deployed demo and the test harness stay usable
     while the Clerk project is being provisioned. No Clerk session
     is ever minted by this code path. */
  function clerk() { return global.PNC_CLERK || null; }
  function clerkOn() { const c = clerk(); return !!(c && c.active); }
  function demoMode() { const c = clerk(); return !c || c.demo; }

  /* Map a Clerk user onto an owners row, creating it if this is the
     first time we have seen them. This is a data-link, not an
     authentication decision — the Clerk session is what proved the
     identity. */
  function resolveOwner(cOwner) {
    if (!cOwner) return null;
    let owner = (cOwner.clerkId && db.owners.find((o) => o.clerkId === cOwner.clerkId)) ||
      (cOwner.email && db.owners.find((o) => o.email === cOwner.email));
    if (owner) {
      let changed = false;
      if (cOwner.clerkId && owner.clerkId !== cOwner.clerkId) { owner.clerkId = cOwner.clerkId; changed = true; }
      if (cOwner.email && owner.email !== cOwner.email) { owner.email = cOwner.email; changed = true; }
      if (cOwner.fullName && owner.fullName !== cOwner.fullName) { owner.fullName = cOwner.fullName; changed = true; }
      if (cOwner.plan && owner.plan !== cOwner.plan) { owner.plan = cOwner.plan; changed = true; }
      if (changed) persist();
      return owner;
    }
    owner = {
      id: uid("ow"), clerkId: cOwner.clerkId || null,
      fullName: cOwner.fullName || "Member", email: cOwner.email || "",
      phone: cOwner.phone || "", emergencyContact: "", address: "",
      plan: cOwner.plan || "puppy", createdAt: todayISO(), notes: "",
      source: "clerk"
    };
    db.owners.push(owner);
    persist();
    return owner;
  }

  function currentOwner() {
    if (clerkOn()) {
      const co = clerk().currentOwner();
      if (productionMode()) {
        if (!co) return null;
        return (db.owners || []).find(o => (co.clerkId && o.clerkId === co.clerkId) || (co.email && o.email === co.email)) || null;
      }
      return resolveOwner(co);
    }
    return localOwner();
  }

  /* ---------------------- admin auth (RBAC) --------------------------- */
  const PERMS = {
    super: { everything: true },
    desk: {
      "crm.view": true, "crm.edit": true, "bookings.manage": true, "bookings.view": true,
      "messages.send": true, "payments.take": true, "payments.refund": false,
      "cms.edit": false, "inventory.edit": false, "listings.edit": false, "reports.view": false,
      "staff.manage": false, "roles.edit": false
    },
    provider: {
      "crm.view": "own", "bookings.view": "own", "bookings.notes": true, "messages.send": "own",
      "payments.take": false, "payments.refund": false, "cms.edit": false,
      "inventory.edit": false, "listings.edit": false, "reports.view": false,
      "staff.manage": false, "roles.edit": false
    },
    retail: {
      "crm.view": false, "bookings.view": false, "bookings.manage": false,
      "messages.send": true, "payments.take": true, "payments.refund": false,
      "cms.edit": false, "inventory.edit": true, "listings.edit": true,
      "reports.view": true, "staff.manage": false, "roles.edit": false
    }
  };

  /* ---------------------- admin auth (RBAC) --------------------------- */
  /* Clerk is authoritative for staff identity too. A Clerk user is
     staff only when `publicMetadata.role` is set (provisioned in the
     Clerk dashboard, never written from the browser). The role maps
     onto the RBAC table below so can()/scopeOf() keep working.

     `adminLogIn` remains for DEMO MODE only — it is what the
     credential cards on the admin gate use. In Clerk mode the
     button hands off to PNC_CLERK.openSignIn() instead. */
  function adminLogin(email, pw) {
    if (productionMode()) return { error: "Admin sign-in is unavailable until Clerk is configured." };
    email = String(email || "").trim().toLowerCase();
    const a = db.admins.find((x) => x.email === email);
    if (!a || a.password !== pw) return { error: "Invalid admin credentials." };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email: a.email, at: Date.now() })); } catch {}
    audit("Admin sign-in", a.email + " signed in as " + ADMIN_ROLES[a.role].name);
    return { admin: a };
  }
  function adminLogout() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    /* Also end the Clerk staff session when it is in charge, so
       leaving the console can't leave a live session behind. */
    const c = clerk();
    if (c && c.active) c.signOut();
  }
  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  }
  function currentAdmin() {
    /* Clerk is authoritative in production; role and scope come only
       from a server-provisioned admin row, never from browser metadata. */
    if (clerkOn()) {
      const cAdmin = clerk().currentAdmin();
      if (!cAdmin) return null;
      const known = (db.admins || []).find((a) =>
        (cAdmin.clerkId && a.clerkId === cAdmin.clerkId) ||
        (cAdmin.email && a.email === cAdmin.email)
      ) || null;
      if (productionMode()) {
        if (!known || !ADMIN_ROLES[known.role]) return null;
        return Object.assign({}, known, {
          role: known.role,
          roleObj: ADMIN_ROLES[known.role]
        });
      }
      const rawRole = known ? known.role : cAdmin.role;
      if (!ADMIN_ROLES[rawRole]) return null;
      return Object.assign({}, known || {}, cAdmin, {
        role: rawRole,
        roleObj: ADMIN_ROLES[rawRole]
      });
    }
    if (productionMode()) return null;
    const s = session();
    if (!s) return null;
    const a = (db.admins || []).find((x) => x.email === s.email);
    return a && ADMIN_ROLES[a.role] ? Object.assign({}, a, { roleObj: ADMIN_ROLES[a.role] }) : null;
  }
  function can(perm) {
    const a = currentAdmin();
    if (!a) return false;
    if (a.role === "super") return true;
    const map = PERMS[a.role] || {};
    return map[perm] === true;
  }
  /* Scoped perms: "own" means limited to the provider's own schedule/pets */
  function scopeOf(perm) {
    const a = currentAdmin();
    if (!a) return false;
    if (a.role === "super") return "all";
    const map = PERMS[a.role] || {};
    const v = map[perm];
    return v === true ? "all" : v === "own" ? "own" : false;
  }

  /* --------------------------- bookings API --------------------------- */
  function createBooking(input) {
    if (remoteEnabled()) return remoteMutation("createBooking", input);
    const owner = currentOwner();
    if (!owner) return { error: "Please sign in to book an appointment." };
    const svc = byId(db.services, input.serviceId);
    const pet = byId(db.pets, input.petId);
    if (!svc || !pet) return { error: "Pick a service and a pet to continue." };
    if (pet.ownerId !== owner.id) return { error: "That pet does not belong to your account." };

    const check = vaccinesOk(pet, svc);
    if (!check.ok) return { error: "Missing required vaccines: " + check.missing.join(", ") + ". Upload records in your account for staff approval." };

    const provider = byId(db.providers || PROVIDERS, input.providerId);
    if (!provider || svc.staff.indexOf(provider.id) === -1) return { error: "That specialist isn't available for this service." };

    const slots = slotsFor(db, svc.id, input.date);
    if (String(input.date) < todayISO()) return { error: "Bookings cannot be made in the past." };
    const slot = slots.find((s) => s.hour === Number(input.hour) && s.providerId === provider.id);
    if (!slot) return { error: "That time slot is no longer available. Please pick another." };

    /* Members get their plan discount on the service total. */
    const rate = discountRate(owner);
    const total = Math.round(svc.price * (1 - rate) * 100) / 100;
    const deposit = svc.deposit ? Math.round(total * DEPOSIT_RATE * 100) / 100 : 0;
    const bk = {
      id: "bk-" + (1000 + db.bookings.length + 1),
      ownerId: owner.id, petId: pet.id, serviceId: svc.id, providerId: provider.id,
      date: input.date, hour: slot.hour, duration: svc.duration,
      status: "confirmed", deposit, total, paid: deposit, paymentStatus: svc.deposit ? "demo-pending" : "not_required",
      intake: input.intake || {}, createdAt: todayISO(), createdBy: "self",
      discountRate: rate || undefined
    };
    db.bookings.push(bk);
    notify(owner.id, "booking", "Booking confirmed: " + svc.name,
      pet.petName + " is booked for " + fmtDT(bk.date, bk.hour) + " with " + provider.name + ".");
    message(owner.id, "email", "Appointment confirmation", svc.name + " for " + pet.petName + " on " + fmtDT(bk.date, bk.hour) + ". Deposit " + money(deposit) + " received.", "out");
    audit("Booking created", bk.id + " — " + pet.petName + " · " + svc.name);
    persist();
    return { booking: bk };
  }

  function rescheduleBooking(bookingId, date, hour, providerId) {
    if (remoteEnabled()) return remoteMutation("rescheduleBooking", { bookingId, date, hour, providerId });

    const bk = byId(db.bookings, bookingId);
    if (!bk) return { error: "Booking not found." };
    const owner = currentOwner();
    if (!owner || (bk.ownerId !== owner.id && !can("bookings.manage"))) return { error: "Not authorized." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || String(date) < todayISO()) return { error: "Bookings cannot be moved into the past." };
    if (!["confirmed","pending"].includes(bk.status)) return { error: "This booking cannot be rescheduled." };
    const svc = byId(db.services, bk.serviceId);
    const pid = providerId || bk.providerId;
    const slots = slotsFor(db, bk.serviceId, date).filter((s) => s.providerId === pid);
    const slot = slots.find((s) => s.hour === Number(hour));
    if (!slot) return { error: "That slot was just taken — please choose another." };
    bk.date = date; bk.hour = slot.hour; bk.providerId = pid;
    notify(bk.ownerId, "booking", "Appointment rescheduled",
      "Moved to " + fmtDT(date, slot.hour) + " with " + (PROVIDER_BY_ID[pid] || {}).name + ".");
    audit("Booking rescheduled", bk.id + " -> " + fmtDT(date, slot.hour));
    persist();
    return { booking: bk };
  }

  function cancelBooking(bookingId) {
    if (remoteEnabled()) return remoteMutation("cancelBooking", { bookingId });
    const bk = byId(db.bookings, bookingId);
    if (!bk) return { error: "Booking not found." };
    const owner = currentOwner();
    if (!owner || (bk.ownerId !== owner.id && !can("bookings.manage"))) return { error: "Not authorized." };
    if (bk.status === "completed" || bk.status === "cancelled") return { error: "Booking is already closed." };
    bk.status = "cancelled";
    notify(bk.ownerId, "booking", "Appointment cancelled", "Your " + (byId(db.services, bk.serviceId) || {}).name + " on " + fmtDate(bk.date) + " was cancelled. Any eligible refund will be handled by the payment provider.");
    audit("Booking cancelled", bk.id);
    persist();
    return { booking: bk };
  }

  function setBookingStatus(bookingId, status) {
    if (remoteEnabled()) return remoteMutation("setBookingStatus", { bookingId, status });
    const admin = currentAdmin();
    if (!admin || !can("bookings.manage")) return { error: "Not authorized." };
    const bk = byId(db.bookings, bookingId);
    if (!bk) return { error: "Booking not found." };
    if (!STAGES.includes(status) && !["completed","no-show"].includes(status)) return { error: "Invalid booking status." };
    bk.status = status;
    notify(bk.ownerId, "booking", "Appointment updated", (byId(db.services, bk.serviceId) || {}).name + " for " + (byId(db.pets, bk.petId) || {}).petName + " is now " + status + ".");
    audit("Booking status", bk.id + " -> " + status);
    persist();
    return { booking: bk };
  }

  function addBookingNote(bookingId, note) {
    if (remoteEnabled()) return remoteMutation("addBookingNote", { bookingId, note });
    const admin = currentAdmin();
    if (!admin || !can("bookings.notes")) return { error: "Not authorized." };
    const bk = byId(db.bookings, bookingId);
    if (!bk) return { error: "Booking not found." };
    bk.internalNotes = (bk.internalNotes || []).concat([{ by: (currentAdmin() || {}).name || "Staff", note, at: todayISO() }]);
    audit("Internal note added", bk.id);
    persist();
    return { booking: bk };
  }

  /* ---------------------------- orders API ---------------------------- */
  function placeOrder(items, fulfillment, address) {
    if (remoteEnabled()) return remoteMutation("placeOrder", { items, fulfillment, address });
    const owner = currentOwner();
    if (!owner) return { error: "Please sign in to checkout." };
    const lines = items.map((i) => {
      const p = byId(db.products, i.id);
      const qty = Number(i.qty);
      if (!p || !Number.isInteger(qty) || qty <= 0) return null;
      if (qty > p.stock) return null;
      return { productId: p.id, qty, price: p.price };
    }).filter(Boolean);
    if (!lines.length) return { error: "Your cart is empty." };
    /* Members get their plan discount on the order subtotal. */
    const rate = discountRate(owner);
    const sub = lines.reduce((n, l) => n + l.price * l.qty, 0);
    const total = Math.round(sub * (1 - rate) * 100) / 100;
    const pm = (db.payments || []).find((p) => p.ownerId === owner.id && p.primary) || (db.payments || []).find((p) => p.ownerId === owner.id);
    const order = {
      id: "or-" + (2000 + db.orders.length + 1),
      ownerId: owner.id, placedAt: todayISO(), items: lines,
      fulfillment: fulfillment === "pickup" ? "pickup" : "delivery",
      address: fulfillment === "pickup" ? "" : (address || owner.address),
      status: "open", stage: "pending", total, paid: 0, paymentStatus: "demo-pending",
      method: pm ? pm.brand + " ending " + pm.last4 : "Visa ending 4242",
      discountRate: rate || undefined
    };
    db.orders.push(order);
    lines.forEach((l) => {
      const p = byId(db.products, l.productId);
      if (p) { p.stock = Math.max(0, p.stock - l.qty); p.lowStock = p.stock <= p.lowAt; }
    });
    notify(owner.id, "order", "Order " + order.id + " received",
      "Thanks! Your order is " + (order.fulfillment === "pickup" ? "being prepared for store pickup" : "on its way") + ".");
    audit("Order placed", order.id + " — " + money(total));
    persist();
    return { order };
  }

  function setOrderStage(orderId, stage) {
    if (remoteEnabled()) return remoteMutation("setOrderStage", { orderId, stage });
    const admin = currentAdmin();
    if (!admin || !can("payments.take")) return { error: "Not authorized." };
    const o = byId(db.orders, orderId);
    if (!o) return { error: "Order not found." };
    const stages = ["pending","packing","ready","shipped","done"];
    if (stage === "cancelled") return { error: "Order cancellation requires a refund workflow." };
    if (stages.indexOf(stage) === -1) return { error: "Invalid order stage." };
    const current = stages.indexOf(o.stage || "pending");
    const next = stages.indexOf(stage);
    if (Math.abs(next - current) > 1) return { error: "Invalid order transition." };
    o.stage = stage;
    if (stage === "done") o.status = "delivered";
    if (stage === "cancelled") o.status = "cancelled";
    notify(o.ownerId, "order", "Order " + o.id + " updated", "Status: " + stage + ".");
    audit("Order stage", o.id + " -> " + stage);
    persist();
    return { order: o };
  }

  function refund(orderId, amount) {
    if (remoteEnabled()) return remoteMutation("refund", { orderId, amount });
    const admin = currentAdmin();
    if (!admin || !can("payments.refund")) return { error: "Not authorized." };
    const o = byId(db.orders, orderId);
    if (!o) return { error: "Order not found." };
    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested <= 0) return { error: "Refund amount must be greater than zero." };
    const amt = Math.min(requested, o.paid);
    if (amt <= 0) return { error: "There is no refundable balance." };
    o.paid = Math.max(0, o.paid - amt);
    o.refunded = (o.refunded || 0) + amt;
    notify(o.ownerId, "order", "Refund issued", money(amt) + " refunded on order " + o.id + ".");
    audit("Refund issued", o.id + " — " + money(amt));
    persist();
    return { order: o };
  }

  /* ---------------------------- listings ------------------------------ */
  function submitInquiry(listingId, message2) {
    if (remoteEnabled()) return remoteMutation("submitInquiry", { listingId, message: message2 });
    const owner = currentOwner();
    const l = byId(db.listings, listingId);
    if (!l) return { error: "Listing not found." };
    if (l.status !== "available") return { error: l.name + " is no longer available." };
    db.inquiryCounter = (db.inquiryCounter || 0) + 1;
    const ref = "INQ-" + String(db.inquiryCounter).padStart(4, "0");
    db.inquiries = db.inquiries || [];
    db.inquiries.unshift({ id: uid("inq"), ref, ownerId: owner ? owner.id : null, listingId: l.id, message: String(message2 || "").trim().slice(0, 2000), status: "new", createdAt: todayISO() });
    if (owner) notify(owner.id, "listing", "Inquiry " + ref + " sent", "We'll contact you about " + l.name + " within one business day.");
    audit("Purchase inquiry", ref + " — " + l.name);
    persist();
    return { ref };
  }

  function setListingStatus(listingId, status) {
    if (remoteEnabled()) return remoteMutation("setListingStatus", { listingId, status });
    const admin = currentAdmin();
    if (!admin || !can("listings.edit")) return { error: "Not authorized." };
    const l = byId(db.listings, listingId);
    if (!l) return { error: "Listing not found." };
    if (!["available","reserved","sold"].includes(status)) return { error: "Invalid listing status." };
    l.status = status;
    audit("Listing status", l.name + " -> " + status);
    persist();
    return { listing: l };
  }

  /* --------------------------- inventory ------------------------------ */
  function adjustStock(productId, delta, note) {
    if (remoteEnabled()) return remoteMutation("adjustStock", { productId, delta, note });
    const admin = currentAdmin();
    if (!admin || !can("inventory.edit")) return { error: "Not authorized." };
    const p = byId(db.products, productId);
    if (!p) return { error: "Product not found." };
    const d = Number(delta);
    if (!Number.isInteger(d)) return { error: "Invalid stock adjustment." };
    p.stock = Math.max(0, p.stock + d);
    p.lowStock = p.stock <= p.lowAt;
    audit("Stock adjusted", p.name + " " + (delta >= 0 ? "+" : "") + delta + (note ? " — " + note : ""));
    persist();
    return { product: p };
  }
  function updateProduct(productId, patch) {
    if (remoteEnabled()) return remoteMutation("updateProduct", { productId, patch });
    const admin = currentAdmin();
    if (!admin || !can("inventory.edit")) return { error: "Not authorized." };
    const p = byId(db.products, productId);
    if (!p) return { error: "Product not found." };
    ["name", "cat", "price", "stock", "lowAt", "desc", "icon"].forEach((k) => {
      if (patch[k] !== undefined) p[k] = patch[k];
    });
    if (!Number.isFinite(Number(p.price)) || Number(p.price) < 0 ||
        !Number.isInteger(Number(p.stock)) || Number(p.stock) < 0 ||
        !Number.isInteger(Number(p.lowAt)) || Number(p.lowAt) < 0) {
      return { error: "Invalid product values." };
    }
    p.lowStock = p.stock <= p.lowAt;
    audit("Product edited", p.name);
    persist();
    return { product: p };
  }

  /* ----------------------------- CMS ---------------------------------- */
  function updateCMS(patch) {
    if (remoteEnabled()) return remoteMutation("updateCMS", { patch });
    const admin = currentAdmin();
    if (!admin || !can("cms.edit")) return { error: "Not authorized." };
    Object.assign(db.cms, patch);
    audit("CMS update", Object.keys(patch).join(", "));
    persist();
    return db.cms;
  }
  function updateService(serviceId, patch) {
    if (remoteEnabled()) return remoteMutation("updateService", { serviceId, patch });
    const admin = currentAdmin();
    if (!admin || !can("cms.edit")) return { error: "Not authorized." };
    const s = byId(db.services, serviceId);
    if (!s) return { error: "Service not found." };
    ["name", "price", "duration", "desc", "popular"].forEach((k) => {
      if (patch[k] !== undefined) s[k] = patch[k];
    });
    if (!s.name || !Number.isFinite(Number(s.price)) || Number(s.price) < 0 || !Number.isFinite(Number(s.duration)) || Number(s.duration) <= 0 || Number(s.duration) > 24) return { error: "Invalid service values." };
    audit("Service edited", s.name + " — " + money(s.price));
    persist();
    return { service: s };
  }

  /* ------------------------- staff & waitlist ------------------------- */
  function addLeave(providerId, date, reason) {
    if (remoteEnabled()) return remoteMutation("addLeave", { providerId, date, reason });
    const admin = currentAdmin();
    if (!admin || !can("staff.manage")) return { error: "Not authorized." };
    if (!PROVIDER_BY_ID[providerId] || !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || String(date) < todayISO()) return { error: "Invalid leave date." };
    if (db.staffLeave.some(l => l.providerId === providerId && l.date === date)) return { error: "Leave is already booked for that day." };
    db.staffLeave.push({ id: uid("lv"), providerId, date, reason: String(reason || "Blocked").slice(0, 240) });
    audit("Staff leave", providerId + " on " + fmtDate(date));
    persist();
    return true;
  }
  function removeLeave(leaveId) {
    if (remoteEnabled()) return remoteMutation("removeLeave", { leaveId });
    const admin = currentAdmin();
    if (!admin || !can("staff.manage")) return { error: "Not authorized." };
    db.staffLeave = db.staffLeave.filter((l) => l.id !== leaveId);
    persist();
    return true;
  }
  function joinWaitlist(serviceId, providerId, note) {
    if (remoteEnabled()) return remoteMutation("joinWaitlist", { serviceId, providerId, note });
    const owner = currentOwner();
    if (!owner) return { error: "Please sign in to join the waitlist." };
    db.waitlist.push({ id: uid("wl"), ownerId: owner.id, serviceId, providerId, note: note || "", createdAt: todayISO() });
    notify(owner.id, "waitlist", "Added to the waitlist", "We'll text you the moment a slot opens up.");
    audit("Waitlist add", (byId(db.services, serviceId) || {}).name);
    persist();
    return true;
  }
  function removeWaitlist(waitlistId) {
    if (remoteEnabled()) return remoteMutation("removeWaitlist", { waitlistId });
    const owner = currentOwner();
    const admin = currentAdmin();
    const row = db.waitlist.find(w => w.id === waitlistId);
    if (!row) return { error: "Waitlist entry not found." };
    if (admin) { if (!can("bookings.manage")) return { error: "Not authorized." }; }
    else if (!owner || row.ownerId !== owner.id) return { error: "Not authorized." };
    db.waitlist = db.waitlist.filter((w) => w.id !== waitlistId);
    persist();
    return true;
  }

  /* ----------------------------- CRM ---------------------------------- */
  function updateOwner(ownerId, patch) {
    if (remoteEnabled()) return remoteMutation("updateOwner", { ownerId, patch });
    const actor = currentOwner();
    const a = currentAdmin();
    if (!actor && !a) return { error: "Not authorized." };
    if (a ? !can("crm.edit") : ownerId !== actor.id) return { error: "Not authorized." };
    const o = byId(db.owners, ownerId);
    if (!o) return { error: "Owner not found." };
    if (patch && patch.plan !== undefined && !Object.prototype.hasOwnProperty.call(PLAN_DISCOUNT, patch.plan)) return { error: "Invalid membership plan." };
    if (patch && patch.email !== undefined) {
      const email = String(patch.email).trim().toLowerCase();
      if (!isValidEmail(email)) return { error: "Enter a valid email address." };
      if (db.owners.some(x => x.id !== ownerId && x.email === email)) return { error: "An account with this email already exists." };
      patch.email = email;
    }
    ["fullName", "email", "phone", "emergencyContact", "address", "notes", "plan"].forEach((k) => {
      if (patch[k] !== undefined) o[k] = String(patch[k]);
    });
    audit("Owner updated", o.fullName);
    persist();
    return { owner: o };
  }

  function addPet(ownerId, input) {
    if (remoteEnabled()) return remoteMutation("addPet", { ownerId, input });
    const actor = currentOwner();
    const a = currentAdmin();
    if (!actor && !a) return { error: "Not authorized." };
    if (a ? !can("crm.edit") : ownerId !== actor.id) return { error: "Not authorized." };
    const o = byId(db.owners, ownerId);
    if (!o) return { error: "Owner not found." };
    const pet = {
      id: uid("pt"), ownerId, petName: String(input.petName || "").trim() || "New pet",
      species: SPECIES.indexOf(input.species) !== -1 ? input.species : "Dog",
      breed: String(input.breed || "").trim(), dob: input.dob || "",
      sex: SEXES.indexOf(input.sex) !== -1 ? input.sex : "Male",
      altered: ALTERED.indexOf(input.altered) !== -1 ? input.altered : "Intact",
      weightKg: Number(input.weightKg) || 0, microchip: String(input.microchip || "").trim(),
      coat: String(input.coat || "").trim(),
      tags: Array.isArray(input.tags) ? input.tags.filter((t) => TEMPERAMENTS.indexOf(t) !== -1) : [],
      vaccines: Array.isArray(input.vaccines) ? input.vaccines : [],
      notes: String(input.notes || ""), createdAt: todayISO()
    };
    db.pets.push(pet);
    audit("Pet added", pet.petName + " for " + o.fullName);
    persist();
    return { pet };
  }

  function updatePet(petId, patch) {
    if (remoteEnabled()) return remoteMutation("updatePet", { petId, patch });
    const actor = currentOwner();
    const a = currentAdmin();
    const p = byId(db.pets, petId);
    if (!p) return { error: "Pet not found." };
    if (!actor && !a) return { error: "Not authorized." };
    if (a ? !can("crm.edit") : p.ownerId !== actor.id) return { error: "Not authorized." };
    ["petName", "species", "breed", "dob", "sex", "altered", "weightKg", "microchip", "coat", "notes"].forEach((k) => {
      if (patch[k] !== undefined) p[k] = patch[k];
    });
    if (Array.isArray(patch.tags)) p.tags = patch.tags.filter((t) => TEMPERAMENTS.indexOf(t) !== -1);
    if (Array.isArray(patch.vaccines)) p.vaccines = patch.vaccines;
    audit("Pet updated", p.petName);
    persist();
    return { pet: p };
  }

  function removePet(petId) {
    if (remoteEnabled()) return remoteMutation("removePet", { petId });
    const actor = currentOwner();
    const a = currentAdmin();
    const p = byId(db.pets, petId);
    if (!p) return { error: "Pet not found." };
    if (!actor && !a) return { error: "Not authorized." };
    if (a ? !can("crm.edit") : p.ownerId !== actor.id) return { error: "Not authorized." };
    db.pets = db.pets.filter((x) => x.id !== petId);
    /* A removed pet cannot keep active bookings: cancel future
       appointments rather than orphaning them (which would leave
       phantom rows on the schedule and in the member's history). */
    let cancelled = 0;
    db.bookings.forEach(function (b) {
      if (b.petId === petId && b.status !== "cancelled" && b.status !== "completed" && b.status !== "no-show") {
        b.status = "cancelled";
        b.note = "Cancelled automatically when " + p.petName + " was removed from the account.";
        cancelled++;
      }
    });
    if (cancelled) {
      notify(p.ownerId, "booking", "Appointments cancelled",
        cancelled + " appointment" + (cancelled === 1 ? "" : "s") + " for " + p.petName +
        " were cancelled when the pet was removed from the account.");
    }
    audit("Pet removed", p.petName + (cancelled ? " — cancelled " + cancelled + " booking" + (cancelled === 1 ? "" : "s") : ""));
    persist();
    return true;
  }

  function addVaccine(petId, name, date, lot) {
    if (remoteEnabled()) return remoteMutation("addVaccine", { petId, name, date, lot });
    const actor = currentOwner();
    const p = byId(db.pets, petId);
    if (!p) return { error: "Pet not found." };
    if (!actor || p.ownerId !== actor.id) return { error: "Not authorized." };
    p.vaccines = (p.vaccines || []).concat([{ name, date, lot: lot || "", status: "pending" }]);
    audit("Vaccine uploaded", p.petName + " — " + name + " (pending review)");
    persist();
    return { pet: p };
  }
  function setVaccineStatus(petId, index, status) {
    if (remoteEnabled()) return remoteMutation("setVaccineStatus", { petId, index, status });
    const admin = currentAdmin();
    if (!admin || !can("crm.edit")) return { error: "Not authorized." };
    const p = byId(db.pets, petId);
    if (!p || !p.vaccines[index]) return { error: "Record not found." };
    if (!["approved","rejected","pending"].includes(status)) return { error: "Invalid vaccine status." };
    p.vaccines[index].status = status;
    audit("Vaccine " + status, p.petName + " — " + p.vaccines[index].name);
    persist();
    return { pet: p };
  }

  function searchCRM(q) {
    const t = String(q || "").trim().toLowerCase();
    if (!t) return { owners: [], pets: [], bookings: [] };
    let owners = db.owners.slice();
    let pets = db.pets.slice();
    let bookings = db.bookings.slice();
    const a = currentAdmin();
    if (a && a.role === "provider" && a.providerId) {
      bookings = bookings.filter(b => b.providerId === a.providerId);
      const ownerIds = new Set(bookings.map(b => b.ownerId));
      const petIds = new Set(bookings.map(b => b.petId));
      owners = owners.filter(o => ownerIds.has(o.id));
      pets = pets.filter(p => petIds.has(p.id));
    }
    owners = owners.filter((o) => (o.fullName + " " + o.email + " " + (o.phone || "")).toLowerCase().indexOf(t) !== -1);
    pets = pets.filter((p) => (p.petName + " " + p.breed + " " + p.microchip).toLowerCase().indexOf(t) !== -1);
    bookings = bookings.filter((b) => b.id.toLowerCase().indexOf(t) !== -1);
    return { owners, pets, bookings };
  }

  /* ----------------------------- POS ---------------------------------- */
  /* Charge a customer for products, a service and a booking in a
     single transaction — the "integrated checkout". */
  function posCharge(ownerId, lines, method) {
    if (remoteEnabled()) return remoteMutation("posCharge", { ownerId, lines, method });
    const admin = currentAdmin();
    if (!admin || !can("payments.take")) return { error: "Not authorized." };
    if (!byId(db.owners, ownerId)) return { error: "Owner not found." };
    if (!Array.isArray(lines) || !lines.length) return { error: "No POS lines." };
    const normalized = lines.map(l => ({ label: String(l.label || l.productId || "POS item").trim().slice(0, 120), amount: Number(l.amount) }));
    if (!normalized.length || normalized.some(l => !l.label || !Number.isFinite(l.amount) || l.amount <= 0)) return { error: "Invalid POS line." };
    const total = Math.round(normalized.reduce((n, l) => n + l.amount, 0) * 100) / 100;
    const o = {
      id: "or-" + (2000 + db.orders.length + 1),
      ownerId, placedAt: todayISO(),
      items: normalized.map((l) => ({ productId: "pos", qty: 1, price: l.amount })),
      fulfillment: "pos", address: "", status: "delivered", stage: "done",
      total, paid: total, method: method || "Cash"
    };
    db.orders.push(o);
    audit("POS charge", o.id + " — " + money(total) + " (" + (method || "Cash") + ")");
    persist();
    return { order: o, total };
  }

  /* ---------------------------- payments ------------------------------ */
  function addPaymentMethod(ownerId, brand, last4, expMonth, expYear) {
    if (remoteEnabled()) return remoteMutation("addPaymentMethod", { ownerId, brand, last4, expMonth, expYear });
    const actor = currentOwner();
    if (!actor || actor.id !== ownerId) return false;
    db.payments = (db.payments || []).filter((p) => !(p.ownerId === ownerId && p.last4 === last4));
    db.payments.push({ id: uid("pm"), ownerId, brand, last4, expMonth, expYear, primary: db.payments.filter((p) => p.ownerId === ownerId).length === 0 });
    audit("Payment method added", brand + " ending " + last4);
    persist();
    return true;
  }
  function removePaymentMethod(payId) {
    if (remoteEnabled()) return remoteMutation("removePaymentMethod", { payId });
    const actor = currentOwner();
    const pm = byId(db.payments || [], payId);
    if (!actor || !pm || pm.ownerId !== actor.id) return false;
    db.payments = (db.payments || []).filter((p) => p.id !== payId);
    persist();
    return true;
  }
  function setPrimaryPayment(payId) {
    if (remoteEnabled()) return remoteMutation("setPrimaryPayment", { payId });
    const actor = currentOwner();
    const pm = byId(db.payments || [], payId);
    if (!actor || !pm || pm.ownerId !== actor.id) return;
    (db.payments || []).forEach((p) => { p.primary = p.id === payId; });
    persist();
  }

  /* ------------------------------ export ------------------------------ */
  global.PNC_DB = {
    /* constants */
    KEY, CURRENCY, DEPOSIT_RATE, PLAN_DISCOUNT, SPECIES, SEXES, ALTERED, VACCINES, TEMPERAMENTS,
    SERVICE_GROUPS, ADMIN_ROLES, STAGES, PRODUCTS, PRODUCT_BY_ID, SERVICES, SERVICE_BY_ID,
    PROVIDERS, PROVIDER_BY_ID, DAY_START, DAY_END, STEP,
    /* helpers */
    esc, money, uid, isoDate, todayISO, addDays, fmtDate, fmtTime, fmtDT, daysBetween,
    isValidEmail, clone, titleCase, speciesIcon, initials, parseD, productionMode, applyRemoteSnapshot,
    /* store */
    load, persist, reset, seed,
    /* lookups */
    byId, petsOf, ownerOf, bookingsOf, ordersOf, upcoming, past, groupById,
    petAge, petStage, vaccinesOk, stats,
    /* availability */
    slotsFor, firstOpenDate, providerWorking, providerLeave, hash01,
    /* engine */
    notify, message, audit,
    /* owner auth */
    signUp, logIn, logInRemote, logOut, clearSession, currentOwner, setSession,
    migrateLegacy, hashPw, localOwner, resolveOwner,
    /* clerk bridge */
    clerkOn, demoMode,
    /* admin auth + RBAC */
    adminLogin, adminLogout, session, currentAdmin, can, scopeOf, PERMS,
    /* booking */
    createBooking, rescheduleBooking, cancelBooking, setBookingStatus, addBookingNote,
    /* orders */
    placeOrder, setOrderStage, refund,
    /* listings */
    submitInquiry, setListingStatus,
    /* inventory */
    adjustStock, updateProduct,
    /* cms */
    updateCMS, updateService,
    /* staff */
    addLeave, removeLeave, joinWaitlist, removeWaitlist,
    /* crm */
    updateOwner, addPet, updatePet, removePet, addVaccine, setVaccineStatus, searchCRM,
    /* pos + payments */
    posCharge, addPaymentMethod, removePaymentMethod, setPrimaryPayment,
    /* raw accessor for admin views */
    get db() { return db; }
  };
})(window);
