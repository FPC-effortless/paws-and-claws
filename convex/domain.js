import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const PLANS = { puppy: 0.05, adult: 0.15, senior: 0.25 };
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
    "crm.view": "own", "bookings.view": "own", "bookings.notes": true,
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

const DAY_START = 8;
const DAY_END = 19;
const STEP = 0.5;

function today() { return new Date().toISOString().slice(0, 10); }
function parseDate(s) {
  const p = String(s || "").split("-").map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}
function uid(prefix) {
  return prefix + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
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

async function identity(ctx) {
  const id = await ctx.auth.getUserIdentity();
  if (!id) throw new Error("Not authenticated.");
  return id;
}

async function ownerFor(ctx, allowCreate = false) {
  const id = await identity(ctx);
  const staffByClerk = await ctx.db.query("admins").withIndex("by_clerkId", q => q.eq("clerkId", id.subject)).first();
  const staffByEmail = !staffByClerk && id.email
    ? await ctx.db.query("admins").withIndex("by_email", q => q.eq("email", id.email.toLowerCase())).first()
    : null;
  if (staffByClerk || staffByEmail) return null;

  let owner = await ctx.db.query("owners").withIndex("by_clerkId", q => q.eq("clerkId", id.subject)).first();
  if (!owner && id.email) {
    owner = await ctx.db.query("owners").withIndex("by_email", q => q.eq("email", id.email.toLowerCase())).first();
  }
  if (!owner && allowCreate) {
    owner = {
      id: "ow-" + crypto.randomUUID().slice(0, 8),
      clerkId: id.subject,
      fullName: id.name || id.email || "Member",
      email: (id.email || "").toLowerCase(),
      phone: "",
      emergencyContact: "",
      address: "",
      plan: "puppy",
      notes: "",
      createdAt: today()
    };
    await ctx.db.insert("owners", owner);
  }
  return owner;
}

async function adminFor(ctx) {
  const id = await identity(ctx);
  let admin = await ctx.db.query("admins").withIndex("by_clerkId", q => q.eq("clerkId", id.subject)).first();
  if (!admin && id.email) {
    admin = await ctx.db.query("admins").withIndex("by_email", q => q.eq("email", id.email.toLowerCase())).first();
  }
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
  return await ctx.db.query("services").filter(q => q.eq(q.field("id"), id)).first();
}
async function getProvider(ctx, id) {
  return (await ctx.db.query("providers").filter(q => q.eq(q.field("id"), id)).first()) ||
    PROVIDERS.find(p => p.id === id) || null;
}
async function getPet(ctx, id) {
  return await ctx.db.query("pets").filter(q => q.eq(q.field("id"), id)).first();
}
async function getOwnerById(ctx, id) {
  return await ctx.db.query("owners").filter(q => q.eq(q.field("id"), id)).first();
}
async function getBooking(ctx, id) {
  return await ctx.db.query("bookings").filter(q => q.eq(q.field("id"), id)).first();
}
async function getProduct(ctx, id) {
  return await ctx.db.query("products").filter(q => q.eq(q.field("id"), id)).first();
}
async function getOrder(ctx, id) {
  return await ctx.db.query("orders").filter(q => q.eq(q.field("id"), id)).first();
}
function activeBookingStatus(status) {
  return !["cancelled", "completed", "no-show"].includes(status);
}
function serviceProviders(service, providers) {
  return providers.filter(p => (service.staff || []).includes(p.id));
}
async function slotAvailable(ctx, service, provider, date, hour, ignoreBookingId) {
  if (service.duration >= 24) return false;
  const d = parseDate(date);
  if (Number.isNaN(d.getTime()) || dateOnly(d.toISOString()) !== date) return false;
  if (date < today()) return false;
  if (provider.off && provider.off.includes(d.getDay())) return false;
  const leave = await ctx.db.query("staffLeave").filter(q => q.eq(q.field("providerId"), provider.id)).collect();
  if (leave.some(x => x.date === date)) return false;
  const t = Number(hour);
  if (!Number.isFinite(t) || Math.round(t * 2) !== t * 2) return false;
  if (t < Math.max(DAY_START, provider.start) || t + service.duration > Math.min(DAY_END, provider.end)) return false;
  if (hash01(date + "|" + provider.id + "|" + t) <= 0.22) return false;
  const bookings = await ctx.db.query("bookings").filter(q => q.eq(q.field("providerId"), provider.id)).collect();
  return !bookings.some(b => b.id !== ignoreBookingId && b.date === date && activeBookingStatus(b.status) &&
    t < b.hour + b.duration && b.hour < t + service.duration);
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
    at: today()
  });
}

async function bootstrapData(ctx) {
  const id = await ctx.auth.getUserIdentity();
  const publicData = {
    version: 1,
    owners: [], pets: [], bookings: [], orders: [], listings: [],
    products: await ctx.db.query("products").collect(),
    services: await ctx.db.query("services").collect(),
    serviceGroups: await ctx.db.query("serviceGroups").collect(),
    providers: await ctx.db.query("providers").collect(),
    staffLeave: await ctx.db.query("staffLeave").collect(),
    waitlist: [], messages: [], notifications: [], payments: [],
    audit: [], admins: [], inquiries: [], contactMessages: [],
    cms: (await ctx.db.query("cms").first()) || null,
    inquiryCounter: 0
  };
  if (!id) return publicData;

  const admin = await adminFor(ctx);
  if (admin) {
    const out = { ...publicData };
    out.admins = [admin];
    if (admin.role === "super") {
      out.owners = await ctx.db.query("owners").collect();
      out.pets = await ctx.db.query("pets").collect();
      out.bookings = await ctx.db.query("bookings").collect();
      out.orders = await ctx.db.query("orders").collect();
      out.listings = await ctx.db.query("listings").collect();
      out.staffLeave = await ctx.db.query("staffLeave").collect();
      out.waitlist = await ctx.db.query("waitlist").collect();
      out.messages = await ctx.db.query("messages").collect();
      out.notifications = await ctx.db.query("notifications").collect();
      out.audit = await ctx.db.query("audit").collect();
      out.inquiries = await ctx.db.query("inquiries").collect();
      out.contactMessages = await ctx.db.query("contactMessages").collect();
      return out;
    }
    if (admin.role === "desk") {
      out.owners = await ctx.db.query("owners").collect();
      out.pets = await ctx.db.query("pets").collect();
      out.bookings = await ctx.db.query("bookings").collect();
      out.orders = await ctx.db.query("orders").collect();
      out.listings = await ctx.db.query("listings").collect();
      out.waitlist = await ctx.db.query("waitlist").collect();
      out.messages = await ctx.db.query("messages").collect();
      out.notifications = await ctx.db.query("notifications").collect();
      out.audit = await ctx.db.query("audit").collect();
      out.inquiries = await ctx.db.query("inquiries").collect();
      out.contactMessages = await ctx.db.query("contactMessages").collect();
      return out;
    }
    if (admin.role === "retail") {
      out.owners = (await ctx.db.query("owners").collect()).map(o => ({
        id: o.id, fullName: o.fullName, email: o.email, phone: o.phone || ""
      }));
      out.orders = await ctx.db.query("orders").collect();
      out.listings = await ctx.db.query("listings").collect();
      out.audit = await ctx.db.query("audit").collect();
      out.inquiries = await ctx.db.query("inquiries").collect();
      out.contactMessages = await ctx.db.query("contactMessages").collect();
      return out;
    }
    if (admin.role === "provider") {
      const bookings = (await ctx.db.query("bookings").collect()).filter(b => b.providerId === admin.providerId);
      const ownerIds = [...new Set(bookings.map(b => b.ownerId))];
      const petIds = [...new Set(bookings.map(b => b.petId))];
      out.bookings = bookings;
      out.owners = (await ctx.db.query("owners").collect()).filter(o => ownerIds.includes(o.id));
      out.pets = (await ctx.db.query("pets").collect()).filter(p => petIds.includes(p.id));
      out.messages = (await ctx.db.query("messages").collect()).filter(m => ownerIds.includes(m.ownerId));
      return out;
    }
  }

  const owner = await ownerFor(ctx, false);
  if (!owner) return publicData;
  return {
    ...publicData,
    owners: [owner],
    pets: (await ctx.db.query("pets").collect()).filter(p => p.ownerId === owner.id),
    bookings: (await ctx.db.query("bookings").collect()).filter(b => b.ownerId === owner.id),
    orders: (await ctx.db.query("orders").collect()).filter(o => o.ownerId === owner.id),
    messages: (await ctx.db.query("messages").collect()).filter(m => m.ownerId === owner.id),
    notifications: (await ctx.db.query("notifications").collect()).filter(n => n.ownerId === owner.id),
    payments: [],
    waitlist: (await ctx.db.query("waitlist").collect()).filter(w => w.ownerId === owner.id),
    inquiries: (await ctx.db.query("inquiries").collect()).filter(i => i.ownerId === owner.id)
  };
}

export const bootstrap = query({
  args: {},
  handler: async (ctx) => bootstrapData(ctx)
});

const OPS = new Set([
  "ensureOwner","markNotificationRead","markNotificationsRead","updateOwner","addPet","updatePet",
  "removePet","addVaccine","setVaccineStatus","createBooking","rescheduleBooking","cancelBooking",
  "setBookingStatus","addBookingNote","placeOrder","setOrderStage","refund","setListingStatus",
  "adjustStock","updateProduct","updateCMS","updateService","addLeave","removeLeave",
  "joinWaitlist","removeWaitlist","posCharge","addPaymentMethod","removePaymentMethod",
  "setPrimaryPayment","submitContact","submitInquiry"
]);

export const mutate = mutation({
  args: { op: v.string(), payload: v.any() },
  handler: async (ctx, { op, payload }) => {
    if (!OPS.has(op)) throw new Error("Unknown operation.");
    if (payload == null || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid operation payload.");
    const p = payload;

    if (op === "ensureOwner") {
      const id = await identity(ctx);
      const staff = await adminFor(ctx);
      if (staff) {
        if (staff.clerkId !== id.subject) await ctx.db.patch(staff._id, { clerkId: id.subject });
        return { ok: true, kind: "admin" };
      }
      const owner = await ownerFor(ctx, true);
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
      if (patch.email) patch.email = patch.email.trim().toLowerCase();
      if (patch.fullName && patch.fullName.trim().length < 2) throw new Error("Name is too short.");
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
      const pet = {
        id: uid("pt"), ownerId, petName: String(input.petName || "New pet").trim() || "New pet",
        species: allowedSpecies.includes(input.species) ? input.species : "Dog",
        breed: String(input.breed || "").trim(), dob: String(input.dob || ""),
        sex: allowedSex.includes(input.sex) ? input.sex : "Male",
        altered: allowedAltered.includes(input.altered) ? input.altered : "Intact",
        weightKg: Math.max(0, Number(input.weightKg) || 0),
        microchip: String(input.microchip || "").trim(), coat: String(input.coat || "").trim(),
        tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 12) : [],
        vaccines: [], notes: String(input.notes || ""), createdAt: today()
      };
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
      const patch = {};
      for (const k of ["petName","species","breed","dob","sex","altered","weightKg","microchip","coat","notes"]) {
        if (input[k] !== undefined) patch[k] = k === "weightKg" ? Math.max(0, Number(input[k]) || 0) : String(input[k]);
      }
      if (input.tags !== undefined) patch.tags = Array.isArray(input.tags) ? input.tags.map(String).slice(0, 12) : [];
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
      const pet = await getPet(ctx, p.petId);
      if (!pet || pet.ownerId !== owner?.id) throw new Error("Not authorized.");
      const name = String(p.name || "").trim();
      const date = String(p.date || "");
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid vaccine record.");
      const vaccines = Array.isArray(pet.vaccines) ? pet.vaccines.slice() : [];
      vaccines.push({ name, date, lot: String(p.lot || ""), status: "pending" });
      await ctx.db.patch(pet._id, { vaccines });
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

    if (op === "createBooking") {
      const owner = await ownerFor(ctx, true);
      const service = await getService(ctx, p.serviceId);
      const pet = await getPet(ctx, p.petId);
      if (!owner || !service || !pet || pet.ownerId !== owner.id) throw new Error("Invalid booking request.");
      if (service.duration >= 24) throw new Error("This service requires overnight scheduling; please contact the store.");
      if (service.deposit && process.env.PNC_PAYMENTS_ENABLED !== "true") throw new Error("This booking requires a payment processor that is not configured yet.");
      const required = pet.species === "Cat" ? ["Rabies","FVRCP"] : ["Rabies","DHPP","Bordetella"];
      if (service.requiresVaccine) {
        const have = (pet.vaccines || []).filter(v => v.status === "approved").map(v => v.name);
        const missing = required.filter(v => !have.includes(v));
        if (missing.length) throw new Error("Missing required vaccines: " + missing.join(", ") + ".");
      }
      const provider = await getProvider(ctx, p.providerId);
      if (!provider || !(service.staff || []).includes(provider.id)) throw new Error("Specialist is not available for this service.");
      const ok = await slotAvailable(ctx, service, provider, String(p.date), Number(p.hour));
      if (!ok) throw new Error("That time slot is no longer available.");
      const rate = PLANS[owner.plan] || 0;
      const total = round2(service.price * (1 - rate));
      const deposit = service.deposit ? round2(total * 0.30) : 0;
      const booking = {
        id: uid("bk"), ownerId: owner.id, petId: pet.id, serviceId: service.id,
        providerId: provider.id, date: String(p.date), hour: Number(p.hour), duration: service.duration,
        status: "confirmed", deposit, total, paid: 0, paymentStatus: service.deposit ? "pending" : "not_required",
        intake: p.intake || {}, createdAt: today(), createdBy: "self", discountRate: rate
      };
      await ctx.db.insert("bookings", booking);
      await notify(ctx, owner.id, "booking", "Booking confirmed: " + service.name, pet.petName + " is booked for " + booking.date + ".");
      await ctx.db.insert("messages", { id: uid("msg"), ownerId: owner.id, direction: "out", channel: "email", subject: "Appointment confirmation", body: service.name + " for " + pet.petName + " on " + booking.date + ". Payment due: $" + deposit.toFixed(2) + ".", read: false, createdAt: today() });
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
      if (!service || !provider) throw new Error("Invalid booking.");
      const ok = await slotAvailable(ctx, service, provider, String(p.date), Number(p.hour), booking.id);
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
      if (booking.status === "completed" && status !== "completed") throw new Error("Completed bookings cannot be reopened.");
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
      if (process.env.PNC_PAYMENTS_ENABLED !== "true") throw new Error("Online checkout is disabled until a payment processor is configured.");
      const rawLines = Array.isArray(p.items) ? p.items : [];
      if (!rawLines.length) throw new Error("Your cart is empty.");
      const lines = [];
      for (const item of rawLines) {
        const id = String(item.id || "");
        const qty = Number(item.qty);
        if (!Number.isInteger(qty) || qty <= 0) throw new Error("Invalid quantity.");
        const product = await getProduct(ctx, id);
        if (!product || !Number.isFinite(product.price) || product.price < 0) throw new Error("Invalid product.");
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
      const i = stages.indexOf(current);
      if (Math.abs(stages.indexOf(stage) - i) > 1) throw new Error("Invalid order transition.");
      const patch = { stage };
      if (stage === "done") patch.status = "delivered";
      await ctx.db.patch(order._id, patch);
      await notify(ctx, order.ownerId, "order", "Order " + order.id + " updated", "Status: " + stage + ".");
      await audit(ctx, admin, "Order stage", order.id + " -> " + stage);
      return { ok: true };
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
      const status = String(p.status || "");
      if (!["available","reserved","sold"].includes(status)) throw new Error("Invalid listing status.");
      await ctx.db.patch(l._id, { status });
      await audit(ctx, admin, "Listing status", l.name + " -> " + status);
      return { ok: true };
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
      return { ok: true };
    }

    if (op === "updateProduct") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "inventory.edit");
      const product = await getProduct(ctx, p.productId);
      if (!product) throw new Error("Product not found.");
      const patch = {};
      const input = p.patch || {};
      if (input.name !== undefined) patch.name = String(input.name).trim();
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
      await ctx.db.patch(product._id, patch);
      await audit(ctx, admin, "Product edited", product.id);
      return { ok: true };
    }

    if (op === "updateCMS") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "cms.edit");
      const cms = await ctx.db.query("cms").first();
      if (!cms) throw new Error("CMS record not initialized.");
      const patch = {};
      for (const k of ["siteName","tagline","banner","heroTitle","emergencyHotline","emergencyNote","phone","email","address"]) {
        if (p.patch?.[k] !== undefined) patch[k] = String(p.patch[k]);
      }
      if (p.patch?.hours !== undefined) patch.hours = p.patch.hours;
      if (p.patch?.toggles !== undefined) patch.toggles = p.patch.toggles;
      await ctx.db.patch(cms._id, patch);
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
      if (input.name !== undefined) patch.name = String(input.name).trim();
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
      await ctx.db.patch(s._id, patch);
      await audit(ctx, admin, "Service edited", s.id);
      return { ok: true };
    }

    if (op === "addLeave") {
      const admin = await adminFor(ctx);
      requirePermission(admin, "staff.manage");
      const provider = await getProvider(ctx, p.providerId);
      const date = String(p.date || "");
      if (!provider || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today()) throw new Error("Invalid leave date.");
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
      if (!service || !provider || !(service.staff || []).includes(provider.id)) throw new Error("Invalid waitlist request.");
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
      const owner = await getOwnerById(ctx, p.ownerId);
      if (!owner) throw new Error("Owner not found.");
      const lines = Array.isArray(p.lines) ? p.lines : [];
      const normalized = lines.map(x => {
        const amount = Number(x.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid POS amount.");
        return { label: String(x.label || "POS item").slice(0, 120), amount: round2(amount) };
      });
      if (!normalized.length) throw new Error("No POS lines.");
      const total = round2(normalized.reduce((n, x) => n + x.amount, 0));
      const order = {
        id: uid("or"), ownerId: owner.id, placedAt: today(),
        items: normalized.map(x => ({ productId: "pos", qty: 1, price: x.amount })),
        fulfillment: "pos", address: "", status: "delivered", stage: "done",
        total, paid: total, paymentStatus: "recorded", method: String(p.method || "Cash").slice(0, 30)
      };
      await ctx.db.insert("orders", order);
      await audit(ctx, admin, "POS charge", order.id + " — $" + total.toFixed(2));
      return { ok: true, orderId: order.id, total };
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
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
        throw new Error("Invalid contact message.");
      }
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
      const identityValue = await ctx.auth.getUserIdentity();
      const owner = identityValue ? await ownerFor(ctx, true) : null;
      const listing = await ctx.db.query("listings").filter(q => q.eq(q.field("id"), p.listingId)).first();
      if (!listing || listing.status !== "available") throw new Error("Listing is not available.");
      const message = String(p.message || "").trim().slice(0, 2000);
      const count = (await ctx.db.query("inquiries").collect()).length + 1;
      const ref = "INQ-" + String(count).padStart(4, "0");
      await ctx.db.insert("inquiries", { id: uid("inq"), ref, ownerId: owner?.id || "guest", listingId: listing.id, message, status: "new", createdAt: today() });
      if (owner) await notify(ctx, owner.id, "listing", "Inquiry " + ref + " sent", "We'll contact you about " + listing.name + ".");
      return { ok: true, ref };
    }

    throw new Error("Unknown operation.");
  }
});
