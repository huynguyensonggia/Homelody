import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = process.cwd();
const raw = fs.readFileSync('_headers', 'utf8');
const headers = Object.fromEntries(raw.split(/\r?\n/).filter(line => /^  [A-Za-z-]+:/.test(line)).map(line => {
  const colon = line.indexOf(':'); return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
}));
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  try { res.writeHead(200, { ...headers, 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/`;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-security-'));
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9247', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
const pending = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async expression => { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value; };
const deadline = setTimeout(() => { chrome.kill(); server.close(); process.exit(2); }, 45000);
try {
  let tab;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { tab = (await (await fetch('http://127.0.0.1:9247/json/list')).json()).find(t => t.type === 'page'); } catch {}
    if (tab) break;
    await sleep(150);
  }
  assert.ok(tab, 'Headless browser must start');
  ws = new WebSocket(tab.webSocketDebuggerUrl); await once(ws, 'open');
  ws.addEventListener('message', ({ data }) => { const message = JSON.parse(data), p = pending.get(message.id); if (p) { pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); } });
  await call('Page.enable');
  await call('Page.navigate', { url });
  for (let i = 0; i < 90; i++) { if (await ev('document.readyState === "complete"')) break; await sleep(150); }
  assert.equal(await ev('document.documentElement.classList.contains("js")'), true, 'Bootstrap runs with CSP');
  assert.equal(await ev(`(()=>{const s=document.createElement('script');s.textContent='window.INJECTED_SCRIPT=true';document.head.append(s);return !!window.INJECTED_SCRIPT})()`), false, 'CSP blocks injected inline JavaScript');
  assert.equal(await ev(`(()=>{const a=document.createElement('button');a.setAttribute('onclick','window.INJECTED_HANDLER=true');document.body.append(a);a.click();a.remove();return !!window.INJECTED_HANDLER})()`), false, 'CSP blocks HTML event handlers');
  assert.equal(await ev('typeof window.HOMELODY_CONFIG'), 'object', 'External application scripts load');
  for (let i = 0; i < 90; i++) { if (await ev('!!document.querySelector("[data-menu-carousel]")')) break; await sleep(150); }
  assert.equal(await ev('!!document.querySelector("[data-menu-carousel]")'), true, 'Menu still renders under CSP');
  await call('Page.navigate', { url: url + 'admin/' });
  for (let i = 0; i < 90; i++) { if (await ev('!!document.querySelector("#login:not([hidden])")')) break; await sleep(150); }
  assert.equal(await ev('!!document.querySelector("#login:not([hidden])")'), true, 'Admin login opens under CSP');
  assert.equal(await ev('document.querySelector("#login-error").textContent'), '', 'Admin SDK loads without boot errors');
  console.log('PASS: bootstrap and application scripts load; inline scripts and inline event handlers are blocked by actual browser CSP.');
  console.log('PASS: menu renders and admin login opens without boot errors under CSP.');
} finally {
  clearTimeout(deadline); ws?.close(); chrome.kill(); server.close();
}
