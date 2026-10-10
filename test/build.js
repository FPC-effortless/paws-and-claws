const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
assert.equal(config.outputDirectory, 'dist');
for (const entry of ['.env.local', '.git', 'convex', 'test', 'tools', 'scripts', 'node_modules', 'package.json']) {
  assert(!fs.existsSync(path.join(output, entry)), entry + ' must not be deployed');
}
for (const page of ['index.html','services.html','shop.html','pets.html','membership.html','account.html','contact.html','admin/index.html']) {
  const html = fs.readFileSync(path.join(output, page), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css|ico|png|jpg|webp))(?:[?#][^"]*)?"/g)) {
    if (/^https?:/.test(match[1])) continue;
    const asset = match[1].startsWith('/')
      ? path.join(output, match[1].replace(/^\/+/, ''))
      : path.resolve(path.dirname(path.join(output, page)), match[1]);
    assert(asset.startsWith(output + path.sep), 'asset must stay in the static output');
    assert(fs.existsSync(asset), page + ' references missing asset ' + match[1]);
  }
}
assert(fs.existsSync(path.join(output,'assets/js/vendor/clerk-js/clerk.browser.js')));
assert(fs.existsSync(path.join(output,'assets/js/vendor/clerk-ui/ui.browser.js')));
assert(fs.existsSync(path.join(output,'assets/js/runtime-config.js')));
for (const page of ['index.html','services.html','shop.html','pets.html','membership.html','events.html','account.html','contact.html','admin/index.html']) {
  assert(fs.readFileSync(path.join(output,page),'utf8').includes('/assets/js/runtime-config.js'), page + ' must load runtime configuration');
}
console.log('Static deployment isolation and asset checks passed.');
