const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");

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
