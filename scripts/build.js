const fs = require("node:fs");
const path = require("node:path");

const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";
const convexUrl = process.env.CONVEX_URL || "";

if (!publishableKey.startsWith("pk_live_")) {
  throw new Error("Set CLERK_PUBLISHABLE_KEY to the Clerk production publishable key (pk_live_...).");
}

let parsedConvexUrl;
try {
  parsedConvexUrl = new URL(convexUrl);
} catch {
  throw new Error("Set CONVEX_URL to the production Convex deployment URL.");
}

if (parsedConvexUrl.protocol !== "https:" || !/^[a-z0-9-]+\.convex\.cloud$/i.test(parsedConvexUrl.hostname)) {
  throw new Error("CONVEX_URL must be an https://<deployment>.convex.cloud URL.");
}

const configPath = path.join(__dirname, "..", "assets", "js", "config.js");
const config = [
  "/* Generated at build time from the deployment environment. */",
  `window.PNC_CLERK_PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};`,
  `window.__PNC_CONVEX_URL__ = ${JSON.stringify(parsedConvexUrl.origin)};`,
  "",
].join("\n");

fs.writeFileSync(configPath, config);
console.log("Generated production Clerk and Convex client config.");
