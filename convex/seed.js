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

const TABLES = [
  "owners", "pets", "bookings", "orders", "listings", "products",
  "services", "staffLeave", "waitlist", "messages", "notifications",
  "payments", "audit", "admins",
];

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
        const { _id, _creationTime, ...rest } = row;
        await ctx.db.insert(table, rest);
      }
    }
    return counts;
  },
});
