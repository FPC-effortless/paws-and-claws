/* One-time Convex bootstrap.
   This mutation is intentionally protected by a deployment secret and is
   NOT exposed by the browser client. Set PNC_BOOTSTRAP_SECRET in the
   Convex deployment before invoking it from an administrator-controlled
   script/CLI. Never put that secret in the static site. */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

const TABLES = [
  "owners", "pets", "bookings", "orders", "listings", "products", "services",
  "serviceGroups", "providers", "staffLeave", "waitlist", "messages",
  "notifications", "payments", "audit", "admins", "uploads", "inquiries", "contactMessages", "cms"
];

function requireSecret(given) {
  const expected = process.env.PNC_BOOTSTRAP_SECRET;
  if (!expected || given !== expected) throw new Error("Bootstrap authorization failed.");
}

export const all = mutation({
  args: { secret: v.string(), snapshot: v.string() },
  handler: async (ctx, { secret, snapshot }) => {
    requireSecret(secret);
    let db;
    try { db = JSON.parse(snapshot); } catch { throw new Error("Invalid snapshot JSON."); }
    if (!db || typeof db !== "object") throw new Error("Snapshot is not an object.");

    for (const table of TABLES) {
      if (await ctx.db.query(table).first()) throw new Error("Bootstrap is one-time only. This deployment already contains data.");
    }

    const counts = {};
    for (const table of TABLES) {
      if (table === "cms") {
        if (db.cms && typeof db.cms === "object") {
          const row = Object.assign({}, db.cms);
          delete row._id;
          delete row._creationTime;
          row.id = row.id || "site";
          await ctx.db.insert("cms", row);
          counts[table] = 1;
        } else counts[table] = 0;
        continue;
      }
      const rows = Array.isArray(db[table]) ? db[table] : [];
      counts[table] = rows.length;
      for (const row of rows) {
        const copy = Object.assign({}, row);
        delete copy._id;
        delete copy._creationTime;
        if (table === "owners") delete copy.passwordHash;
        if (table === "admins") delete copy.passwordHash;
        await ctx.db.insert(table, copy);
      }
    }
    return counts;
  },
});
