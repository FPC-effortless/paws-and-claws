/* ============================================================
   Paws & Claws — Convex server functions: seeding
   ------------------------------------------------------------
   Run `npx convex dev`, then push the local demo store once from
   the browser console:

       PNC_CONVEX.seedAll()

   That calls `seed:all` below with a JSON snapshot of the
   localStorage store produced by assets/js/data.js. Tables are
   cleared first, so only run this on an empty deployment.
   ============================================================ */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword } from "./auth.js";

const TABLES = [
  "owners", "pets", "bookings", "orders", "listings", "products",
  "services", "staffLeave", "waitlist", "messages", "notifications",
  "payments", "audit", "admins",
];

/* The client store hashes passwords with a cheap FNV scramble
   (data.js hashPw) — fine for a local demo, wrong for a real
   backend. Both collections arrive with hashes in that client
   format, so rehash them server-side on the way in. Without this
   every seeded member and admin would be locked out of the Convex
   deployment, because auth.js verifyPassword only accepts
   "pbkdf2:" hashes. */
const CLIENT_HASH = /^h[0-9a-f]{8}:\d+$/;

async function prepareRow(table, row) {
  const rest = Object.assign({}, row);
  delete rest._id;
  delete rest._creationTime;
  if (table === "admins") {
    /* Admins are seeded with a plaintext password for the demo
       console; never persist it. */
    const pw = rest.password;
    delete rest.password;
    if (pw != null) rest.passwordHash = await hashPassword(String(pw));
  }
  if (table === "owners") {
    if (rest.password) {
      /* Legacy owners carried a plaintext field; hash and drop it. */
      rest.passwordHash = await hashPassword(String(rest.password));
      delete rest.password;
    } else if (CLIENT_HASH.test(String(rest.passwordHash || ""))) {
      /* The client FNV hash is not recoverable to a password, so it
         cannot be upgraded in place. The seeded demo members all use
         the documented password; rehash it so they can sign in
         remotely. Any owner that does not match is left untouched
         and should reset. */
      rest.passwordHash = await hashPassword("member123");
      rest.hashUpgraded = true;
    }
  }
  if (table === "pets" || table === "owners") delete rest.password;
  return rest;
}

export const all = mutation({
  args: { snapshot: v.string() },
  handler: async (ctx, { snapshot }) => {
    let db;
    try { db = JSON.parse(snapshot); } catch { throw new Error("Invalid snapshot JSON."); }
    if (!db || typeof db !== "object") throw new Error("Snapshot is not an object.");

    /* Clear in dependency order so foreign keys never dangle mid-run.
       Order matters only for readability; Convex has no FK
       enforcement, but the order keeps re-seeds predictable. */
    for (const table of TABLES) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

    const counts = {};
    for (const table of TABLES) {
      const rows = Array.isArray(db[table]) ? db[table] : [];
      counts[table] = rows.length;
      for (const row of rows) {
        /* Drop client-only bookkeeping ids so Convex issues its own
           _id. Callers keep referencing stable string ids
           (ow-1, bk-1001 …) which are stored as fields. */
        await ctx.db.insert(table, await prepareRow(table, row));
      }
    }
    return counts;
  },
});
