import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const TTL = 30 * 60 * 1000;
const money = n => Math.round(n * 100);
const reference = () => "pnc_" + crypto.randomUUID().replace(/-/g, "");
const row = (ctx, table, id) => ctx.db.query(table).withIndex("by_external_id", q => q.eq("id", id)).first();
const attempt = (ctx, ref) => ctx.db.query("paymentAttempts").withIndex("by_reference", q => q.eq("reference", ref)).unique();
function config() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  const site = process.env.PNC_SITE_URL;
  if (!key || !site || !/^https:\/\//.test(site)) throw new Error("Paystack checkout is not configured.");
  return { key, site: site.replace(/\/$/, "") };
}
async function paystack(path, method = "GET", body) {
  const { key } = config();
  const response = await fetch("https://api.paystack.co" + path, {
    method, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.status) throw new Error(json?.message || "Paystack is unavailable. Please try again.");
  return json.data;
}
function identitySubject(identity) {
  if (!identity?.subject) throw new Error("Sign in to continue.");
  return identity.subject;
}
async function owner(ctx, subject, email, emailVerified) {
  let found = await ctx.db.query("owners").withIndex("by_clerkId", q => q.eq("clerkId", subject)).first();
  if (!found && emailVerified && email) {
    const candidate = await ctx.db.query("owners").withIndex("by_email", q => q.eq("email", email.trim().toLowerCase())).first();
    if (candidate && (!candidate.clerkId || candidate.clerkId === subject)) found = candidate;
  }
  if (!found?.id || !found.email) throw new Error("Complete your account profile first.");
  return found;
}
const requireCatalog = async ctx => {
  const cms = await ctx.db.query("cms").first();
  if (!cms?.catalogConfirmed) throw new Error("Current prices need store confirmation. Please contact the team.");
};
const requireReservationCapacity = async (ctx, ownerId) => {
  const recent = await ctx.db.query("paymentAttempts").withIndex("by_owner_status", q => q.eq("ownerId", ownerId).eq("status", "pending")).order("desc").take(3);
  if (recent.filter(x => x.status === "pending" && x.expiresAt > Date.now()).length >= 3) throw new Error("You already have several unpaid checkouts. Finish one or wait for it to expire.");
};
const target = async (ctx, a) => row(ctx, a.kind === "order" ? "orders" : "bookings", a.targetId);

export const reserveOrder = internalMutation({
  args: { subject: v.string(), email: v.optional(v.string()), emailVerified: v.optional(v.boolean()), reference: v.string(), items: v.array(v.object({ id: v.string(), qty: v.number() })), fulfillment: v.string(), address: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireCatalog(ctx);
    const o = await owner(ctx, args.subject, args.email, args.emailVerified);
    await requireReservationCapacity(ctx, o.id);
    if (!args.items.length || args.items.length > 50) throw new Error("Add between 1 and 50 products.");
    const quantities = new Map();
    for (const item of args.items) {
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) throw new Error("Invalid quantity.");
      quantities.set(item.id, (quantities.get(item.id) || 0) + item.qty);
    }
    if ([...quantities.values()].some(qty => qty > 99)) throw new Error("No product may exceed 99 units per order.");
    const lines = [];
    for (const [id, qty] of quantities) {
      const p = await row(ctx, "products", id);
      if (!p || p.active === false || !Number.isInteger(p.stock) || p.stock < qty || !Number.isFinite(p.price) || p.price <= 0) throw new Error("A product is unavailable or out of stock. Refresh your cart.");
      lines.push({ product: p, qty });
    }
    const fulfillment = args.fulfillment === "delivery" ? "delivery" : "pickup";
    const address = fulfillment === "delivery" ? String(args.address || o.address || "").trim().slice(0, 500) : "";
    if (fulfillment === "delivery" && address.length < 10) throw new Error("Add a delivery address to your account before checkout.");
    const amountKobo = lines.reduce((sum, line) => sum + money(line.product.price) * line.qty, 0);
    if (amountKobo < 100 || amountKobo > 100000000) throw new Error("Order total is outside the supported payment range.");
    const id = "or-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const expiresAt = Date.now() + TTL;
    for (const line of lines) await ctx.db.patch(line.product._id, { stock: line.product.stock - line.qty, lowStock: line.product.stock - line.qty <= line.product.lowAt });
    await ctx.db.insert("orders", {
      id, ownerId: o.id, placedAt: new Date().toISOString().slice(0, 10), items: lines.map(line => ({ productId: line.product.id, qty: line.qty, price: line.product.price })),
      fulfillment, address, status: "payment_pending", stage: "pending", total: amountKobo / 100,
      paid: 0, paymentStatus: "pending", method: "Paystack", discountRate: 0, reference: args.reference
    });
    await ctx.db.insert("paymentAttempts", { reference: args.reference, kind: "order", targetId: id, ownerId: o.id, email: o.email, amountKobo, status: "pending", expiresAt, createdAt: Date.now() });
    await ctx.scheduler.runAfter(TTL, internal.paystack.expire, { reference: args.reference });
    return { email: o.email, amountKobo, orderId: id };
  }
});

export const reserveBooking = internalMutation({
  args: { subject: v.string(), email: v.optional(v.string()), emailVerified: v.optional(v.boolean()), reference: v.string(), input: v.any() },
  handler: async (ctx, { subject, email, emailVerified, reference: ref, input }) => {
    await requireCatalog(ctx);
    const o = await owner(ctx, subject, email, emailVerified);
    await requireReservationCapacity(ctx, o.id);
    if (JSON.stringify(input || {}).length > 8000) throw new Error("Appointment details are too long.");
    const service = await row(ctx, "services", String(input.serviceId || ""));
    const pet = await row(ctx, "pets", String(input.petId || ""));
    const provider = await row(ctx, "providers", String(input.providerId || ""));
    if (!service || service.active === false || !service.deposit || service.duration >= 24 || !Number.isFinite(service.price) || service.price <= 0 || !pet || pet.ownerId !== o.id || !provider || provider.active === false || !(service.staff || []).includes(provider.id)) throw new Error("Invalid appointment request.");
    const date = String(input.date || ""), hour = Number(input.hour);
    const parsed = new Date(date + "T12:00:00Z");
    const lagos = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).filter(x => x.type !== "literal").map(x => [x.type, x.value]));
    const today = lagos.year + "-" + lagos.month + "-" + lagos.day;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < today || !Number.isFinite(hour) || hour * 2 !== Math.round(hour * 2) || hour < Math.max(8, provider.start) || hour + service.duration > Math.min(19, provider.end) || (date === today && hour * 60 <= Number(lagos.hour) * 60 + Number(lagos.minute))) throw new Error("Choose an available future time.");
    if ((provider.off || []).includes(parsed.getUTCDay())) throw new Error("The specialist is unavailable on that day.");
    const leave = await ctx.db.query("staffLeave").withIndex("by_providerId_date", q => q.eq("providerId", provider.id).eq("date", date)).first();
    if (leave) throw new Error("The specialist is on leave.");
    const cms = await ctx.db.query("cms").first();
    if (Array.isArray(cms?.hours) && cms.hours.length) {
      const day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][parsed.getUTCDay()];
      const schedule = cms.hours.find(x => x.day === day);
      const minutes = value => { const m = String(value || "").match(/^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/); return m ? (Number(m[1]) % 12 + (m[3] === "PM" ? 12 : 0)) * 60 + Number(m[2]) : null; };
      if (!schedule || minutes(schedule.open) === null || minutes(schedule.close) === null || hour * 60 < minutes(schedule.open) || (hour + service.duration) * 60 > minutes(schedule.close)) throw new Error("The store is closed at that time.");
    }
    if (service.requiresVaccine) {
      const required = pet.species === "Cat" ? ["Rabies", "FVRCP"] : pet.species === "Dog" ? ["Rabies", "DHPP", "Bordetella"] : [];
      const have = (pet.vaccines || []).filter(x => x.status === "approved" && (!x.expires || x.expires >= today)).map(x => x.name);
      if (!required.length || required.some(x => !have.includes(x))) throw new Error("Required vaccination records need approval before booking.");
    }
    for (const b of await ctx.db.query("bookings").withIndex("by_providerId_date", q => q.eq("providerId", provider.id).eq("date", date)).collect()) if (!["cancelled","completed","no-show"].includes(b.status) && hour < b.hour + b.duration && b.hour < hour + service.duration) throw new Error("That time slot was just taken.");
    for (const b of await ctx.db.query("bookings").withIndex("by_petId_date", q => q.eq("petId", pet.id).eq("date", date)).collect()) if (!["cancelled","completed","no-show"].includes(b.status) && hour < b.hour + b.duration && b.hour < hour + service.duration) throw new Error("Your pet already has an appointment then.");
    const amountKobo = money(Math.round(service.price * 0.3 * 100) / 100);
    if (amountKobo < 100) throw new Error("Deposit is outside the supported payment range.");
    const id = "bk-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12), expiresAt = Date.now() + TTL;
    await ctx.db.insert("bookings", { id, ownerId: o.id, petId: pet.id, serviceId: service.id, providerId: provider.id, date, hour, duration: service.duration, status: "payment_pending", deposit: amountKobo / 100, total: service.price, paid: 0, paymentStatus: "pending", intake: input.intake || {}, createdAt: today, createdBy: "self", discountRate: 0 });
    await ctx.db.insert("paymentAttempts", { reference: ref, kind: "booking", targetId: id, ownerId: o.id, email: o.email, amountKobo, status: "pending", expiresAt, createdAt: Date.now() });
    await ctx.scheduler.runAfter(TTL, internal.paystack.expire, { reference: ref });
    return { email: o.email, amountKobo, bookingId: id };
  }
});

export const release = internalMutation({ args: { reference: v.string() }, handler: async (ctx, { reference: ref }) => {
  const a = await attempt(ctx, ref);
  if (!a || a.status !== "pending") return;
  const t = await target(ctx, a);
  if (a.kind === "order" && t) {
    for (const line of t.items) {
      const p = await row(ctx, "products", line.productId);
      if (p) await ctx.db.patch(p._id, { stock: p.stock + line.qty, lowStock: p.stock + line.qty <= p.lowAt });
    }
    await ctx.db.patch(t._id, { status: "cancelled", paymentStatus: "expired" });
  } else if (t) await ctx.db.patch(t._id, { status: "cancelled", paymentStatus: "expired" });
  await ctx.db.patch(a._id, { status: "expired" });
} });

export const expire = internalMutation({ args: { reference: v.string() }, handler: async (ctx, { reference: ref }) => {
  const a = await attempt(ctx, ref);
  if (a?.status === "pending" && a.expiresAt <= Date.now()) await ctx.scheduler.runAfter(0, internal.paystack.release, { reference: ref });
} });

export const details = internalQuery({ args: { reference: v.string(), subject: v.optional(v.string()), email: v.optional(v.string()), emailVerified: v.optional(v.boolean()) }, handler: async (ctx, { reference: ref, subject, email, emailVerified }) => {
  const a = await attempt(ctx, ref);
  if (!a) throw new Error("Payment reference was not found.");
  if (subject) { const o = await owner(ctx, subject, email, emailVerified); if (o.id !== a.ownerId) throw new Error("This payment belongs to another account."); }
  return { reference: a.reference, kind: a.kind, targetId: a.targetId, amountKobo: a.amountKobo, email: a.email, status: a.status };
} });

export const settle = internalMutation({ args: { reference: v.string(), amountKobo: v.number(), currency: v.string(), status: v.string(), providerId: v.optional(v.number()) }, handler: async (ctx, p) => {
  const a = await attempt(ctx, p.reference);
  if (!a) throw new Error("Unknown payment reference.");
  if (p.status !== "success" || p.currency !== "NGN" || p.amountKobo !== a.amountKobo) throw new Error("Payment amount, currency or status does not match.");
  if (a.status === "paid") return { ok: true, kind: a.kind, targetId: a.targetId };
  if (a.status === "expired") { await ctx.db.patch(a._id, { status: "late_payment", providerId: p.providerId, refundKobo: a.amountKobo, lateRefund: true }); return { error: "Payment arrived after the reservation expired. A refund has been requested.", refundRequired: true }; }
  if (a.status === "late_payment") return { error: "The reservation expired. A refund is being arranged.", refundRequired: true };
  if (a.status !== "pending") return { error: "This payment cannot confirm an expired reservation." };
  const t = await target(ctx, a);
  if (!t || t.status !== "payment_pending") { await ctx.db.patch(a._id, { status: "late_payment", providerId: p.providerId, refundKobo: a.amountKobo, lateRefund: true }); return { error: "The reservation is no longer available. A refund has been requested.", refundRequired: true }; }
  await ctx.db.patch(t._id, { status: a.kind === "order" ? "open" : "confirmed", paid: a.amountKobo / 100, paymentStatus: "paid" });
  await ctx.db.patch(a._id, { status: "paid", providerId: p.providerId });
  await ctx.db.insert("notifications", { id: "nt-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12), ownerId: a.ownerId, kind: a.kind, title: a.kind === "order" ? "Order confirmed" : "Booking confirmed", body: "Payment confirmed for " + a.targetId + ".", read: false, createdAt: new Date().toISOString() });
  return { ok: true, kind: a.kind, targetId: a.targetId };
} });

export const beginOrder = action({ args: { items: v.array(v.object({ id: v.string(), qty: v.number() })), fulfillment: v.string(), address: v.optional(v.string()) }, handler: async (ctx, p) => {
  const { site } = config(), identity = await ctx.auth.getUserIdentity(), subject = identitySubject(identity), ref = reference();
  const reserved = await ctx.runMutation(internal.paystack.reserveOrder, { ...p, subject, email: identity.email, emailVerified: identity.emailVerified === true, reference: ref });
  try {
    const data = await paystack("/transaction/initialize", "POST", { email: reserved.email, amount: reserved.amountKobo, currency: "NGN", reference: ref, callback_url: site + "/shop.html?payment_ref=" + encodeURIComponent(ref), metadata: { kind: "order", targetId: reserved.orderId } });
    if (!/^https:\/\/[a-z0-9.-]*paystack\.com\//i.test(data.authorization_url || "")) throw new Error("Unexpected payment destination.");
    return { authorizationUrl: data.authorization_url, reference: ref };
  } catch (error) { await ctx.runMutation(internal.paystack.release, { reference: ref }); throw error; }
} });

export const beginBooking = action({ args: { input: v.any() }, handler: async (ctx, { input }) => {
  const { site } = config(), identity = await ctx.auth.getUserIdentity(), subject = identitySubject(identity), ref = reference();
  const reserved = await ctx.runMutation(internal.paystack.reserveBooking, { input, subject, email: identity.email, emailVerified: identity.emailVerified === true, reference: ref });
  try {
    const data = await paystack("/transaction/initialize", "POST", { email: reserved.email, amount: reserved.amountKobo, currency: "NGN", reference: ref, callback_url: site + "/services.html?payment_ref=" + encodeURIComponent(ref), metadata: { kind: "booking", targetId: reserved.bookingId } });
    if (!/^https:\/\/[a-z0-9.-]*paystack\.com\//i.test(data.authorization_url || "")) throw new Error("Unexpected payment destination.");
    return { authorizationUrl: data.authorization_url, reference: ref };
  } catch (error) { await ctx.runMutation(internal.paystack.release, { reference: ref }); throw error; }
} });

export const confirm = action({ args: { reference: v.string() }, handler: async (ctx, { reference: ref }) => {
  const identity = await ctx.auth.getUserIdentity(), subject = identitySubject(identity);
  const a = await ctx.runQuery(internal.paystack.details, { reference: ref, subject, email: identity.email, emailVerified: identity.emailVerified === true });
  if (a.status === "paid") return { ok: true, kind: a.kind, targetId: a.targetId };
  const data = await paystack("/transaction/verify/" + encodeURIComponent(ref));
  if (data.reference !== ref || String(data.customer?.email || "").toLowerCase() !== a.email.toLowerCase()) throw new Error("Payment identity did not match.");
  return ctx.runMutation(internal.paystack.settle, { reference: ref, amountKobo: data.amount, currency: data.currency, status: data.status, providerId: data.id });
} });

export const refund = action({ args: { orderId: v.optional(v.string()), bookingId: v.optional(v.string()), amount: v.number() }, handler: async (ctx, { orderId, bookingId, amount }) => {
  const identity = await ctx.auth.getUserIdentity(), subject = identitySubject(identity);
  const ticket = await ctx.runMutation(internal.paystack.requestRefund, { subject, email: identity.email, emailVerified: identity.emailVerified === true, orderId, bookingId, amount });
  try {
    const data = await paystack("/refund", "POST", { transaction: ticket.reference, amount: ticket.amountKobo });
    await ctx.runMutation(internal.paystack.recordRefund, { reference: ticket.reference, amountKobo: ticket.amountKobo, providerStatus: data.status || "pending" });
    return { ok: true, status: data.status || "pending" };
  } catch (error) { throw error; }
} });

export const requestRefund = internalMutation({ args: { subject: v.string(), email: v.optional(v.string()), emailVerified: v.optional(v.boolean()), orderId: v.optional(v.string()), bookingId: v.optional(v.string()), amount: v.number() }, handler: async (ctx, p) => {
  let admin = await ctx.db.query("admins").withIndex("by_clerkId", q => q.eq("clerkId", p.subject)).first();
  if (!admin && p.emailVerified && p.email) {
    const candidate = await ctx.db.query("admins").withIndex("by_email", q => q.eq("email", p.email.trim().toLowerCase())).first();
    if (candidate && (!candidate.clerkId || candidate.clerkId === p.subject)) admin = candidate;
  }
  if (admin?.role !== "super") throw new Error("Only a super admin may refund online orders.");
  if (!!p.orderId === !!p.bookingId) throw new Error("Select one order or booking to refund.");
  const targetId = p.orderId || p.bookingId;
  const item = await row(ctx, p.orderId ? "orders" : "bookings", targetId);
  if (!item) throw new Error("Payment record was not found.");
  const a = await ctx.db.query("paymentAttempts").withIndex("by_target", q => q.eq("targetId", targetId)).first();
  const amountKobo = money(p.amount);
  if (!a || a.status !== "paid" || a.refundKobo || !Number.isInteger(amountKobo) || amountKobo < 1 || amountKobo > money(item.paid) || amountKobo > a.amountKobo - (a.refundedKobo || 0)) throw new Error("There is no refundable Paystack balance or a refund is already pending.");
  await ctx.db.patch(a._id, { refundKobo: amountKobo, status: "refund_requested" });
  await ctx.db.insert("audit", { id: "au-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12), adminEmail: admin.email, action: "Paystack refund requested", detail: targetId + " — NGN " + (amountKobo / 100).toFixed(2), at: new Date().toISOString() });
  return { reference: a.reference, amountKobo };
} });
export const clearRefundRequest = internalMutation({ args: { reference: v.string() }, handler: async (ctx, { reference: ref }) => { const a = await attempt(ctx, ref); if (a?.status === "refund_requested") await ctx.db.patch(a._id, { status: "paid", refundKobo: undefined }); } });
export const recordRefund = internalMutation({ args: { reference: v.string(), amountKobo: v.number(), providerStatus: v.string() }, handler: async (ctx, p) => {
  const a = await attempt(ctx, p.reference);
  if (!a || a.refundKobo !== p.amountKobo || !["refund_requested","refund_pending","late_payment"].includes(a.status)) return;
  await ctx.db.patch(a._id, { status: "refund_pending" });
  if (p.providerStatus !== "processed") return;
  if (a.lateRefund) { await ctx.db.patch(a._id, { status: "refunded", refundKobo: undefined, refundedKobo: p.amountKobo }); return; }
  const order = await target(ctx, a);
  if (!order) return;
  const refunded = Math.round(((order.refunded || 0) + p.amountKobo / 100) * 100) / 100;
  const paid = Math.max(0, Math.round((order.paid - p.amountKobo / 100) * 100) / 100);
  await ctx.db.patch(order._id, { refunded, paid, ...(a.kind === "order" ? { status: paid === 0 ? "refunded" : order.status } : {}), paymentStatus: paid === 0 ? "refunded" : "partial_refund" });
  const refundedKobo = (a.refundedKobo || 0) + p.amountKobo;
  await ctx.db.patch(a._id, { status: refundedKobo >= a.amountKobo ? "refunded" : "paid", refundKobo: undefined, refundedKobo });
} });
