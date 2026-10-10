import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// No live subscription benefits have been configured. Demo discounts stay local.
const PLANS = { puppy: 0, adult: 0, senior: 0 };
const ROLES = ["super", "desk", "provider", "retail"];
const PERMS = {
  super: { everything: true },
  desk: {
    "crm.view": true, "crm.edit": true, "bookings.manage": true, "bookings.view": true,
    "bookings.notes": true, "messages.send": true, "payments.take": true,
    "payments.refund": false, "cms.edit": false, "inventory.edit": false,
    "listings.edit": false, "reports.view": false, "staff.manage": false, "roles.edit": false
  },
  provider: {
    "crm.view": "own", "bookings.view": "own", "bookings.notes": "own",
    "messages.send": "own", "payments.take": false, "payments.refund": false,
    "cms.edit": false, "inventory.edit": false, "listings.edit": false,
    "reports.view": false, "staff.manage": false, "roles.edit": false
  },
  retail: {
    "crm.view": false, "bookings.view": false, "bookings.manage": false,
    "bookings.notes": false, "messages.send": true, "payments.take": true,
    "payments.refund": false, "cms.edit": false, "inventory.edit": true,
    "listings.edit": true, "reports.view": true, "staff.manage": false, "roles.edit": false
  }
};

const SERVICE_GROUPS = [
  { id: "vet", name: "Veterinary", icon: "&#129658;", blurb: "Wellness exams, vaccinations, and surgery with licensed veterinarians." },
  { id: "grooming", name: "Grooming & Washing", icon: "&#128136;", blurb: "Baths, haircuts, nail trims and spa add-ons by certified groomers." },
  { id: "sitting", name: "Pet Sitting & Boarding", icon: "&#127968;", blurb: "Daycare, overnight stays and in-home sitting with daily photo updates." },
  { id: "training", name: "Behavioral Training", icon: "&#127893;", blurb: "Puppy basics, obedience and agility with positive-reinforcement trainers." }
];

const PROVIDERS = [
  { id: "Dana", name: "Dr. Dana Whitfield", role: "Veterinarian", title: "DVM, Chief of Medicine", group: "vet", icon: "&#129658;", start: 8, end: 16, off: [0], bio: "14 years in small-animal practice. Loves a good dental." },
  { id: "Marcus", name: "Dr. Marcus Ito", role: "Veterinarian", title: "DVM, Surgery", group: "vet", icon: "&#129658;", start: 10, end: 18, off: [0], bio: "Soft-tissue surgery and dentals. Cat whisperer." },
  { id: "Rosa", name: "Rosa Delgado", role: "Groomer", title: "Certified Master Groomer", group: "grooming", icon: "&#128136;", start: 9, end: 17, off: [0], bio: "Breed-standard clips and de-shed wizard." },
  { id: "Talia", name: "Talia Nguyen", role: "Groomer", title: "Groomer & Spa Lead", group: "grooming", icon: "&#128136;", start: 9, end: 17, off: [1, 0], bio: "Cat specialist." },
  { id: "Priya", name: "Priya Raman", role: "Sitter", title: "Daycare & Boarding Lead", group: "sitting", icon: "&#127968;", start: 7, end: 19, off: [], bio: "Runs the play yard and sends photo updates." },
  { id: "Owen", name: "Owen Brooks", role: "Sitter", title: "In-Home Sitting Specialist", group: "sitting", icon: "&#127968;", start: 8, end: 20, off: [0], bio: "Overnights and drop-ins for senior and shy pets." },
  { id: "Coach Ray", name: "Ray Carter", role: "Trainer", title: "CPDT-KA Trainer", group: "training", icon: "&#127893;", start: 10, end: 19, off: [0], bio: "Positive reinforcement only." }
];

const DEFAULT_CMS = {
  id: "site",
  siteName: "Paws & Claws",
  tagline: "Care, play & community in Amasoma.",
  banner: "",
  heroTitle: "More joy for every paw.",
  catalogConfirmed: false,
  emergencyHotline: "",
  emergencyNote: "For urgent pet health concerns, contact a local veterinary clinic. Online messages are not monitored for emergencies.",
  hours: [],
  toggles: {},
  address: "Amasoma",
  phone: "",
  email: ""
};

// First-run production catalog. This is only used by the one-time, super-admin
// guarded initializer; after insertion, every record is edited through CMS.
const SERVICE_CATALOG = [
  { id: "sv-bath", group: "grooming", name: "Bath & Brush", icon: "&#128704;", price: 28, duration: 1, deposit: true, requiresVaccine: true, staff: ["Rosa", "Talia"], desc: "Gentle bathing, brushing, drying and a tidy finish matched to your pet's coat.", popular: true },
  { id: "sv-haircut", group: "grooming", name: "Coat Trim & Style", icon: "&#128136;", price: 52, duration: 1.5, deposit: true, requiresVaccine: true, staff: ["Rosa", "Talia"], desc: "Coat trimming and styling with practical care guidance for home.", popular: true },
  { id: "sv-deshed", group: "grooming", name: "De-Shedding Treatment", icon: "&#129508;", price: 42, duration: 1.5, deposit: true, requiresVaccine: true, staff: ["Rosa"], desc: "A thorough undercoat release and brush-out to reduce shedding at home." },
  { id: "sv-nails", group: "grooming", name: "Nail, Ear & Hygiene Care", icon: "&#128063;", price: 18, duration: 0.5, deposit: false, requiresVaccine: false, staff: ["Rosa", "Talia"], desc: "Calm nail trimming, gentle ear cleaning and essential hygiene care." },
  { id: "sv-dropin", group: "sitting", name: "PawPlay Daycare — Half-Day", icon: "&#128021;", price: 24, duration: 4, deposit: true, requiresVaccine: true, staff: ["Priya", "Owen"], desc: "Limited-place supervised play, enrichment, feeding instructions and a rest break." },
  { id: "sv-daycare", group: "sitting", name: "PawPlay Daycare — Full-Day", icon: "&#128021;", price: 38, duration: 8, deposit: true, requiresVaccine: true, staff: ["Priya", "Owen"], desc: "Supervised care, enrichment, owner-directed feeding, rest breaks and an update.", popular: true },
  { id: "sv-overnight", group: "sitting", name: "PawStay Overnight Boarding", icon: "&#127968;", price: 58, duration: 24, deposit: true, requiresVaccine: true, staff: ["Priya", "Owen"], desc: "Contact-led overnight care with separate rest areas, recorded feeding and daily monitoring." },
  { id: "sv-wellness", group: "vet", name: "PawHealth Vet Day Consultation", icon: "&#129658;", price: 65, duration: 0.5, deposit: true, requiresVaccine: false, staff: ["Dana", "Marcus"], desc: "Scheduled consultation with a registered veterinary professional.", popular: true },
  { id: "sv-vaccination", group: "vet", name: "Wellness Check & Vaccination", icon: "&#128137;", price: 38, duration: 0.5, deposit: false, requiresVaccine: false, staff: ["Dana", "Marcus"], desc: "Routine wellness check, vaccination review and appropriate vaccine administration." },
  { id: "sv-dental", group: "vet", name: "Deworming & Parasite Advice", icon: "&#129702;", price: 30, duration: 0.5, deposit: false, requiresVaccine: false, staff: ["Dana"], desc: "Vet-led deworming and parasite-prevention advice for your pet's lifestyle." },
  { id: "sv-surgery", group: "vet", name: "PawHealth Vet Day Follow-Up", icon: "&#128300;", price: 45, duration: 0.5, deposit: false, requiresVaccine: false, staff: ["Dana", "Marcus"], desc: "A scheduled review of an existing care plan by a registered professional." },
  { id: "sv-puppy", group: "training", name: "Puppy Foundations", icon: "&#128062;", price: 45, duration: 1, deposit: true, requiresVaccine: false, staff: ["Coach Ray"], desc: "Puppy foundations, confidence, name response and toilet-training support." },
  { id: "sv-obedience", group: "training", name: "Loose-Leash & Recall", icon: "&#127893;", price: 60, duration: 1.5, deposit: true, requiresVaccine: true, staff: ["Coach Ray"], desc: "Practical leash walking, recall and everyday handling skills for owners and dogs.", popular: true },
  { id: "sv-agility", group: "training", name: "Socialisation & Owner Coaching", icon: "&#127919;", price: 55, duration: 1, deposit: true, requiresVaccine: true, staff: ["Coach Ray"], desc: "Supported socialisation, humane handling and a clear home practice plan." }
];

const DAY_START = 8;
const DAY_END = 19;
const STEP = 0.5;

const STORE_TIME_ZONE = "Africa/Lagos";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function storeClock() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "long"
  }).formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return { date: parts.year + "-" + parts.month + "-" + parts.day, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: parts.weekday };
}
function today() { return storeClock().date; }
function parseDate(s) {
  const p = String(s || "").split("-").map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}
function uid(prefix) {
  return prefix + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
function prepareStoreSale(lines, products, method, options) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw new Error("Add between 1 and 100 sale lines.");
  if (!["Cash", "Bank transfer"].includes(method)) throw new Error("Choose cash or bank transfer.");
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(options.requestId || "")) throw new Error("A sale reference is required. Refresh and try again.");
  const quantities = new Map();
  const items = lines.map(line => {
    const qty = Number(line.qty === undefined ? 1 : line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 9999) throw new Error("Quantity must be a whole number between 1 and 9,999.");
    const product = line.productId ? products.find(p => p.id === line.productId && p.active !== false) : null;
    if (line.productId && !product) throw new Error("Product no longer exists.");
    const label = String(product ? product.name : line.label || "").trim().slice(0, 120);
    const price = Number(product ? product.price : line.amount);
    if (!label || !Number.isFinite(price) || price <= 0 || price > 1000000) throw new Error("Each line needs a description and a positive price.");
    if (product) quantities.set(product.id, (quantities.get(product.id) || 0) + qty);
    return {productId: product ? product.id : "pos", label, qty, price: Math.round(price * 100) / 100};
  });
  for (const [id, qty] of quantities) {
    const product = products.find(p => p.id === id);
    if (!Number.isInteger(product.stock) || qty > product.stock) throw new Error("Not enough stock for " + product.name + ".");
  }
  const total = Math.round(items.reduce((sum, item) => sum + item.qty * item.price, 0) * 100) / 100;
  if (total <= 0 || total > 1000000) throw new Error("Sale total must be between 0.01 and 1,000,000.");
  const tendered = method === "Cash" && options.tendered !== undefined && options.tendered !== "" ? Number(options.tendered) : total;
  if (!Number.isFinite(tendered) || tendered < total || tendered > 1000000) throw new Error("Cash received must cover the total.");
  return { items, total, quantities, tendered: Math.round(tendered * 100) / 100,
    change: Math.round((tendered - total) * 100) / 100, reference: String(options.reference || "").trim().slice(0, 120) };
}

function round2(n) { return Math.round(n * 100) / 100; }
function hash01(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}
function dateOnly(s) { return String(s).slice(0, 10); }
function validDateOnly(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = parseDate(s);
  return d.getFullYear() === Number(s.slice(0, 4)) && d.getMonth() + 1 === Number(s.slice(5, 7)) && d.getDate() === Number(s.slice(8, 10));
}

function validatePetInput(input) {
  if (input.petName !== undefined && !String(input.petName).trim()) throw new Error("Give your pet a name.");
  if (input.weightKg !== undefined && (!Number.isFinite(Number(input.weightKg)) || Number(input.weightKg) < 0)) throw new Error("Weight must be a non-negative number.");
  if (input.species !== undefined && !["Dog","Cat","Bird","Rabbit","Reptile","Small Mammal","Fish"].includes(input.species)) throw new Error("Choose a valid species.");
  if (input.dob && (!validDateOnly(input.dob) || input.dob > today())) throw new Error("Enter a valid birth date that is not in the future.");
}

async function identity(ctx) {
  const id = await ctx.auth.getUserIdentity();
  if (!id) throw new Error("Not authenticated.");
  return id;
}

// Email can claim an unlinked record only after the identity provider has
// verified it. A record already bound to another subject cannot be reclaimed.
async function recordForIdentity(ctx, table, id) {
  const bound = await ctx.db.query(table).withIndex("by_clerkId", q => q.eq("clerkId", id.subject)).first();
  if (bound) return bound;
  if (!id.email || id.emailVerified !== true) return null;
  const candidate = await ctx.db.query(table).withIndex("by_email", q => q.eq("email", id.email.trim().toLowerCase())).first();
  return candidate && (!candidate.clerkId || candidate.clerkId === id.subject) ? candidate : null;
}

async function ownerFor(ctx, allowCreate = false, profile = {}) {
  const id = await identity(ctx);
  if (await recordForIdentity(ctx, "admins", id)) return null;

  let owner = await recordForIdentity(ctx, "owners", id);
  if (!owner && allowCreate) {
    // A new profile is bound to the authenticated Clerk subject. The client
    // supplies the verified Clerk profile fields because some Convex JWT
    // templates omit email/name claims; those fields never authorize access.
    const email = String(id.email || profile.email || "").trim().toLowerCase();
    const fullName = String(id.name || profile.fullName || email || "Member").trim().slice(0, 120);
    const phone = String(profile.phone || "").trim().slice(0, 40);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Your account needs an email address before creating a member profile.");
    if (await ctx.db.query("owners").withIndex("by_email", q => q.eq("email", email)).first()) throw new Error("This email is already linked to another account. Contact support.");
    owner = {
      id: "ow-" + crypto.randomUUID().slice(0, 8),
      clerkId: id.subject,
      fullName,
      email,
      phone,
      emergencyContact: "",
      address: "",
      plan: "puppy",
      notes: "",
      createdAt: today()
    };
    owner._id = await ctx.db.insert("owners", owner);
  }
  return owner;
}

async function adminFor(ctx) {
  const id = await identity(ctx);
  const admin = await recordForIdentity(ctx, "admins", id);
  if (!admin || !ROLES.includes(admin.role)) return null;
  return admin;
}

function permission(admin, perm) {
  if (!admin) return false;
  if (admin.role === "super") return "all";
  const value = (PERMS[admin.role] || {})[perm];
  return value === true ? "all" : value === "own" ? "own" : false;
}

function requirePermission(admin, perm) {
  const scope = permission(admin, perm);
  if (!scope) throw new Error("Not authorized.");
  return scope;
}

function ownerScoped(admin, scope, ownerId, petId, bookingId) {
  if (scope !== "own") return true;
  if (admin.providerId == null) return false;
  return { ownerId, petId, bookingId };
}

async function getService(ctx, id) {
  return await ctx.db.query("services").withIndex("by_external_id", q => q.eq("id", id)).first();
}
async function getProvider(ctx, id) {
  return await ctx.db.query("providers").withIndex("by_external_id", q => q.eq("id", id)).first();
}
async function getPet(ctx, id) {
  return await ctx.db.query("pets").withIndex("by_external_id", q => q.eq("id", id)).first();
}
async function getOwnerById(ctx, id) {
  return await ctx.db.query("owners").filter(q => q.eq(q.field("id"), id)).first();
}
async function getBooking(ctx, id) {
  return await ctx.db.query("bookings").withIndex("by_external_id", q => q.eq("id", id)).first();
}
async function getProduct(ctx, id) {
  return await ctx.db.query("products").withIndex("by_external_id", q => q.eq("id", id)).first();
}
async function getOrder(ctx, id) {
  return await ctx.db.query("orders").withIndex("by_external_id", q => q.eq("id", id)).first();
}
function activeBookingStatus(status) {
  return !["cancelled", "completed", "no-show"].includes(status);
}
function serviceProviders(service, providers) {
  return providers.filter(p => (service.staff || []).includes(p.id));
}
function clockMinutes(value) {
  const match = String(value || "").match(/^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/);
  return match ? (Number(match[1]) % 12 + (match[3] === "PM" ? 12 : 0)) * 60 + Number(match[2]) : null;
}
async function slotAvailable(ctx, service, provider, date, hour, ignoreBookingId, durationOverride, petId) {
  const duration = Number(durationOverride ?? service.duration);
  if (duration >= 24 || provider.active === false) return false;
  const d = parseDate(date);
  if (!validDateOnly(date)) return false;
  const now = storeClock();
  if (date < now.date) return false;
  if (provider.off && provider.off.includes(d.getDay())) return false;
  const leave = await ctx.db.query("staffLeave").filter(q => q.eq(q.field("providerId"), provider.id)).collect();
  if (leave.some(x => x.date === date)) return false;
  const t = Number(hour);
  if (!Number.isFinite(t) || Math.round(t * 2) !== t * 2) return false;
  if (date === now.date && t * 60 <= now.minutes) return false;
  const cms = await ctx.db.query("cms").first();
  if (Array.isArray(cms?.hours) && cms.hours.length) {
    const targetWeekday = WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()];
    const storeDay = cms.hours.find(row => row.day === targetWeekday);
    if (!storeDay || storeDay.open === "Closed" || storeDay.close === "Closed") return false;
    const open = clockMinutes(storeDay.open), close = clockMinutes(storeDay.close);
    if (open === null || close === null || t * 60 < open || (t + duration) * 60 > close) return false;
  }
  if (t < Math.max(DAY_START, provider.start) || t + duration > Math.min(DAY_END, provider.end)) return false;
  const providerBookings = await ctx.db.query("bookings").withIndex("by_providerId_date", q => q.eq("providerId", provider.id).eq("date", date)).collect();
  if (providerBookings.some(b => b.id !== ignoreBookingId && activeBookingStatus(b.status) && t < b.hour + b.duration && b.hour < t + duration)) return false;
  if (petId) {
    const petBookings = await ctx.db.query("bookings").withIndex("by_petId_date", q => q.eq("petId", petId).eq("date", date)).collect();
    if (petBookings.some(b => b.id !== ignoreBookingId && activeBookingStatus(b.status) && t < b.hour + b.duration && b.hour < t + duration)) return false;
  }
  return true;
}

async function claimImage(ctx, storageId, attachedTo) {
  const id = await identity(ctx);
  const upload = await ctx.db.query("uploads").withIndex("by_storageId", q => q.eq("storageId", storageId)).first();
  if (!upload || upload.subject !== id.subject || (upload.attachedTo && upload.attachedTo !== attachedTo)) throw new Error("Upload is not authorized for this record.");
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata || !/^image\/(jpeg|png|webp|gif)$/i.test(metadata.contentType || "") || metadata.size > 8 * 1024 * 1024) throw new Error("Choose a JPG, PNG, WEBP or GIF image up to 8 MB.");
  await ctx.db.patch(upload._id, { attachedTo });
}

async function notify(ctx, ownerId, kind, title, body) {
  await ctx.db.insert("notifications", { id: uid("nt"), ownerId, kind, title, body, read: false, createdAt: today() });
}
async function audit(ctx, admin, action, detail) {
  await ctx.db.insert("audit", {
    id: uid("au"),
    adminEmail: admin?.email || "system",
    action,
    detail,
    at: new Date().toISOString()
  });
}

async function limitSubmission(ctx, id, email) {
  const now = Date.now();
  // Per-sender and global burst budgets prevent a caller from bypassing the
  // guest limit by rotating email addresses. Edge bot protection can add a
  // network-level signal without weakening this server-side backstop.
  for (const [key, maximum] of [[id ? "user:" + id.subject : "email:" + email, 5], ["global", 100]]) {
    const row = await ctx.db.query("submissionLimits").withIndex("by_key", q => q.eq("key", key)).first();
    if (row && now - row.windowStart < 10 * 60 * 1000) {
      if (row.count >= maximum) throw new Error("Too many messages. Please wait ten minutes before trying again.");
      await ctx.db.patch(row._id, { count: row.count + 1 });
    } else if (row) await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    else await ctx.db.insert("submissionLimits", { key, windowStart: now, count: 1 });
  }
}

async function bounded(query, label, limit = 2000) {
  const rows = typeof query.take === "function" ? await query.take(limit + 1) : await query.collect();
  if (rows.length > limit) throw new Error(label + " has too many records for one view. Archive older operational records before reopening this view.");
  return rows;
}

async function bootstrapData(ctx) {
  const id = await ctx.auth.getUserIdentity();
  const cms = (await ctx.db.query("cms").first()) || null;
  const addImageUrls = async rows => Promise.all(rows.map(async row => {
    if (!row.imageStorageId) return row;
    const imageUrl = await ctx.storage.getUrl(row.imageStorageId);
    const { imageStorageId, ...safe } = row;
    return { ...safe, imageUrl: imageUrl || "" };
  }));
  const publicData = {
    version: 1,
    owners: [], pets: [], bookings: [], orders: [], listings: (await addImageUrls(await bounded(ctx.db.query("listings"), "listings"))).filter(listing => !["draft","archived"].includes(listing.status)),
    products: (await addImageUrls(await bounded(ctx.db.query("products"), "products"))).filter(product => product.active !== false).map(({ cost, ...p }) => p),
    services: (await addImageUrls(await bounded(ctx.db.query("services"), "services"))).filter(service => service.active !== false),
    serviceGroups: await bounded(ctx.db.query("serviceGroups"), "serviceGroups"),
    providers: (await bounded(ctx.db.query("providers"), "providers")).filter(provider => provider.active !== false),
    staffLeave: (await bounded(ctx.db.query("staffLeave"), "staffLeave")).map(l => ({ providerId: l.providerId, date: l.date })),
    occupiedSlots: (await bounded(ctx.db.query("bookings"), "bookings")).filter(b => b.date >= today() && activeBookingStatus(b.status))
      .map(b => ({ providerId: b.providerId, date: b.date, hour: b.hour, duration: b.duration })),
    waitlist: [], messages: [], notifications: [], payments: [],
    audit: [], admins: [], inquiries: [], contactMessages: [],
    cms,
    inquiryCounter: 0
  };
  const publicCatalog = data => cms?.catalogConfirmed ? data : {
    ...data, listings: [], products: [], services: [], serviceGroups: [], providers: []
  };
  if (!id) return publicCatalog(publicData);

  const admin = await adminFor(ctx);
  if (admin) {
    const out = { ...publicData };
    out.admins = [admin];
    if (permission(admin, "inventory.edit")) out.products = await addImageUrls(await bounded(ctx.db.query("products"), "products"));
    if (admin.role === "super") {
      out.admins = (await bounded(ctx.db.query("admins"), "admins")).map(({ _id, clerkId, ...safe }) => safe);
      out.providers = await bounded(ctx.db.query("providers"), "providers");
      out.services = await addImageUrls(await bounded(ctx.db.query("services"), "services"));
      out.owners = await bounded(ctx.db.query("owners"), "owners");
      out.pets = await addImageUrls(await bounded(ctx.db.query("pets"), "pets"));
      out.bookings = await bounded(ctx.db.query("bookings"), "bookings");
      out.orders = await bounded(ctx.db.query("orders"), "orders");
      out.listings = await addImageUrls(await bounded(ctx.db.query("listings"), "listings"));
      out.staffLeave = await bounded(ctx.db.query("staffLeave"), "staffLeave");
      out.waitlist = await bounded(ctx.db.query("waitlist"), "waitlist");
      out.messages = await bounded(ctx.db.query("messages"), "messages");
      out.notifications = await bounded(ctx.db.query("notifications"), "notifications");
      out.audit = await bounded(ctx.db.query("audit"), "audit");
      out.inquiries = await bounded(ctx.db.query("inquiries"), "inquiries");
      out.contactMessages = await bounded(ctx.db.query("contactMessages"), "contactMessages");
      return out;
    }
    if (admin.role === "desk") {
      out.owners = await bounded(ctx.db.query("owners"), "owners");
      out.pets = await addImageUrls(await bounded(ctx.db.query("pets"), "pets"));
      out.bookings = await bounded(ctx.db.query("bookings"), "bookings");
      out.orders = await bounded(ctx.db.query("orders"), "orders");
      out.listings = await addImageUrls(await bounded(ctx.db.query("listings"), "listings"));
      out.waitlist = await bounded(ctx.db.query("waitlist"), "waitlist");
      out.messages = await bounded(ctx.db.query("messages"), "messages");
      out.notifications = await bounded(ctx.db.query("notifications"), "notifications");
      out.audit = await bounded(ctx.db.query("audit"), "audit");
      out.inquiries = await bounded(ctx.db.query("inquiries"), "inquiries");
      out.contactMessages = await bounded(ctx.db.query("contactMessages"), "contactMessages");
      return out;
    }
    if (admin.role === "retail") {
      out.owners = (await bounded(ctx.db.query("owners"), "owners")).map(o => ({
        id: o.id, fullName: o.fullName, email: o.email, phone: o.phone || ""
      }));
      out.orders = await bounded(ctx.db.query("orders"), "orders");
      out.listings = await addImageUrls(await bounded(ctx.db.query("listings"), "listings"));
      out.audit = await bounded(ctx.db.query("audit"), "audit");
      out.inquiries = await bounded(ctx.db.query("inquiries"), "inquiries");
      out.contactMessages = await bounded(ctx.db.query("contactMessages"), "contactMessages");
      return out;
    }
    if (admin.role === "provider") {
      const bookings = await bounded(ctx.db.query("bookings").withIndex("by_providerId", q => q.eq("providerId", admin.providerId)), "provider bookings");
      const ownerIds = [...new Set(bookings.map(b => b.ownerId))];
      const petIds = [...new Set(bookings.map(b => b.petId))];
      out.bookings = bookings;
      out.owners = (await bounded(ctx.db.query("owners"), "owners")).filter(o => ownerIds.includes(o.id));
      out.pets = (await addImageUrls(await bounded(ctx.db.query("pets"), "pets"))).filter(p => petIds.includes(p.id));
      out.messages = (await bounded(ctx.db.query("messages"), "messages")).filter(m => ownerIds.includes(m.ownerId));
      return out;
    }
  }

  const owner = await ownerFor(ctx, false);
  if (!owner) return publicCatalog(publicData);
  return publicCatalog({
    ...publicData,
    owners: [(({ notes, ...profile }) => profile)(owner)],
    pets: await addImageUrls(await bounded(ctx.db.query("pets").withIndex("by_ownerId", q => q.eq("ownerId", owner.id)), "pets")),
    bookings: (await bounded(ctx.db.query("bookings").withIndex("by_ownerId", q => q.eq("ownerId", owner.id)), "bookings")).map(({ internalNotes, ...b }) => b),
    orders: await bounded(ctx.db.query("orders").withIndex("by_ownerId", q => q.eq("ownerId", owner.id)), "orders"),
    messages: await bounded(ctx.db.query("messages").withIndex("by_ownerId", q => q.eq("ownerId", owner.id)), "messages"),
    notifications: await bounded(ctx.db.query("notifications").withIndex("by_ownerId", q => q.eq("ownerId", owner.id)), "notifications"),
    payments: [],
    waitlist: await bounded(ctx.db.query("waitlist").withIndex("by_ownerId", q => q.eq("ownerId", owner.id)), "waitlist"),
    inquiries: await bounded(ctx.db.query("inquiries").withIndex("by_ownerId", q => q.eq("ownerId", owner.id)), "inquiries")
  });
}

export const bootstrap = query({
  args: {},
  handler: async (ctx) => bootstrapData(ctx)
});

const OPS = new Set([
  "generateUploadUrl","registerUpload",
  "grantAdminAccess","revokeAdminAccess","clearStaffProfiles","removeNonPawServices",
  "ensureOwner","markNotificationRead","markNotificationsRead","updateOwner","addPet","updatePet",
  "removePet","addVaccine","setVaccineStatus","createBooking","rescheduleBooking","cancelBooking",
  "setBookingStatus","addBookingNote","placeOrder","setOrderStage","refund","setListingStatus","createListing","updateListing","deleteListing",
  "adjustStock","updateProduct","createProduct","deleteProduct","updateCMS","updateService","createService","deleteService","updateProvider","createProvider","deleteProvider","addLeave","removeLeave",
  "joinWaitlist","removeWaitlist","posCharge","addPaymentMethod","removePaymentMethod",
  "setPrimaryPayment","submitContact","submitInquiry","createOwner","sendMessage","markMessageRead","setContactStatus","staffBooking","recordBookingPayment","refundBookingPayment","refundStoreSale"
]);

export const mutate = mutation({
  args: { op: v.string(), payload: v.any() },
  handler: async (ctx, { op, payload }) => {
    if (!OPS.has(op)) throw new Error("Unknown operation.");
    if (payload == null || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid operation payload.");
    const p = payload;

    if (op === "generateUploadUrl") {
      const id = await identity(ctx);
      const admin = await adminFor(ctx);
      const owner = await ownerFor(ctx, false);
      if (!admin && !owner) throw new Error("Not authorized.");
      const uploads = await ctx.db.query("uploads").withIndex("by_subject", q => q.eq("subject", id.subject)).collect();
      if (uploads.filter(row => !row.attachedTo && Date.now() - row.createdAt < 24 * 60 * 60 * 1000).length >= 10) throw new Error("Too many unfinished uploads. Try again later.");
      return { uploadUrl: await ctx.storage.generateUploadUrl() };
    }

    if (op === "registerUpload") {
      const id = await identity(ctx);
      const admin = await adminFor(ctx);
      const owner = await ownerFor(ctx, false);
      if (!admin && !owner) throw new Error("Not authorized.");
      const storageId = p.storageId;
      const metadata = await ctx.db.system.get("_storage", storageId);
      if (!metadata || !/^image\/(jpeg|png|webp|gif)$/i.test(metadata.contentType || "") || metadata.size > 8 * 1024 * 1024) {
        if (metadata) await ctx.storage.delete(storageId);
        throw new Error("Choose a JPG, PNG, WEBP or GIF image up to 8 MB.");
      }
      const existing = await ctx.db.query("uploads").withIndex("by_storageId", q => q.eq("storageId", storageId)).first();
      if (existing && existing.subject !== id.subject) throw new Error("Upload is not authorized.");
      if (!existing) await ctx.db.insert("uploads", { storageId, subject: id.subject, createdAt: Date.now() });
      return { ok: true, storageId };
    }

    if (op === "grantAdminAccess") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "roles.edit");
      const input = p.input || {};
      const role = String(input.role || "");
      const owner = await getOwnerById(ctx, String(input.ownerId || ""));
      if (!owner || !owner.clerkId || !owner.email || !ROLES.includes(role)) {
        throw new Error("Choose a registered account and a supported role.");
      }
      const email = owner.email.trim().toLowerCase();
      const name = owner.fullName;
      const existing = await ctx.db.query("admins").withIndex("by_email", q => q.eq("email", email)).first();
      if (existing) throw new Error("That email already has control panel access. Edit or revoke the existing entry.");
      const providerId = role === "provider" ? String(input.providerId || "") : "";
      if (role === "provider") {
        const provider = await getProvider(ctx, providerId);
        if (!provider || provider.active === false) throw new Error("Choose an active provider profile for this role.");
        if (provider.ownerId && provider.ownerId !== owner.id) throw new Error("That provider profile is already linked to another registered account.");
        await ctx.db.patch(provider._id, { ownerId: owner.id });
      }
      await ctx.db.insert("admins", { email, name, role, ownerId: owner.id, clerkId: owner.clerkId, ...(providerId ? { providerId } : {}) });
      await audit(ctx, admin, "Admin access granted", email + " — " + role);
      return { ok: true, email, role };
    }

    if (op === "clearStaffProfiles") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "roles.edit");
      if (admin.role !== "super") throw new Error("Only a Super Admin can clear staff setup.");
      const providers = await ctx.db.query("providers").collect();
      const leaves = await ctx.db.query("staffLeave").collect();
      const services = await ctx.db.query("services").collect();
      const admins = await ctx.db.query("admins").collect();
      const activeBookings = (await ctx.db.query("bookings").collect()).filter(booking => activeBookingStatus(booking.status));
      const waitlist = await ctx.db.query("waitlist").collect();
      if (activeBookings.length || waitlist.length) throw new Error("Reschedule or cancel active appointments and clear the waitlist before clearing staff setup.");
      for (const provider of providers) await ctx.db.patch(provider._id, { active: false });
      for (const leave of leaves) await ctx.db.delete(leave._id);
      for (const service of services) await ctx.db.patch(service._id, { staff: [], active: false });
      let accessRemoved = 0;
      for (const entry of admins) {
        if (entry._id !== admin._id && entry.role !== "super") { await ctx.db.delete(entry._id); accessRemoved++; }
      }
      await audit(ctx, admin, "Staff setup cleared", providers.length + " profiles archived, " + leaves.length + " leave blocks, " + accessRemoved + " staff access entries removed");
      return { ok: true, providersArchived: providers.length, accessRemoved };
    }

    if (op === "removeNonPawServices") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "cms.edit");
      const services = await ctx.db.query("services").collect();
      const targets = services.filter(service => !/paw/i.test(service.name));
      const bookings = await ctx.db.query("bookings").collect();
      const waitlist = await ctx.db.query("waitlist").collect();
      if (targets.some(service => bookings.some(booking => booking.serviceId === service.id) || waitlist.some(row => row.serviceId === service.id))) {
        throw new Error("A non-Paw service has history. Archive it from the service editor instead.");
      }
      for (const service of targets) await ctx.db.delete(service._id);
      await audit(ctx, admin, "Non-Paw services removed", targets.length + " services removed");
      return { ok: true, removed: targets.length };
    }

    if (op === "revokeAdminAccess") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "roles.edit");
      const email = String(p.email || "").trim().toLowerCase();
      if (!email || email === String(admin.email || "").toLowerCase()) throw new Error("You cannot revoke your own access while signed in.");
      const target = await ctx.db.query("admins").withIndex("by_email", q => q.eq("email", email)).first();
      if (!target) throw new Error("Admin access entry not found.");
      if (target.role === "super") {
        const supers = (await ctx.db.query("admins").collect()).filter(item => item.role === "super");
        if (supers.length <= 1) throw new Error("At least one Super Admin must keep access.");
      }
      await ctx.db.delete(target._id);
      await audit(ctx, admin, "Admin access revoked", email);
      return { ok: true, email };
    }

    if (op === "createOwner") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "crm.edit");
      const input = p.input || {};
      const fullName = String(input.fullName || "").trim();
      const email = String(input.email || "").trim().toLowerCase();
      if (fullName.length < 2 || fullName.length > 120 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Enter a full name and valid email.");
      if (email && await ctx.db.query("owners").withIndex("by_email", q => q.eq("email", email)).first()) throw new Error("An account with this email already exists.");
      const owner = { id: uid("ow"), fullName, email, phone: String(input.phone || ""), address: "", emergencyContact: "", notes: "", plan: "puppy", createdAt: today() };
      await ctx.db.insert("owners", owner);
      await audit(ctx, admin, "Customer created", owner.id);
      return { ok: true, ownerId: owner.id };
    }
    if (op === "sendMessage") {
      const admin = await adminFor(ctx);
      const scope = requirePermission(admin, "messages.send");
      const owner = await getOwnerById(ctx, p.ownerId);
      if (!owner) throw new Error("Customer not found.");
      if (scope === "own" && !(await ctx.db.query("bookings").collect()).some(b => b.ownerId === owner.id && b.providerId === admin.providerId)) throw new Error("Not authorized.");
      const subject = String(p.subject || "").trim();
      const body = String(p.body || "").trim();
      if (!subject || !body || subject.length > 200 || body.length > 4000) throw new Error("Enter a subject and message (maximum 4,000 characters).");
      await ctx.db.insert("messages", { id: uid("msg"), ownerId: owner.id, direction: "out", channel: "portal", subject, body, read: false, createdAt: new Date().toISOString() });
      await notify(ctx, owner.id, "message", subject, "You have a new message in your member inbox.");
      await audit(ctx, admin, "Portal message sent", owner.id);
      return { ok: true };
    }
    if (op === "markMessageRead") {
      const owner = await ownerFor(ctx, false);
      const row = await ctx.db.query("messages").filter(q => q.eq(q.field("id"), p.messageId)).first();
      if (!owner || !row || row.ownerId !== owner.id || row.direction !== "out") throw new Error("Not authorized.");
      await ctx.db.patch(row._id, { read: true });
      return { ok: true };
    }
    if (op === "setContactStatus") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "crm.edit");
      const row = await ctx.db.query("contactMessages").filter(q => q.eq(q.field("id"), p.contactId)).first();
      if (!row || !["new", "resolved"].includes(p.status)) throw new Error("Invalid contact request.");
      await ctx.db.patch(row._id, { status: p.status });
      await audit(ctx, admin, "Contact request " + p.status, row.id);
      return { ok: true };
    }

    if (op === "ensureOwner") {
      const id = await identity(ctx);
      const staff = await adminFor(ctx);
      if (staff) {
        if (staff.clerkId !== id.subject) await ctx.db.patch(staff._id, { clerkId: id.subject });
        return { ok: true, kind: "admin" };
      }
      const owner = await ownerFor(ctx, true, p.profile || {});
      if (!owner) throw new Error("Not authorized.");
      if (owner.clerkId !== id.subject) await ctx.db.patch(owner._id, { clerkId: id.subject });
      return { ok: true, kind: "owner", ownerId: owner.id };
    }

    if (op === "markNotificationRead" || op === "markNotificationsRead") {
      const owner = await ownerFor(ctx, false);
      if (!owner) throw new Error("Not authorized.");
      const ids = op === "markNotificationRead" ? [p.notificationId] : (Array.isArray(p.notificationIds) ? p.notificationIds : []);
      const rows = await ctx.db.query("notifications").filter(q => q.eq(q.field("ownerId"), owner.id)).collect();
      for (const row of rows) {
        if (ids.includes(row.id) || (op === "markNotificationsRead" && !ids.length)) {
          await ctx.db.patch(row._id, { read: true });
        }
      }
      return { ok: true };
    }

    if (op === "updateOwner") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      const target = await getOwnerById(ctx, p.ownerId || owner?.id);
      if (!target) throw new Error("Owner not found.");
      if (!admin && target.id !== owner?.id) throw new Error("Not authorized.");
      if (admin) requirePermission(admin, "crm.edit");
      const patch = {};
      for (const k of ["fullName","email","phone","emergencyContact","address","notes","plan"]) {
        if (p.patch?.[k] !== undefined) patch[k] = String(p.patch[k]);
      }
      if (patch.plan && !Object.prototype.hasOwnProperty.call(PLANS, patch.plan)) throw new Error("Invalid membership plan.");
      if (!admin && patch.plan !== undefined && patch.plan !== target.plan) {
        throw new Error("Membership changes require billing setup.");
      }
      if (!admin && patch.email !== undefined && String(patch.email).trim().toLowerCase() !== String(target.email).toLowerCase()) {
        throw new Error("Change your email through your identity provider.");
      }
      if (!admin && patch.notes !== undefined) throw new Error("Internal customer notes can only be edited by staff.");
      if (patch.email !== undefined) {
        patch.email = patch.email.trim().toLowerCase();
        if ((patch.email || !admin || target.clerkId) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) throw new Error("Enter a valid email address.");
        const duplicate = patch.email ? await ctx.db.query("owners").withIndex("by_email", q => q.eq("email", patch.email)).first() : null;
        if (duplicate && duplicate._id !== target._id) throw new Error("An account with this email already exists.");
      }
      if (patch.fullName !== undefined && patch.fullName.trim().length < 2) throw new Error("Name is too short.");
      await ctx.db.patch(target._id, patch);
      if (admin) await audit(ctx, admin, "Owner updated", target.id);
      return { ok: true };
    }

    if (op === "addPet") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      const ownerId = p.ownerId || owner?.id;
      const targetOwner = await getOwnerById(ctx, ownerId);
      if (!targetOwner) throw new Error("Owner not found.");
      if (!admin && targetOwner.id !== owner?.id) throw new Error("Not authorized.");
      if (admin) requirePermission(admin, "crm.edit");
      const allowedSpecies = ["Dog","Cat","Bird","Rabbit","Reptile","Small Mammal","Fish"];
      const allowedSex = ["Male","Female"];
      const allowedAltered = ["Intact","Neutered","Spayed"];
      const input = p.input || {};
      validatePetInput(input);
      const pet = {
        id: uid("pt"), ownerId, petName: String(input.petName || "New pet").trim() || "New pet",
        species: allowedSpecies.includes(input.species) ? input.species : "Dog",
        breed: String(input.breed || "").trim(), dob: String(input.dob || ""),
        sex: allowedSex.includes(input.sex) ? input.sex : "Male",
        altered: allowedAltered.includes(input.altered) ? input.altered : "Intact",
        weightKg: Math.max(0, Number(input.weightKg) || 0),
        microchip: String(input.microchip || "").trim(), coat: String(input.coat || "").trim(),
        tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 12) : [],
        vaccines: [], notes: String(input.notes || ""), createdAt: today(),
        ...(input.imageStorageId ? { imageStorageId: input.imageStorageId } : {})
      };
      if (input.imageStorageId) await claimImage(ctx, input.imageStorageId, "pet:" + pet.id);
      await ctx.db.insert("pets", pet);
      if (admin) await audit(ctx, admin, "Pet added", pet.petName);
      return { ok: true };
    }

    if (op === "updatePet") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      const pet = await getPet(ctx, p.petId);
      if (!pet) throw new Error("Pet not found.");
      if (!admin && pet.ownerId !== owner?.id) throw new Error("Not authorized.");
      if (admin) requirePermission(admin, "crm.edit");
      if (admin?.role === "provider") {
        const ownBooking = (await ctx.db.query("bookings").collect()).some(b => b.petId === pet.id && b.providerId === admin.providerId);
        if (!ownBooking) throw new Error("Not authorized.");
      }
      const input = p.patch || {};
      validatePetInput(input);
      const patch = {};
      for (const k of ["petName","species","breed","dob","sex","altered","weightKg","microchip","coat","notes"]) {
        if (input[k] !== undefined) patch[k] = k === "weightKg" ? Math.max(0, Number(input[k]) || 0) : String(input[k]);
      }
      if (input.tags !== undefined) patch.tags = Array.isArray(input.tags) ? input.tags.map(String).slice(0, 12) : [];
      if (input.imageStorageId !== undefined) {
        await claimImage(ctx, input.imageStorageId, "pet:" + pet.id);
        patch.imageStorageId = input.imageStorageId;
      }
      await ctx.db.patch(pet._id, patch);
      if (admin) await audit(ctx, admin, "Pet updated", pet.id);
      return { ok: true };
    }

    if (op === "removePet") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      const pet = await getPet(ctx, p.petId);
      if (!pet) throw new Error("Pet not found.");
      if (!admin && pet.ownerId !== owner?.id) throw new Error("Not authorized.");
      if (admin) requirePermission(admin, "crm.edit");
      const bookings = await ctx.db.query("bookings").collect();
      for (const b of bookings.filter(b => b.petId === pet.id && activeBookingStatus(b.status))) {
        await ctx.db.patch(b._id, { status: "cancelled", note: "Cancelled because the pet was removed." });
      }
      await ctx.db.delete(pet._id);
      await notify(ctx, pet.ownerId, "booking", "Appointments cancelled", "Active appointments for " + pet.petName + " were cancelled because the pet was removed.");
      if (admin) await audit(ctx, admin, "Pet removed", pet.petName);
      return { ok: true };
    }

    if (op === "addVaccine") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      if (admin) requirePermission(admin, "crm.edit");
      const pet = await getPet(ctx, p.petId);
      if (!pet || (!admin && pet.ownerId !== owner?.id)) throw new Error("Not authorized.");
      const name = String(p.name || "").trim();
      const date = String(p.date || "");
      if (!["Rabies", "DHPP", "Bordetella", "FVRCP", "Leptospirosis", "Canine Influenza"].includes(name) || !validDateOnly(date) || date > today()) throw new Error("Invalid vaccine record.");
      const defaultExpiry = new Date(date + "T12:00:00Z"); defaultExpiry.setUTCFullYear(defaultExpiry.getUTCFullYear() + 1);
      const expires = String(p.expires || defaultExpiry.toISOString().slice(0, 10));
      if (!validDateOnly(expires) || expires <= date) throw new Error("Enter a valid expiry date after the administration date.");
      const vaccines = Array.isArray(pet.vaccines) ? pet.vaccines.slice() : [];
      vaccines.push({ name, date, expires, lot: String(p.lot || ""), status: "pending" });
      await ctx.db.patch(pet._id, { vaccines });
      if (admin) await audit(ctx, admin, "Vaccine record added", pet.id + " — " + name);
      return { ok: true };
    }

    if (op === "setVaccineStatus") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "crm.edit");
      const pet = await getPet(ctx, p.petId);
      if (!pet || !pet.vaccines?.[p.index]) throw new Error("Record not found.");
      const status = String(p.status || "");
      if (!["approved","rejected","pending"].includes(status)) throw new Error("Invalid vaccine status.");
      const vaccines = pet.vaccines.slice();
      vaccines[p.index] = { ...vaccines[p.index], status };
      await ctx.db.patch(pet._id, { vaccines });
      await audit(ctx, admin, "Vaccine " + status, pet.petName);
      return { ok: true };
    }

    if (op === "createBooking" || op === "staffBooking") {
      const staff = op === "staffBooking" ? await adminFor(ctx) : null;
      if (op === "staffBooking") requirePermission(staff, "bookings.manage");
      const catalog = await ctx.db.query("cms").first();
      if (!catalog?.catalogConfirmed) throw new Error("Service prices need store confirmation before appointments can be booked. Please contact the team.");
      const owner = staff ? await getOwnerById(ctx, p.ownerId) : await ownerFor(ctx, true);
      const service = await getService(ctx, p.serviceId);
      const pet = await getPet(ctx, p.petId);
      if (!owner || !service || service.active === false || !pet || pet.ownerId !== owner.id) throw new Error("Invalid booking request.");
      if (service.duration >= 24) throw new Error("This service requires overnight scheduling; please contact the store.");
      if (service.deposit && !staff) throw new Error("This booking requires a payment processor that is not connected yet.");
      const required = pet.species === "Cat" ? ["Rabies","FVRCP"] : pet.species === "Dog" ? ["Rabies","DHPP","Bordetella"] : [];
      if (service.requiresVaccine) {
        if (!required.length) throw new Error("Contact the store for a species-specific vaccine review before booking this service.");
        const have = (pet.vaccines || []).filter(v => v.status === "approved" && (!v.expires || v.expires >= today())).map(v => v.name);
        const missing = required.filter(v => !have.includes(v));
        if (missing.length) throw new Error("Missing required vaccines: " + missing.join(", ") + ".");
      }
      const provider = await getProvider(ctx, p.providerId);
      if (!provider || provider.active === false || !(service.staff || []).includes(provider.id)) throw new Error("Specialist is not available for this service.");
      const ok = await slotAvailable(ctx, service, provider, String(p.date), Number(p.hour), undefined, service.duration, pet.id);
      if (!ok) throw new Error("That time slot is no longer available.");
      const rate = staff ? 0 : PLANS[owner.plan] || 0;
      const total = round2(service.price * (1 - rate));
      const deposit = service.deposit ? round2(total * 0.30) : 0;
      const booking = {
        id: uid("bk"), ownerId: owner.id, petId: pet.id, serviceId: service.id,
        providerId: provider.id, date: String(p.date), hour: Number(p.hour), duration: service.duration,
        status: "confirmed", deposit, total, paid: 0, paymentStatus: service.deposit ? "pending" : "not_required",
        intake: p.intake || {}, createdAt: today(), createdBy: staff ? "staff" : "self", discountRate: rate
      };
      await ctx.db.insert("bookings", booking);
      if (staff) await audit(ctx, staff, "In-store appointment", booking.id);
      await notify(ctx, owner.id, "booking", "Booking confirmed: " + service.name, pet.petName + " is booked for " + booking.date + ".");
      await ctx.db.insert("messages", { id: uid("msg"), ownerId: owner.id, direction: "out", channel: "portal", subject: "Appointment confirmation", body: service.name + " for " + pet.petName + " on " + booking.date + ". " + (deposit ? "Deposit due: NGN " + deposit.toFixed(2) + "." : "No deposit is required."), read: false, createdAt: today() });
      return { ok: true, bookingId: booking.id };
    }

    if (op === "recordBookingPayment") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "payments.take");
      requirePermission(admin, "bookings.manage");
      const booking = await getBooking(ctx, p.bookingId);
      if (!booking || ["cancelled", "no-show"].includes(booking.status)) throw new Error("Appointment is not payable.");
      const options = p.options || {};
      const payments = booking.storePayments || [];
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(options.requestId || "")) throw new Error("A payment reference is required.");
      if (payments.some(x => x.requestId === options.requestId)) return {ok: true, bookingId: booking.id};
      const amount = Number(p.amount);
      if (!Number.isFinite(amount) || amount <= 0 || round2(amount) !== amount || amount > round2(booking.total - booking.paid)) throw new Error("Payment must be positive and cannot exceed the outstanding balance.");
      if (!["Cash", "Bank transfer"].includes(p.method)) throw new Error("Invalid payment method.");
      payments.push({requestId: options.requestId, amount, method: p.method, reference: String(options.reference || "").slice(0, 120), at: new Date().toISOString()});
      await ctx.db.patch(booking._id, {paid: round2(booking.paid + amount), paymentStatus: booking.paid + amount >= booking.total ? "paid" : "partial", storePayments: payments});
      await audit(ctx, admin, "Appointment payment", booking.id + " — NGN " + amount.toFixed(2));
      return {ok: true, bookingId: booking.id};
    }

    if (op === "refundBookingPayment") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "payments.refund");
      const booking = await getBooking(ctx, p.bookingId);
      if (!booking) throw new Error("Appointment not found.");
      const options = p.options || {};
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(options.requestId || "")) throw new Error("A refund reference is required.");
      const refunds = booking.storeRefunds || [];
      if (refunds.some(item => item.requestId === options.requestId)) return { ok: true, bookingId: booking.id };
      const amount = Number(p.amount);
      const reason = String(options.reason || "").trim().slice(0, 500);
      if (!Number.isFinite(amount) || amount <= 0 || round2(amount) !== amount || amount > booking.paid) throw new Error("Refund must be positive and cannot exceed the amount received.");
      if (!["Cash", "Bank transfer"].includes(p.method) || !reason) throw new Error("Enter the refund method and reason.");
      refunds.push({ requestId: options.requestId, amount, method: p.method, reason, at: new Date().toISOString() });
      const paid = round2(booking.paid - amount);
      await ctx.db.patch(booking._id, { paid, refunded: round2((booking.refunded || 0) + amount), paymentStatus: paid === 0 ? "refunded" : "partial", storeRefunds: refunds });
      await audit(ctx, admin, "Appointment refund recorded", booking.id + " — NGN " + amount.toFixed(2));
      return { ok: true, bookingId: booking.id };
    }

    if (op === "rescheduleBooking") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      const booking = await getBooking(ctx, p.bookingId);
      if (!booking) throw new Error("Booking not found.");
      const scope = admin ? permission(admin, "bookings.manage") : false;
      if (!admin && booking.ownerId !== owner?.id) throw new Error("Not authorized.");
      if (admin && !scope) throw new Error("Not authorized.");
      if (admin?.role === "provider" && booking.providerId !== admin.providerId) throw new Error("Not authorized.");
      if (!activeBookingStatus(booking.status)) throw new Error("Cannot reschedule a closed booking.");
      const service = await getService(ctx, booking.serviceId);
      const provider = await getProvider(ctx, p.providerId || booking.providerId);
      if (!service || service.active === false || !provider || provider.active === false || !(service.staff || []).includes(provider.id)) throw new Error("Invalid provider for this service.");
      const ok = await slotAvailable(ctx, service, provider, String(p.date), Number(p.hour), booking.id, booking.duration, booking.petId);
      if (!ok) throw new Error("That time slot is no longer available.");
      await ctx.db.patch(booking._id, { date: String(p.date), hour: Number(p.hour), providerId: provider.id });
      if (admin) await audit(ctx, admin, "Booking rescheduled", booking.id);
      await notify(ctx, booking.ownerId, "booking", "Appointment rescheduled", "Your appointment moved to " + String(p.date) + ".");
      return { ok: true };
    }

    if (op === "cancelBooking") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      const booking = await getBooking(ctx, p.bookingId);
      if (!booking) throw new Error("Booking not found.");
      if (!admin && booking.ownerId !== owner?.id) throw new Error("Not authorized.");
      if (admin && !requirePermission(admin, "bookings.manage")) throw new Error("Not authorized.");
      if (!activeBookingStatus(booking.status)) throw new Error("Booking is already closed.");
      await ctx.db.patch(booking._id, { status: "cancelled" });
      await notify(ctx, booking.ownerId, "booking", "Appointment cancelled", "Your appointment on " + booking.date + " was cancelled.");
      if (admin) await audit(ctx, admin, "Booking cancelled", booking.id);
      return { ok: true };
    }

    if (op === "setBookingStatus") {
      const admin = await adminFor(ctx);
      const scope = requirePermission(admin, "bookings.manage");
      const booking = await getBooking(ctx, p.bookingId);
      if (!booking) throw new Error("Booking not found.");
      if (scope === "own" && booking.providerId !== admin.providerId) throw new Error("Not authorized.");
      const status = String(p.status || "");
      if (!["pending","confirmed","completed","cancelled","no-show"].includes(status)) throw new Error("Invalid booking status.");
      if (!activeBookingStatus(booking.status) && status !== booking.status) throw new Error("Closed bookings cannot be changed.");
      const patch = { status };
      if (status === "completed") patch.completedAt = new Date().toISOString();
      await ctx.db.patch(booking._id, patch);
      await notify(ctx, booking.ownerId, "booking", "Appointment updated", "Status: " + status + ".");
      await audit(ctx, admin, "Booking status", booking.id + " -> " + status);
      return { ok: true };
    }

    if (op === "addBookingNote") {
      const admin = await adminFor(ctx);
      const scope = requirePermission(admin, "bookings.notes");
      const booking = await getBooking(ctx, p.bookingId);
      if (!booking) throw new Error("Booking not found.");
      if (scope === "own" && booking.providerId !== admin.providerId) throw new Error("Not authorized.");
      const note = String(p.note || "").trim();
      if (!note) throw new Error("Note cannot be empty.");
      const notes = Array.isArray(booking.internalNotes) ? booking.internalNotes.slice() : [];
      notes.push({ by: admin.name, note, at: today() });
      await ctx.db.patch(booking._id, { internalNotes: notes });
      await audit(ctx, admin, "Internal note added", booking.id);
      return { ok: true };
    }

    if (op === "placeOrder") {
      const owner = await ownerFor(ctx, true);
      if (!owner) throw new Error("Please sign in to checkout.");
      throw new Error("Online checkout is disabled until a payment processor is connected.");
      const rawLines = Array.isArray(p.items) ? p.items : [];
      if (!rawLines.length) throw new Error("Your cart is empty.");
      const lines = [];
      for (const item of rawLines) {
        const id = String(item.id || "");
        const qty = Number(item.qty);
        if (!Number.isInteger(qty) || qty <= 0) throw new Error("Invalid quantity.");
        const product = await getProduct(ctx, id);
        if (!product || product.active === false || !Number.isFinite(product.price) || product.price < 0) throw new Error("Invalid product.");
        if (qty > product.stock) throw new Error(product.name + " only has " + product.stock + " in stock.");
        lines.push({ product, qty });
      }
      const rate = PLANS[owner.plan] || 0;
      const subtotal = round2(lines.reduce((n, l) => n + l.product.price * l.qty, 0));
      const total = round2(subtotal * (1 - rate));
      for (const line of lines) await ctx.db.patch(line.product._id, { stock: line.product.stock - line.qty, lowStock: line.product.stock - line.qty <= line.product.lowAt });
      const order = {
        id: uid("or"), ownerId: owner.id, placedAt: today(), items: lines.map(l => ({ productId: l.product.id, qty: l.qty, price: l.product.price })),
        fulfillment: p.fulfillment === "pickup" ? "pickup" : "delivery",
        address: p.fulfillment === "pickup" ? "" : String(p.address || owner.address || ""),
        status: "open", stage: "pending", total, paid: 0, paymentStatus: "pending",
        method: "pending", discountRate: rate
      };
      await ctx.db.insert("orders", order);
      await notify(ctx, owner.id, "order", "Order " + order.id + " received", "Your order was created. Payment is still pending.");
      return { ok: true, orderId: order.id, paymentStatus: "pending" };
    }

    if (op === "setOrderStage") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "payments.take");
      const order = await getOrder(ctx, p.orderId);
      if (!order) throw new Error("Order not found.");
      const stages = ["pending","packing","ready","shipped","done"];
      const stage = String(p.stage || "");
      if (!stages.includes(stage)) throw new Error("Invalid order stage.");
      const current = order.stage || "pending";
      if (["cancelled", "refunded"].includes(order.status) || current === "done") throw new Error("Closed orders cannot be changed.");
      const i = stages.indexOf(current);
      if (Math.abs(stages.indexOf(stage) - i) > 1) throw new Error("Invalid order transition.");
      const patch = { stage };
      if (stage === "done") patch.status = "delivered";
      await ctx.db.patch(order._id, patch);
      await notify(ctx, order.ownerId, "order", "Order " + order.id + " updated", "Status: " + stage + ".");
      await audit(ctx, admin, "Order stage", order.id + " -> " + stage);
      return { ok: true, orderId: order.id };
    }

    if (op === "refund") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "payments.refund");
      throw new Error("Refunds require a configured payment processor; no money was moved.");
    }

    if (op === "setListingStatus") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "listings.edit");
      const l = await ctx.db.query("listings").filter(q => q.eq(q.field("id"), p.listingId)).first();
      if (!l) throw new Error("Listing not found.");
      if (p.imageStorageId !== undefined) {
        await claimImage(ctx, p.imageStorageId, "listing:" + l.id);
        await ctx.db.patch(l._id, { imageStorageId: p.imageStorageId });
      }
      const status = String(p.status || "");
      if (!["available","reserved","sold"].includes(status)) throw new Error("Invalid listing status.");
      await ctx.db.patch(l._id, { status });
      await audit(ctx, admin, "Listing status", l.name + " -> " + status);
      return { ok: true, listingId: l.id };
    }

    if (op === "createListing" || op === "updateListing") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "listings.edit");
      const input = op === "createListing" ? (p.input || {}) : (p.patch || {});
      const existing = op === "updateListing" ? await ctx.db.query("listings").withIndex("by_external_id", q => q.eq("id", String(p.listingId || ""))).first() : null;
      if (op === "updateListing" && !existing) throw new Error("Listing not found.");
      const values = { ...(existing || {}), ...input };
      const species = String(values.species || "").trim(), name = String(values.name || "").trim(), breed = String(values.breed || "").trim(), sex = String(values.sex || "").trim();
      const ageMonths = Number(values.ageMonths), price = Number(values.price);
      const status = String(values.status || "available");
      if (!species || !name || !breed || !["Male","Female"].includes(sex) || !Number.isInteger(ageMonths) || ageMonths < 0 || !Number.isFinite(price) || price < 0 || !["draft","available","reserved","sold","archived"].includes(status)) throw new Error("Enter valid listing details.");
      const patch = { species, name, breed, sex, ageMonths, price: round2(price), status,
        icon: String(values.icon || ""), breeder: String(values.breeder || ""), pedigree: String(values.pedigree || ""), bio: String(values.bio || "").slice(0, 4000),
        health: Array.isArray(values.health) ? values.health.map(String).slice(0, 20) : [], temperament: Array.isArray(values.temperament) ? values.temperament.map(String).slice(0, 20) : [] };
      const listingId = existing?.id || uid("ls");
      if (input.imageStorageId !== undefined) { await claimImage(ctx, input.imageStorageId, "listing:" + listingId); patch.imageStorageId = input.imageStorageId; }
      if (existing) await ctx.db.patch(existing._id, patch);
      else await ctx.db.insert("listings", { id: listingId, listedAt: today(), ...patch });
      await audit(ctx, admin, existing ? "Listing edited" : "Listing created", listingId + " — " + name);
      return { ok: true, listingId };
    }

    if (op === "deleteListing") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "listings.edit");
      const listing = await ctx.db.query("listings").withIndex("by_external_id", q => q.eq("id", String(p.listingId || ""))).first();
      if (!listing) throw new Error("Listing not found.");
      await ctx.db.patch(listing._id, { status: "archived" });
      await audit(ctx, admin, "Listing archived", listing.id + " — " + listing.name);
      return { ok: true, listingId: listing.id };
    }

    if (op === "adjustStock") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "inventory.edit");
      const product = await getProduct(ctx, p.productId);
      const delta = Number(p.delta);
      if (!product || !Number.isInteger(delta)) throw new Error("Invalid stock adjustment.");
      const stock = Math.max(0, product.stock + delta);
      await ctx.db.patch(product._id, { stock, lowStock: stock <= product.lowAt });
      await audit(ctx, admin, "Stock adjusted", product.name + " " + (delta >= 0 ? "+" : "") + delta);
      return { ok: true, productId: product.id };
    }

    if (op === "updateProduct") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "inventory.edit");
      const product = await getProduct(ctx, p.productId);
      if (!product) throw new Error("Product not found.");
      const patch = {};
      const input = p.patch || {};
      if (input.name !== undefined) {
        const name = String(input.name).trim();
        if (!name) throw new Error("Enter a product name.");
        patch.name = name;
      }
      if (input.cat !== undefined) patch.cat = String(input.cat);
      if (input.price !== undefined) {
        const price = Number(input.price);
        if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price.");
        patch.price = round2(price);
      }
      if (input.stock !== undefined) {
        const stock = Number(input.stock);
        if (!Number.isInteger(stock) || stock < 0) throw new Error("Invalid stock.");
        patch.stock = stock;
      }
      if (input.lowAt !== undefined) {
        const lowAt = Number(input.lowAt);
        if (!Number.isInteger(lowAt) || lowAt < 0) throw new Error("Invalid low-stock threshold.");
        patch.lowAt = lowAt;
      }
      if (input.desc !== undefined) patch.desc = String(input.desc);
      if (input.icon !== undefined) patch.icon = String(input.icon);
      if (input.sku !== undefined) patch.sku = String(input.sku).trim().slice(0, 80);
      if (input.cost !== undefined) { const cost = Number(input.cost); if (!Number.isFinite(cost) || cost < 0) throw new Error("Invalid cost."); patch.cost = round2(cost); }
      if (input.active !== undefined) {
        if (typeof input.active !== "boolean") throw new Error("Invalid product status.");
        patch.active = input.active;
      }
      if (input.imageStorageId !== undefined) { await claimImage(ctx, input.imageStorageId, "product:" + product.id); patch.imageStorageId = input.imageStorageId; }
      patch.lowStock = (patch.stock ?? product.stock) <= (patch.lowAt ?? product.lowAt);
      await ctx.db.patch(product._id, patch);
      await audit(ctx, admin, "Product edited", product.id);
      return { ok: true, productId: product.id };
    }

    if (op === "createProduct") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "inventory.edit");
      const input = p.input || {};
      const name = String(input.name || "").trim(), cat = String(input.cat || "").trim(), desc = String(input.desc || "").trim();
      const price = Number(input.price), cost = Number(input.cost || 0), stock = Number(input.stock), lowAt = Number(input.lowAt);
      if (!name || !cat || !desc || !Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0 || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(lowAt) || lowAt < 0) throw new Error("Enter valid product details.");
      const product = { id: uid("pr"), active: true, name, cat, price: round2(price), cost: round2(cost), stock, lowAt, lowStock: stock <= lowAt, desc, sku: String(input.sku || "").trim().slice(0, 80), icon: String(input.icon || "") };
      if (input.imageStorageId) { await claimImage(ctx, input.imageStorageId, "product:" + product.id); product.imageStorageId = input.imageStorageId; }
      await ctx.db.insert("products", product);
      await audit(ctx, admin, "Product created", product.id + " — " + name);
      return { ok: true, productId: product.id };
    }

    if (op === "deleteProduct") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "inventory.edit");
      const product = await getProduct(ctx, p.productId);
      if (!product) throw new Error("Product not found.");
      await ctx.db.patch(product._id, { active: false, stock: 0, lowStock: true });
      await audit(ctx, admin, "Product archived", product.id + " — " + product.name);
      return { ok: true, productId: product.id };
    }

    if (op === "updateCMS") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "cms.edit");
      let cms = await ctx.db.query("cms").first();
      const patch = {};
      for (const k of ["siteName","tagline","banner","heroTitle","emergencyHotline","emergencyNote","phone","email","address"]) {
        if (p.patch?.[k] !== undefined) patch[k] = String(p.patch[k]);
      }
      if (patch.siteName !== undefined && patch.siteName.trim().length < 2) throw new Error("Enter a site name with at least 2 characters.");
      if (p.patch?.catalogConfirmed !== undefined) {
        if (typeof p.patch.catalogConfirmed !== "boolean") throw new Error("Invalid catalog setting.");
        if (p.patch.catalogConfirmed) {
          const products = (await ctx.db.query("products").collect()).filter(product => product.active !== false);
          const services = await ctx.db.query("services").collect();
          const listings = await ctx.db.query("listings").collect();
          if (!products.length || !services.some(service => service.active !== false)) throw new Error("Add products and at least one active service before publishing the catalog.");
          if (products.some(item => !item.name?.trim() || !item.cat?.trim() || !item.desc?.trim() || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.stock) || item.stock < 0)) throw new Error("Complete every product before publishing the catalog.");
          if (services.some(item => item.active !== false && (!/paw/i.test(item.name) || !Number.isFinite(item.price) || item.price < 0 || !item.staff?.length))) throw new Error("Complete every active service and include Paw in each name before publishing the catalog.");
          if (listings.some(item => !["draft","available","reserved","sold","archived"].includes(item.status) || !item.name?.trim() || !Number.isFinite(item.price) || item.price < 0)) throw new Error("Complete every pet listing before publishing the catalog.");
        }
        patch.catalogConfirmed = p.patch.catalogConfirmed;
      }
      if (p.patch?.hours !== undefined) {
        const hours = p.patch.hours;
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const minutes = value => {
          const match = String(value).match(/^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/);
          return match ? (Number(match[1]) % 12 + (match[3] === "PM" ? 12 : 0)) * 60 + Number(match[2]) : null;
        };
        if (!Array.isArray(hours) || (hours.length !== 0 && hours.length !== 7)) throw new Error("Enter a complete opening-hours schedule.");
        for (let i = 0; i < hours.length; i++) {
          const row = hours[i];
          if (!row || row.day !== days[i] || typeof row.open !== "string" || typeof row.close !== "string") throw new Error("Invalid opening-hours day.");
          if (row.open === "Closed" && row.close === "Closed") continue;
          const start = minutes(row.open), end = minutes(row.close);
          if (start === null || end === null || end <= start) throw new Error("Invalid opening hours for " + row.day + ".");
        }
        patch.hours = hours;
      }
      if (p.patch?.toggles !== undefined) patch.toggles = p.patch.toggles;
      if (cms) await ctx.db.patch(cms._id, patch);
      else {
        cms = { id: "site", siteName: "", emergencyHotline: "", emergencyNote: "", hours: [], toggles: {}, address: "", phone: "", email: "", ...patch };
        await ctx.db.insert("cms", cms);
      }
      await audit(ctx, admin, "CMS update", Object.keys(patch).join(", "));
      return { ok: true };
    }

    if (op === "updateService") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "cms.edit");
      const s = await getService(ctx, p.serviceId);
      if (!s) throw new Error("Service not found.");
      const input = p.patch || {};
      const patch = {};
      if (input.active !== undefined) {
        if (typeof input.active !== "boolean") throw new Error("Choose whether this service is active.");
        patch.active = input.active;
      }
      if (input.name !== undefined) {
        const name = String(input.name).trim();
        if (!/paw/i.test(name)) throw new Error("Service names must include Paw.");
        patch.name = name;
      }
      if (input.group !== undefined) {
        const group = await ctx.db.query("serviceGroups").filter(q => q.eq(q.field("id"), String(input.group))).first();
        if (!group) throw new Error("Choose a valid department.");
        patch.group = String(input.group);
      }
      if (input.desc !== undefined) patch.desc = String(input.desc);
      if (input.price !== undefined) {
        const price = Number(input.price);
        if (!Number.isFinite(price) || price < 0) throw new Error("Invalid service price.");
        patch.price = round2(price);
      }
      if (input.duration !== undefined) {
        const duration = Number(input.duration);
        if (!Number.isFinite(duration) || duration <= 0 || duration > 24) throw new Error("Invalid service duration.");
        patch.duration = duration;
      }
      if (input.popular !== undefined) patch.popular = !!input.popular;
      if (input.deposit !== undefined) patch.deposit = !!input.deposit;
      if (input.requiresVaccine !== undefined) patch.requiresVaccine = !!input.requiresVaccine;
      if (input.staff !== undefined) {
        if (!Array.isArray(input.staff) || !input.staff.length) throw new Error("Assign at least one care-team member.");
        const providers = await ctx.db.query("providers").collect();
        if (input.staff.some(id => !providers.some(provider => provider.id === id))) throw new Error("Choose valid care-team members.");
        patch.staff = input.staff.map(String);
      }
      if (!patch.name && !s.name) throw new Error("Enter a service name.");
      if (input.imageStorageId !== undefined) { await claimImage(ctx, input.imageStorageId, "service:" + s.id); patch.imageStorageId = input.imageStorageId; }
      await ctx.db.patch(s._id, patch);
      await audit(ctx, admin, "Service edited", s.id);
      return { ok: true, serviceId: s.id };
    }

    if (op === "createService") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "cms.edit");
      const input = p.input || {};
      const groupId = String(input.group || "");
      const group = await ctx.db.query("serviceGroups").filter(q => q.eq(q.field("id"), groupId)).first();
      if (!group) throw new Error("Choose a valid department.");
      const providers = await ctx.db.query("providers").collect();
      const staff = Array.isArray(input.staff) ? input.staff.map(String) : [];
      if (!staff.length || staff.some(id => !providers.some(provider => provider.id === id))) throw new Error("Assign valid care-team members.");
      const name = String(input.name || "").trim();
      const price = Number(input.price);
      const duration = Number(input.duration);
      if (!name) throw new Error("Enter a service name.");
      if (!/paw/i.test(name)) throw new Error("Service names must include Paw.");
      if (!Number.isFinite(price) || price < 0) throw new Error("Invalid service price.");
      if (!Number.isFinite(duration) || duration <= 0 || duration > 24) throw new Error("Invalid service duration.");
      const service = {
        id: uid("sv"), active: true, group: groupId, name, icon: String(input.icon || "&#128062;"),
        price: round2(price), duration, deposit: !!input.deposit, requiresVaccine: !!input.requiresVaccine,
        staff, desc: String(input.desc || "").trim(), popular: !!input.popular,
        ...(input.imageStorageId ? { imageStorageId: input.imageStorageId } : {})
      };
      if (input.imageStorageId) await claimImage(ctx, input.imageStorageId, "service:" + service.id);
      await ctx.db.insert("services", service);
      await audit(ctx, admin, "Service created", service.id + " — " + service.name);
      return { ok: true, serviceId: service.id };
    }

    if (op === "deleteService") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "cms.edit");
      const s = await getService(ctx, p.serviceId);
      if (!s) throw new Error("Service not found.");
      await ctx.db.patch(s._id, { active: false });
      await audit(ctx, admin, "Service archived", s.id + " — " + s.name);
      return { ok: true, serviceId: s.id, active: false };
    }

    if (op === "updateProvider") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "staff.manage");
      const provider = await ctx.db.query("providers").filter(q => q.eq(q.field("id"), String(p.providerId || ""))).first();
      if (!provider) throw new Error("Staff member not found.");
      const input = p.patch || {};
      const patch = {};
      for (const key of ["name", "role", "title", "icon", "bio"]) if (input[key] !== undefined) patch[key] = String(input[key]).trim();
      if (input.ownerId !== undefined) {
        const ownerId = String(input.ownerId || "");
        if (ownerId) {
          const owner = await getOwnerById(ctx, ownerId);
          if (!owner || !owner.clerkId) throw new Error("Choose a registered account for this staff profile.");
          const other = (await ctx.db.query("providers").collect()).find(row => row.ownerId === owner.id && row._id !== provider._id);
          if (other) throw new Error("That registered account is linked to another staff profile.");
          patch.ownerId = owner.id;
        } else patch.ownerId = undefined;
      }
      if (input.group !== undefined) {
        const group = await ctx.db.query("serviceGroups").filter(q => q.eq(q.field("id"), String(input.group))).first();
        if (!group) throw new Error("Choose a valid department.");
        patch.group = String(input.group);
      }
      if (input.start !== undefined) patch.start = Number(input.start);
      if (input.end !== undefined) patch.end = Number(input.end);
      if (input.off !== undefined) patch.off = Array.isArray(input.off) ? input.off.map(Number) : [];
      if (input.active !== undefined) {
        if (typeof input.active !== "boolean") throw new Error("Choose whether this staff member is active.");
        patch.active = input.active;
      }
      const values = { ...provider, ...patch };
      if (!values.name || !values.role || !values.title) throw new Error("Enter the staff member's name, role and title.");
      if (!Number.isFinite(values.start) || !Number.isFinite(values.end) || values.start < 0 || values.end > 24 || values.end <= values.start) throw new Error("Enter valid working hours.");
      if (!Array.isArray(values.off) || values.off.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Choose valid days off.");
      await ctx.db.patch(provider._id, patch);
      await audit(ctx, admin, "Staff profile edited", provider.id + " — " + values.name);
      return { ok: true, providerId: provider.id };
    }

    if (op === "createProvider") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "staff.manage");
      const input = p.input || {};
      const rawId = String(input.id || "").trim();
      const baseId = rawId && /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(rawId) ? rawId : (rawId || String(input.name || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
      const id = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(baseId) ? baseId : "staff-" + uid("id").slice(-8);
      let uniqueId = id, suffix = 2;
      while (await ctx.db.query("providers").filter(q => q.eq(q.field("id"), uniqueId)).first()) {
        const tail = "-" + suffix++;
        uniqueId = id.slice(0, 40 - tail.length) + tail;
      }
      const group = await ctx.db.query("serviceGroups").filter(q => q.eq(q.field("id"), String(input.group || ""))).first();
      if (!group) throw new Error("Choose a valid department.");
      const ownerId = String(input.ownerId || "");
      if (ownerId) {
        const owner = await getOwnerById(ctx, ownerId);
        if (!owner || !owner.clerkId) throw new Error("Choose a registered account for this staff profile.");
      }
      const provider = { id: uniqueId, active: true, ...(ownerId ? { ownerId } : {}), name: String(input.name || "").trim(), role: String(input.role || "").trim(), title: String(input.title || "").trim(), group: String(input.group), icon: String(input.icon || "").trim(), start: Number(input.start), end: Number(input.end), off: Array.isArray(input.off) ? input.off.map(Number) : [], bio: String(input.bio || "").trim() };
      if (!provider.name || !provider.role || !provider.title) throw new Error("Enter the staff member's name, role and title.");
      if (!Number.isFinite(provider.start) || !Number.isFinite(provider.end) || provider.start < 0 || provider.end > 24 || provider.end <= provider.start) throw new Error("Enter valid working hours.");
      if (provider.off.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Choose valid days off.");
      await ctx.db.insert("providers", provider);
      await audit(ctx, admin, "Staff profile created", provider.id + " — " + provider.name);
      return { ok: true, providerId: provider.id };
    }

    if (op === "deleteProvider") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "staff.manage");
      const provider = await ctx.db.query("providers").filter(q => q.eq(q.field("id"), String(p.providerId || ""))).first();
      if (!provider) throw new Error("Staff member not found.");
      if (provider.active === false) throw new Error("This staff profile is already archived.");
      await ctx.db.patch(provider._id, { active: false });
      await audit(ctx, admin, "Staff profile archived", provider.id + " — " + provider.name);
      return { ok: true, providerId: provider.id, active: false };
    }

    if (op === "addLeave") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "staff.manage");
      const provider = await getProvider(ctx, p.providerId);
      const date = String(p.date || "");
      if (!provider || !validDateOnly(date) || date < today()) throw new Error("Invalid leave date.");
      if ((await ctx.db.query("bookings").collect()).some(b => b.providerId === provider.id && b.date === date && activeBookingStatus(b.status))) throw new Error("Reschedule or cancel this specialist's appointments before blocking the day.");
      const existing = (await ctx.db.query("staffLeave").filter(q => q.eq(q.field("providerId"), provider.id)).collect()).some(x => x.date === date);
      if (existing) throw new Error("Leave is already booked for that day.");
      await ctx.db.insert("staffLeave", { id: uid("lv"), providerId: provider.id, date, reason: String(p.reason || "Blocked"), createdAt: today() });
      await audit(ctx, admin, "Staff leave", provider.id + " on " + date);
      return { ok: true };
    }

    if (op === "removeLeave") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "staff.manage");
      const leave = await ctx.db.query("staffLeave").filter(q => q.eq(q.field("id"), p.leaveId)).first();
      if (!leave) throw new Error("Leave not found.");
      await ctx.db.delete(leave._id);
      await audit(ctx, admin, "Staff leave removed", leave.id);
      return { ok: true };
    }

    if (op === "joinWaitlist") {
      const owner = await ownerFor(ctx, true);
      if (!owner) throw new Error("Please sign in.");
      const service = await getService(ctx, p.serviceId);
      const provider = await getProvider(ctx, p.providerId);
      if (!service || !provider || provider.active === false || !(service.staff || []).includes(provider.id)) throw new Error("Invalid waitlist request.");
      const note = String(p.note || "").slice(0, 500);
      await ctx.db.insert("waitlist", { id: uid("wl"), ownerId: owner.id, serviceId: service.id, providerId: provider.id, note, createdAt: today() });
      await notify(ctx, owner.id, "waitlist", "Added to the waitlist", "We'll notify you when a slot opens.");
      return { ok: true };
    }

    if (op === "removeWaitlist") {
      const owner = await ownerFor(ctx, true);
      const admin = await adminFor(ctx);
      const row = await ctx.db.query("waitlist").filter(q => q.eq(q.field("id"), p.waitlistId)).first();
      if (!row) throw new Error("Waitlist entry not found.");
      if (admin) requirePermission(admin, "bookings.manage");
      else if (row.ownerId !== owner?.id) throw new Error("Not authorized.");
      await ctx.db.delete(row._id);
      return { ok: true };
    }

    if (op === "posCharge") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "payments.take");
      const options = p.options || {};
      const ownerId = String(p.ownerId || "");
      if (ownerId && !await getOwnerById(ctx, ownerId)) throw new Error("Customer not found.");
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(options.requestId || "")) throw new Error("A sale reference is required.");
      const previous = await ctx.db.query("orders").withIndex("by_requestId", q => q.eq("requestId", options.requestId)).first();
      if (previous) return {ok: true, orderId: previous.id, total: previous.total};
      if (Array.isArray(p.lines) && p.lines.some(line => line?.productId)) {
        const catalog = await ctx.db.query("cms").first();
        if (!catalog?.catalogConfirmed) throw new Error("Confirm actual naira catalog prices in Site & Staff before selling catalog products. Use a custom line for a verified walk-in price.");
      }
      const products = await ctx.db.query("products").collect();
      const sale = prepareStoreSale(p.lines, products, p.method, options);
      const order = {
        id: uid("or"), ownerId, placedAt: new Date().toISOString(), items: sale.items,
        fulfillment: "pos", address: "", status: "delivered", stage: "done",
        total: sale.total, paid: sale.total, paymentStatus: "recorded", method: p.method,
        requestId: options.requestId, reference: sale.reference, tendered: sale.tendered, change: sale.change
      };
      for (const [id, qty] of sale.quantities) {
        const product = products.find(x => x.id === id);
        await ctx.db.patch(product._id, {stock: product.stock - qty});
      }
      await ctx.db.insert("orders", order);
      await audit(ctx, admin, "In-store sale", order.id + " — NGN " + sale.total.toFixed(2));
      return { ok: true, orderId: order.id, total: sale.total };
    }

    if (op === "refundStoreSale") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "payments.refund");
      const order = await ctx.db.query("orders").withIndex("by_external_id", q => q.eq("id", p.orderId)).first();
      if (!order || order.fulfillment !== "pos") throw new Error("In-store sale not found.");
      const options = p.options || {};
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(options.requestId || "")) throw new Error("A refund reference is required.");
      const refunds = order.storeRefunds || [];
      if (refunds.some(x => x.requestId === options.requestId)) return {ok: true, orderId: order.id};
      const amount = Number(p.amount);
      const reason = String(options.reason || "").trim().slice(0, 500);
      if (!Number.isFinite(amount) || amount <= 0 || round2(amount) !== amount || amount > order.paid) throw new Error("Refund must be positive and cannot exceed the amount paid.");
      if (!["Cash", "Bank transfer"].includes(p.method) || !reason) throw new Error("Enter the refund method and reason.");
      refunds.push({requestId: options.requestId, amount, method: p.method, reason, at: new Date().toISOString()});
      const paid = round2(order.paid - amount);
      await ctx.db.patch(order._id, {paid, refunded: round2((order.refunded || 0) + amount), status: paid === 0 ? "refunded" : order.status, storeRefunds: refunds});
      await audit(ctx, admin, "In-store refund recorded", order.id + " — NGN " + amount.toFixed(2));
      return {ok: true, orderId: order.id};
    }

    if (op === "addPaymentMethod" || op === "removePaymentMethod" || op === "setPrimaryPayment") {
      throw new Error("Payment methods are managed by the payment provider and are not stored by this application.");
    }

    if (op === "submitContact") {
      const identityValue = await ctx.auth.getUserIdentity();
      const name = String(p.name || "").trim();
      const email = String(p.email || "").trim().toLowerCase();
      const subject = String(p.subject || "").trim().slice(0, 200);
      const message = String(p.body || "").trim().slice(0, 4000);
      if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
        throw new Error("Invalid contact message.");
      }
      await limitSubmission(ctx, identityValue, email);
      const matchedOwner = identityValue ? await ownerFor(ctx, false) : null;
      await ctx.db.insert("contactMessages", {
        id: uid("ct"), name, email, subject, body: message, ownerId: matchedOwner?.id,
        createdAt: today(), status: "new"
      });
      if (matchedOwner) {
        await ctx.db.insert("messages", {
          id: uid("msg"), ownerId: matchedOwner.id, direction: "in", channel: "email",
          subject, body: message, read: false, createdAt: today()
        });
        await notify(ctx, matchedOwner.id, "contact", "Message received", "We've received your message.");
      }
      return { ok: true };
    }

    if (op === "submitInquiry") {
      const catalog = await ctx.db.query("cms").first();
      if (!catalog?.catalogConfirmed) throw new Error("Pet listings are not published yet. Please contact the store.");
      const identityValue = await ctx.auth.getUserIdentity();
      const owner = identityValue ? await ownerFor(ctx, true) : null;
      const listing = await ctx.db.query("listings").filter(q => q.eq(q.field("id"), p.listingId)).first();
      if (!listing || listing.status !== "available") throw new Error("Listing is not available.");
      const message = String(p.message || "").trim().slice(0, 2000);
      const name = String(p.name || owner?.fullName || "").trim();
      const email = String(p.email || owner?.email || "").trim().toLowerCase();
      if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter your name and a valid email so the team can reply.");
      await limitSubmission(ctx, identityValue, email);
      const count = (await ctx.db.query("inquiries").collect()).length + 1;
      const ref = "INQ-" + String(count).padStart(4, "0");
      await ctx.db.insert("inquiries", { id: uid("inq"), ref, ownerId: owner?.id || "guest", name, email, listingId: listing.id, message, status: "new", createdAt: today() });
      if (owner) await notify(ctx, owner.id, "listing", "Inquiry " + ref + " sent", "We'll contact you about " + listing.name + ".");
      if (owner) await ctx.db.insert("messages", { id: uid("msg"), ownerId: owner.id, direction: "out", channel: "portal", subject: "Inquiry " + ref + " about " + listing.name, body: "Your inquiry was saved for the team. They can reply using your contact details.", read: false, createdAt: new Date().toISOString() });
      return { ok: true, ref };
    }

    throw new Error("Unknown operation.");
  }
});
