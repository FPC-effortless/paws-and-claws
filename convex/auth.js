/* ============================================================
   Paws & Claws — Convex server functions: authentication
   ------------------------------------------------------------
   Server-side password hashing (scrypt) replaces the demo-only
   FNV scramble in data.js and the plaintext comparison the admin
   panel currently uses. Session tokens are stored in a
   `sessions` table so logouts actually invalidate them.
   ============================================================ */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/* SHA-style output: "scrypt:<salt>:<hash>" */
const ROUNDS = 16384;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return "scrypt:" + salt + ":" + hash;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt:")) return false;
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const existing = Buffer.from(hash, "hex");
  if (candidate.length !== existing.length) return false;
  return timingSafeEqual(candidate, existing);
}

/* ----------------------------- owner ----------------------------- */
export const signUp = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    password: v.string(),
    phone: v.optional(v.string()),
    petName: v.optional(v.string()),
    petSpecies: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("owners")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (existing) return { error: "An account with this email already exists." };
    if (args.password.length < 8) return { error: "Password must be at least 8 characters." };

    const now = new Date().toISOString().slice(0, 10);
    const ownerId = await ctx.db.insert("owners", {
      fullName: args.fullName.trim(),
      email,
      passwordHash: hashPassword(args.password),
      phone: args.phone || "",
      notes: "",
      createdAt: now,
    });

    if (args.petName) {
      await ctx.db.insert("pets", {
        ownerId,
        petName: args.petName.trim(),
        species: args.petSpecies || "Dog",
        sex: "Male",
        altered: "Intact",
        weightKg: 0,
        vaccines: [],
        notes: "",
        createdAt: now,
      });
    }
    return { ownerId };
  },
});

export const logIn = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const e = email.trim().toLowerCase();
    const owner = await ctx.db
      .query("owners")
      .filter((q) => q.eq(q.field("email"), e))
      .first();
    if (!owner || !verifyPassword(password, owner.passwordHash)) {
      return { error: "Incorrect email or password." };
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", {
      subjectId: owner._id,
      subjectType: "owner",
      token,
      expiresAt,
    });
    return { token, ownerId: owner._id, expiresAt };
  },
});

/* ----------------------------- admin ----------------------------- */
export const adminLogIn = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (convexCtx, { email, password }) => {
    const e = email.trim().toLowerCase();
    const admin = await convexCtx.db
      .query("admins")
      .filter((q) => q.eq(q.field("email"), e))
      .first();
    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      return { error: "Invalid admin credentials." };
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    await convexCtx.db.insert("sessions", {
      subjectId: admin._id,
      subjectType: "admin",
      token,
      expiresAt,
    });
    return { token, adminId: admin._id, role: admin.role, expiresAt };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("token"), token))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});

/* Lookup used by the client to restore a session from a stored
   token. Read-only; expired sessions are ignored and swept by
   auth:sweepExpired (a cron can call it). */
export const session = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("token"), token))
      .first();
    if (!s || s.expiresAt < Date.now()) return null;
    const doc = await ctx.db.get(s.subjectId);
    if (!doc) return null;
    return { subjectType: s.subjectType, email: doc.email, role: doc.role || null };
  },
});

export const sweepExpired = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = (await ctx.db.query("sessions").collect()).filter(
      (s) => s.expiresAt < now
    );
    for (const s of stale) await ctx.db.delete(s._id);
    return { swept: stale.length };
  },
});
