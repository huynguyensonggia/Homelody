import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const scope = { window: {}, URL };
vm.runInNewContext(fs.readFileSync('assets/js/config.js', 'utf8'), scope);
vm.runInNewContext(fs.readFileSync('assets/js/shop-settings.js', 'utf8'), scope);
const settings = scope.window.HOMELODY_SHOP_SETTINGS;
const defaults = JSON.parse(JSON.stringify(settings.resolveLinks({})));
assert.deepEqual(JSON.parse(JSON.stringify(settings.resolveLinks({ phone: '0773558945', instagram_url: '' }))), defaults);
for (const bad of ['javascript:alert(1)', 'data:text/html,test', 'http://insecure.example', 'https://user:password@example.com', 'https://example.com/\nattack']) {
  assert.equal(settings.webUrl(bad), '');
  assert.equal(settings.resolveLinks({ public_links: { INSTAGRAM_URL: bad } }).INSTAGRAM_URL, defaults.INSTAGRAM_URL);
}
assert.equal(settings.phoneUrl('not a number'), '');
assert.equal(settings.phoneUrl('0935 983 263'), 'tel:0935983263');
assert.equal(settings.webUrl('instagram.com/homelody.coffee'), 'https://instagram.com/homelody.coffee');
console.log('PASS safe URL validation, phone normalization and original website defaults take precedence over stale legacy fields.');

const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9250', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-links-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const base = process.env.STORY_URL || 'http://localhost:8000/';
let ws, id = 0; const pending = new Map(), errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function poll(expression) { for (let i = 0; i < 120; i++) { try { if (await ev(expression)) return; } catch (error) { if (!/context.*destroyed|Cannot find context|navigated/i.test(error.message)) throw error; } await sleep(75); } throw Error('Timeout: ' + expression); }
async function screenshot(name) { await ev(`document.querySelector('#toast').classList.remove('is-show');document.activeElement?.blur();Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))`); const r = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`reports/admin-workspace/${name}.png`, Buffer.from(r.data, 'base64')); }
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
try {
  let tab;
  for (let i = 0; i < 60; i++) { try { tab = (await (await fetch('http://localhost:9250/json/list')).json()).find(t => t.type === 'page'); } catch {} if (tab) break; await sleep(150); }
  assert.ok(tab); ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base + 'admin/' });
  await poll(`!!document.querySelector('#login:not([hidden])')`);
  await ev(`document.querySelector('#login-form [name=email]').value='links-test@example.com';document.querySelector('#login-form').requestSubmit()`);
  await poll(`!!document.querySelector('#shop-form[data-ready=true]')`);
  await ev(`document.querySelector('#tab-shop').click();document.fonts.ready`);
  for (const field of settings.fields) {
    assert.equal(await ev(`document.querySelector('#shop-form [name=${field.name}]').value`), defaults[field.key]);
    assert.equal(await ev(`document.querySelector('[data-current-link=${field.key}]').href`), defaults[field.key]);
  }
  assert.equal(await ev(`document.querySelector('#shop-form [name=phone]').value`), '0935 983 263');
  for (const width of [1440, 390]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
    assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'));
    await screenshot(`shop-links-${width}`);
    await ev(`document.querySelector('#shop-social-links').scrollIntoView()`);
    await screenshot(`social-links-${width}`);
    await ev(`window.scrollTo(0,0)`);
  }
  console.log('PASS six fields/preview links show the exact original website URLs; phone matches published number; desktop/mobile fit.');
  await ev(`document.querySelector('#shop-form [name=instagram_url]').value='javascript:alert(1)';document.querySelector('#shop-form').requestSubmit()`);
  await poll(`!document.querySelector('#shop-error').hidden`);
  assert.equal(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')||'null')?.shop?.public_links?.INSTAGRAM_URL||null`), null);
  const updated = { ...defaults, INSTAGRAM_URL: 'https://www.instagram.com/homelody.updated/', ZALO_URL: 'https://zalo.me/0905123456', GRABFOOD_URL: 'https://app.grab.com/s/test-updated', SHOPEEFOOD_URL: 'https://shopeefood.vn/u/test-updated' };
  await ev(`(()=>{const f=document.querySelector('#shop-form');f.instagram_url.value=${JSON.stringify(updated.INSTAGRAM_URL)};f.zalo_url.value=${JSON.stringify(updated.ZALO_URL)};f.grabfood_url.value=${JSON.stringify(updated.GRABFOOD_URL)};f.shopeefood_url.value=${JSON.stringify(updated.SHOPEEFOOD_URL)};f.requestSubmit()})()`);
  await poll(`document.querySelector('#shop-save-status').textContent.startsWith('Đã lưu.')`);
  assert.deepEqual(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.public_links`), updated);
  await ev(`document.querySelector('#shop-form').removeAttribute('data-ready')`);
  await call('Page.reload');
  await poll(`!!document.querySelector('#shop-form[data-ready=true]')`);
  assert.equal(await ev(`document.querySelector('#shop-form [name=instagram_url]').value`), updated.INSTAGRAM_URL);
  console.log('PASS invalid script URLs rejected without saving; valid six-link settings persist after reload.');
  await call('Page.navigate', { url: base });
  await poll(`document.documentElement?.dataset.menuSource==='demo' && !!window.HOMELODY_PUBLIC_LINKS`);
  for (const [key, value] of Object.entries(updated)) {
    assert.equal(await ev(`[...document.querySelectorAll('[data-link="${key}"]')].every(a=>a.getAttribute('href')===${JSON.stringify(value)})`), true, `All ${key} links update`);
  }
  assert.equal(await ev(`document.querySelector('[data-shop-instagram]').textContent`), '@homelody.updated');
  assert.ok(await ev(`[...document.querySelectorAll('[data-shop-zalo]')].every(a=>a.textContent==='0905 123 456')`));
  assert.equal(await ev(`document.querySelector('[data-shop-phone]').textContent`), '0935 983 263');
  assert.equal(await ev(`document.querySelectorAll('[data-social] a').length`), 6);
  console.log('PASS saved links propagate to all public icons, booking/delivery buttons, Instagram handle and Zalo number.');
  await call('Page.navigate', { url: base + 'admin/' });
  await poll(`!!document.querySelector('#shop-form[data-ready=true]')`);
  await ev(`document.querySelector('#shop-form [name=instagram_url]').value='';document.querySelector('#shop-form').requestSubmit()`);
  await poll(`document.querySelector('#shop-save-status').textContent.startsWith('Đã lưu.')`);
  assert.equal(await ev(`document.querySelector('#shop-form [name=instagram_url]').value`), defaults.INSTAGRAM_URL);
  assert.deepEqual(errors, []);
  console.log('PASS clearing a field restores its original website link; no runtime exceptions; production requests blocked.');
} finally { clearTimeout(timeout); ws?.close(); chrome.kill(); }
