import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
const allowed = new Set(['.html', '.css', '.js', '.mjs', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.avif', '.gif', '.woff', '.woff2', '.ttf', '.otf', '.xlsx']);
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
let count = 0;
let bytes = 0;
function copy(relative) {
  const source = path.join(root, relative);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink: ${relative}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(source)) copy(path.join(relative, name));
    return;
  }
  if (!allowed.has(path.extname(relative).toLowerCase()) && relative !== '_headers') return;
  fs.mkdirSync(path.dirname(path.join(destination, relative)), { recursive: true });
  fs.copyFileSync(source, path.join(destination, relative));
  count++;
  bytes += stat.size;
}
for (const entry of ['index.html', '404.html', '_headers', 'admin', 'assets', 'public']) copy(entry);
// Retain the bundled third-party license in the deployed distribution.
fs.copyFileSync(path.join(root, 'admin/vendor/SheetJS-LICENSE.txt'), path.join(destination, 'admin/vendor/SheetJS-LICENSE.txt'));
console.log(`Built dist/: ${count + 1} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB. Ready to deploy to Netlify.`);
