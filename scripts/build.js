const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const clerkKey = String(process.env.CLERK_PUBLISHABLE_KEY || "").trim();
const convexUrl = String(process.env.CONVEX_URL || "").trim();
if (clerkKey && !/^pk_(?:live|test)_/.test(clerkKey)) throw new Error("CLERK_PUBLISHABLE_KEY must be a Clerk publishable key.");
if (convexUrl && !/^https:\/\/[a-z0-9-]+\.convex\.cloud\/?$/i.test(convexUrl)) throw new Error("CONVEX_URL must be an HTTPS convex.cloud URL.");
if (process.env.VERCEL_ENV && (!clerkKey || !convexUrl)) throw new Error("CLERK_PUBLISHABLE_KEY and CONVEX_URL are required for Vercel builds.");

function copyBrowserRuntime(packageName, entryFile, destinationName) {
  const sourceDir = path.dirname(require.resolve(packageName));
  const destinationDir = path.join(projectRoot, "assets", "js", "vendor", destinationName);
  fs.mkdirSync(destinationDir, { recursive: true });

  function copyJavaScriptFiles(from, to) {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const sourcePath = path.join(from, entry.name);
      const destinationPath = path.join(to, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destinationPath, { recursive: true });
        copyJavaScriptFiles(sourcePath, destinationPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        fs.copyFileSync(sourcePath, destinationPath);
      }
    }
  }

  copyJavaScriptFiles(sourceDir, destinationDir);
  if (!fs.existsSync(path.join(destinationDir, entryFile))) {
    throw new Error(`Could not find ${entryFile} in ${packageName}.`);
  }
}

// Ship the browser SDKs with the site so production does not depend on CDN
// module loading or Clerk's package-serving endpoint.
const convexBundle = path.resolve(path.dirname(require.resolve("convex")), "../browser.bundle.js");
fs.copyFileSync(convexBundle, path.join(projectRoot, "assets", "js", "convex.browser.bundle.js"));
copyBrowserRuntime("@clerk/clerk-js", "clerk.browser.js", "clerk-js");
copyBrowserRuntime("@clerk/ui", "ui.browser.js", "clerk-ui");
console.log("Copied Clerk and Convex browser SDKs into the deployment assets.");

// Publish only the static website, never the checkout or local configuration.
const outputDirectory = path.resolve(projectRoot, "dist");
if (path.dirname(outputDirectory) !== projectRoot) throw new Error("Invalid static output directory.");
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
for (const page of ["index.html", "services.html", "shop.html", "pets.html", "membership.html", "events.html", "account.html", "contact.html"]) {
  fs.copyFileSync(path.join(projectRoot, page), path.join(outputDirectory, page));
}
fs.mkdirSync(path.join(outputDirectory, "admin"));
fs.copyFileSync(path.join(projectRoot, "admin", "index.html"), path.join(outputDirectory, "admin", "index.html"));
fs.cpSync(path.join(projectRoot, "assets"), path.join(outputDirectory, "assets"), { recursive: true });
const runtimeConfig = "window.PNC_CLERK_PUBLISHABLE_KEY=" + JSON.stringify(clerkKey) + ";\nwindow.__PNC_CONVEX_URL__=" + JSON.stringify(convexUrl) + ";\n";
fs.writeFileSync(path.join(outputDirectory, "assets", "js", "runtime-config.js"), runtimeConfig);
for (const page of ["index.html", "services.html", "shop.html", "pets.html", "membership.html", "events.html", "account.html", "contact.html", "admin/index.html"]) {
  const target = path.join(outputDirectory, page);
  const html = fs.readFileSync(target, "utf8");
  fs.writeFileSync(target, html.replace("</head>", '  <script src="/assets/js/runtime-config.js"></script>\n</head>'));
}
console.log("Built the static website in dist/.");
