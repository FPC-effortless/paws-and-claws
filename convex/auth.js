/* ============================================================
   Paws & Claws — Convex server functions: authentication
   ------------------------------------------------------------
   Server-side password hashing replaces the demo-only FNV scramble
   in data.js and the plaintext comparison the admin panel currently
   uses. Session tokens are stored in a `sessions` table so logouts
   actually invalidate them.

   NOTE ON CRYPTO: Convex functions run in a V8 isolate, not Node,
   so `node:crypto` is unavailable. Hashing uses the Web Crypto
   subtle APIs (PBKDF2-SHA-256), which are available there and are
   more than adequate for session password verification. Output
   format: "pbkdf2:<saltHex>:<hashHex>".
   ============================================================ */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ITERATIONS = 100_000;
const KEY_LEN = 32; /* 256-bit derived key */

const enc = new TextEncoder();

function toHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function fromHex(hex) {
  const out = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return out;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key, KEY_LEN * 8
  );
  return "pbkdf2:" + toHex(salt) + ":" + toHex(bits);
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("pbkdf2:")) return false;
  const [, saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = fromHex(saltHex);
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key, KEY_LEN * 8
  );
  /* Constant-time-ish compare over the derived bits. */
  const a = new Uint8Array(bits);
  const b = fromHex(hashHex);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
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
      passwordHash: await hashPassword(args.password),
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
    if (!owner || !await verifyPassword(password, owner.passwordHash)) {
      return { error: "Incorrect email or password." };
    }
    const token = tokenFor(owner._id, "owner");
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", {
      /* Store the stable string id the client store uses, not the
         Convex _id, so auth:session can return it directly and the
         member portal finds the same row locally and remotely. */
      subjectId: owner.id || owner._id,
      subjectType: "owner",
      token,
      expiresAt,
    });
    return { token, ownerId: owner.id || owner._id, expiresAt };
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
    if (!admin || !await verifyPassword(password, admin.passwordHash)) {
      return { error: "Invalid admin credentials." };
    }
    const token = tokenFor(admin._id, "admin");
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    await convexCtx.db.insert("sessions", {
      subjectId: admin.id || admin._id,
      subjectType: "admin",
      token,
      expiresAt,
    });
    return { token, adminId: admin.id || admin._id, role: admin.role, expiresAt };
  },
});

function tokenFor(subjectId, subjectType) {
  return subjectId + "|" + subjectType + "|" +
    toHex(crypto.getRandomValues(new Uint8Array(32)));
}

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
   auth:sweepExpired (a cron can call it).

   `subjectType` selects the collection, because `subjectId` is the
   stable string id of either an owner or an admin. */
export const session = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("token"), token))
      .first();
    if (!s || s.expiresAt < Date.now()) return null;
    if (s.subjectType === "admin") {
      const admin = await ctx.db
        .query("admins")
        .filter((q) => q.eq(q.field("id"), s.subjectId))
        .first();
      if (!admin) return null;
      return { subjectType: "admin", email: admin.email, role: admin.role };
    }
    const owner = await ctx.db
      .query("owners")
      .filter((q) => q.eq(q.field("id"), s.subjectId))
      .first();
    if (!owner) return null;
    return { subjectType: "owner", email: owner.email, role: null };
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
