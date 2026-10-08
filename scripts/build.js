const fs = require("node:fs");
const path = require("node:path");

// Serve Convex from this deployment instead of relying on a third-party CDN.
const source = path.resolve(path.dirname(require.resolve("convex")), "../browser.bundle.js");
const destination = path.join(__dirname, "..", "assets", "js", "convex.browser.bundle.js");
fs.copyFileSync(source, destination);
console.log("Copied the Convex browser client into the deployment assets.");
