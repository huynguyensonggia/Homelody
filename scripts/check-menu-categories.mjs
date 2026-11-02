import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), scope = { window: {} };
vm.runInNewContext(fs.readFileSync('assets/js/config.js', 'utf8'), scope);
vm.runInNewContext(fs.readFileSync('assets/js/menu-categories.js', 'utf8'), scope);
const helper = scope.window.HOMELODY_CATEGORIES, originals = helper.resolve({});
assert.equal(helper.resolve({ menu_categories: [] }).length, 0, 'Explicitly empty list must not restore defaults');
assert.equal(helper.resolve({ menu_categories: [] }, [{ category: 'Legacy Group' }])[0].name, 'Legacy Group', 'Unknown existing products retain a group');
assert.ok(helper.validate(originals, { name: 'Ca phe Viet' }, null));
const renamed = [{ ...originals[0], name: 'Cà phê nhà', aliases: [...originals[0].aliases, originals[0].name], is_active: false }];
assert.equal(helper.canonical(renamed, originals[0].name), 'Cà phê nhà');
assert.equal(helper.visible(renamed, originals[0].name), false);
console.log('PASS alias-safe rename, duplicate-name checks, empty categories and unknown legacy groups.');

const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9251', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-categories-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const base = process.env.STORY_URL || 'http://localhost:8000/';
let ws, id = 0; const pending = new Map(), errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function poll(expression) { for (let i = 0; i < 150; i++) { try { if (await ev(expression)) return; } catch (e) { if (!/context.*destroyed|Cannot find context|navigated/i.test(e.message)) throw e; } await sleep(75); } throw Error('Timeout: ' + expression); }
async function navigate(url) { await call('Page.navigate', { url }); await poll(`location.href===${JSON.stringify(url)} && document.readyState==='complete'`); }
async function createCategory(name) {
  await ev(`document.querySelector('#add-category').click();document.querySelector('#category-form [name=name]').value=${JSON.stringify(name)};document.querySelector('#category-form').requestSubmit()`);
  await poll(`!document.querySelector('#category-editor').open`);
}
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
try {
  let tab;
  for (let i = 0; i < 60; i++) { try { tab = (await (await fetch('http://localhost:9251/json/list')).json()).find(t => t.type === 'page'); } catch {} if (tab) break; await sleep(150); }
  assert.ok(tab); ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });
  await navigate(base + 'admin/');
  await poll(`!!document.querySelector('#login:not([hidden])')`);
  await ev(`document.querySelector('#login-form [name=email]').value='categories-test@example.com';document.querySelector('#login-form').requestSubmit()`);
  await poll(`document.querySelectorAll('.drink').length>0 && !document.querySelector('#add-category').disabled`);
  const total = await ev(`Number(document.querySelector('#metric-total').textContent)`);
  await ev(`document.querySelector('#tab-categories').click()`);
  const initialCount = await ev(`document.querySelectorAll('.category-row').length`);
  assert.equal(initialCount, originals.length);
  assert.equal(await ev(`document.querySelector('[data-category-id="original-0"] [data-category-delete]').disabled`), true);
  await createCategory('Bánh mới');
  assert.equal(await ev(`document.querySelectorAll('.category-row').length`), initialCount + 1);
  const newId = await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.menu_categories.find(c=>c.name==='Bánh mới').id`);
  await ev(`document.querySelector('#add-category').click();document.querySelector('#category-form [name=name]').value='Ca phe Viet';document.querySelector('#category-form').requestSubmit()`);
  await poll(`!document.querySelector('#category-form-error').hidden`);
  await ev(`document.querySelector('#category-editor [data-category-close]').click()`);
  await ev(`document.querySelector('[data-category-id="original-0"] [data-category-edit]').click();document.querySelector('#category-form [name=name]').value='Cà phê đặc trưng';document.querySelector('#category-form [name=en]').value='Signature Coffee';document.querySelector('#category-form').requestSubmit()`);
  await poll(`!document.querySelector('#category-editor').open`);
  assert.equal(await ev(`Number(document.querySelector('#metric-total').textContent)`), total);
  assert.ok(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.menu_categories[0].aliases.includes('Cà phê Việt')`));
  await ev(`document.querySelector('#tab-menu').click();document.querySelector('#add-drink').click()`);
  assert.ok(await ev(`[...document.querySelector('#drink-form [name=category]').options].some(o=>o.value==='Bánh mới')`));
  await ev(`const f=document.querySelector('#drink-form');f.elements.namedItem('name').value='Bánh thử danh mục';f.category.value='Bánh mới';f.price.value='35k';f.requestSubmit()`);
  await poll(`!document.querySelector('#editor').open`);
  assert.equal(await ev(`document.querySelector('[data-category-id="${newId}"] [data-category-delete]').disabled`), true);
  await ev(`document.querySelector('#tab-categories').click();document.querySelector('[data-category-id="${newId}"] [data-category-move="-1"]').click()`);
  await poll(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.menu_categories.at(-2).id===${JSON.stringify(newId)}`);
  console.log('PASS add, duplicate rejection, rename retains products, new dropdown categories, live counts and reorder persistence.');
  await createCategory('Danh mục tạm');
  await ev(`const row=[...document.querySelectorAll('.category-row')].find(r=>r.querySelector('h3').textContent==='Danh mục tạm');row.querySelector('[data-category-delete]').click();document.querySelector('#confirm-delete-category').click()`);
  await poll(`!document.querySelector('#category-delete-dialog').open`);
  assert.equal(await ev(`Number(document.querySelector('#metric-total').textContent)`), total + 1);
  assert.equal(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.menu_categories.some(c=>c.name==='Danh mục tạm')`), false);
  await ev(`document.querySelector('[data-category-id="original-0"] [data-category-active]').click()`);
  await poll(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.menu_categories[0].is_active===false`);
  assert.ok(await ev(`Number(document.querySelector('#metric-hidden').textContent)>0`));
  const rawCoffee = await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).drinks.filter(d=>d.category==='Cà phê Việt').length`);
  await navigate(base);
  await poll(`document.documentElement?.dataset.menuSource==='demo' && !!window.HOMELODY_PUBLIC_LINKS`);
  assert.equal(await ev(`Number(document.querySelector('[data-stat-value=menuCount]').firstChild.textContent)`), total + 1 - rawCoffee);
  assert.ok(await ev(`![...document.querySelectorAll('.menu-group__vi')].some(e=>e.textContent==='Cà phê đặc trưng')`));
  console.log('PASS populated categories cannot be deleted; empty deletion retains products; hidden group disappears from public menu/count.');
  await navigate(base + 'admin/');
  await poll(`!!document.querySelector('#app:not([hidden])') && !document.querySelector('#add-category').disabled && Number(document.querySelector('#metric-total').textContent)>0`);
  await ev(`document.querySelector('#tab-categories').click();document.querySelector('[data-category-id="original-0"] [data-category-active]').click()`);
  await poll(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.menu_categories[0].is_active===true`);
  fs.mkdirSync('reports/admin-workspace', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await ev(`document.fonts.ready`);
    assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'), `Category layout fits ${width}px`);
    await ev(`document.querySelector('#toast').classList.remove('is-show');Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))`);
    const shot = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`reports/admin-workspace/categories-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  await ev(`const state=JSON.parse(localStorage.getItem('homelody:admin-demo'));state.shop.updated_at='2099-01-01T00:00:00.000Z';localStorage.setItem('homelody:admin-demo',JSON.stringify(state));document.querySelector('[data-category-id="original-0"] [data-category-edit]').click();document.querySelector('#category-form [name=en]').value='Conflict test';document.querySelector('#category-form').requestSubmit()`);
  await poll(`!document.querySelector('#category-form-error').hidden`);
  assert.ok(await ev(`document.querySelector('#category-form-error').textContent.includes('Tải lại')`));
  assert.equal(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.menu_categories[0].en`), 'Signature Coffee');
  await ev(`document.querySelector('#category-editor [data-category-close]').click()`);
  await navigate(base);
  await poll(`document.documentElement?.dataset.menuSource==='demo' && !!window.HOMELODY_PUBLIC_LINKS`);
  assert.equal(await ev(`Number(document.querySelector('[data-stat-value=menuCount]').firstChild.textContent)`), total + 1);
  assert.ok(await ev(`[...document.querySelectorAll('.menu-group__vi')].some(e=>e.textContent==='Cà phê đặc trưng')`));
  assert.deepEqual(errors, []);
  console.log('PASS show restores all products, public rename, 320–1440px layouts, stale-write protection and no runtime errors.');
} finally { clearTimeout(timeout); ws?.close(); chrome.kill(); }
