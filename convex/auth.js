/* Paws & Claws — Clerk authentication helpers.
   Application authorization is implemented in domain.js from ctx.auth,
   not from browser-supplied role metadata. */

import { query } from "./_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      subject: identity.subject,
      email: identity.email || null,
      name: identity.name || null,
    };
  },
});
