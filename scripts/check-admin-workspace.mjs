import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const base = process.env.STORY_URL || 'http://localhost:8000/';
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9249', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-workspace-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0; const pending = new Map(), errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function poll(expression) { for (let i = 0; i < 120; i++) { if (await ev(expression)) return; await sleep(75); } throw Error('Timeout: ' + expression); }
async function shot(name) { await ev(`document.querySelector('#toast').classList.remove('is-show');document.activeElement?.blur();Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))`); const r = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`reports/admin-workspace/${name}.png`, Buffer.from(r.data, 'base64')); }
async function setFilter(selector, value) { await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}))})()`); }
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
try {
  let tab;
  for (let i = 0; i < 60; i++) { try { tab = (await (await fetch('http://localhost:9249/json/list')).json()).find(t => t.type === 'page'); } catch {} if (tab) break; await sleep(150); }
  assert.ok(tab, 'Browser starts');
  ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable');
  await call('Network.enable');
  // Keep all application data in this disposable browser; block production requests outright.
  await call('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base + 'admin/' });
  await poll(`document.querySelector('#login')&&!document.querySelector('#login').hidden`);
  await ev('document.fonts.ready');
  fs.mkdirSync('reports/admin-workspace', { recursive: true });
  await shot('login-desktop');
  await ev(`document.querySelector('#toggle-password').click()`);
  assert.equal(await ev(`document.querySelector('#login-password').type`), 'text');
  await ev(`document.querySelector('#toggle-password').click();document.querySelector('#login-form [name=email]').value='ui-test@example.com';document.querySelector('#login-form').requestSubmit()`);
  await poll(`document.querySelectorAll('.drink').length>0`);
  const total = await ev(`document.querySelectorAll('.drink').length`);
  assert.equal(await ev(`Number(document.querySelector('#metric-total').textContent)`), total);
  assert.equal(await ev(`document.querySelector('.data-tools').open`), false);
  console.log('PASS login, password visibility, real catalogue counts, advanced controls collapsed.');
  const firstName = await ev(`document.querySelector('.drink__name').textContent`);
  const normalized = firstName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  await ev(`document.querySelector('#search').value=${JSON.stringify(normalized)};document.querySelector('#search').dispatchEvent(new Event('input'))`);
  assert.ok(await ev(`document.querySelectorAll('.drink').length>0`));
  await ev(`document.querySelector('#search').value='no-result-123456';document.querySelector('#search').dispatchEvent(new Event('input'))`);
  assert.equal(await ev(`!!document.querySelector('[data-clear-filters]')`), true);
  await ev(`document.querySelector('[data-clear-filters]').click()`);
  assert.equal(await ev(`document.querySelectorAll('.drink').length`), total);
  await ev(`document.querySelector('.drink [data-active]').click()`);
  await poll(`document.querySelector('#metric-hidden').textContent==='1'`);
  await ev(`document.querySelector('[data-status-filter=hidden]').click()`);
  assert.equal(await ev(`document.querySelectorAll('.drink').length`), 1);
  await ev(`document.querySelector('.drink [data-active]').click()`);
  await poll(`document.querySelector('#metric-hidden').textContent==='0'`);
  await ev(`document.querySelector('#clear-filters').click()`);
  await setFilter('#filter-category', await ev(`document.querySelector('#filter-category option:nth-child(2)').value`));
  assert.ok(await ev(`document.querySelectorAll('.group').length===1`));
  await ev(`document.querySelector('#clear-filters').click()`);
  console.log('PASS search without diacritics, combined filters, empty-state reset, hide/show updates statistics.');
  await ev(`document.querySelector('#add-drink').click();const form=document.querySelector('#drink-form');form.elements.namedItem('name').value='Món kiểm tra giao diện';form.elements.namedItem('price').value='45k';form.requestSubmit()`);
  await poll(`!document.querySelector('#editor').open`);
  assert.equal(await ev(`Number(document.querySelector('#metric-total').textContent)`), total + 1);
  await ev(`document.querySelector('#refresh-drinks').click()`);
  await poll(`document.querySelector('#drink-list').getAttribute('aria-busy')==='false'`);
  assert.equal(await ev(`Number(document.querySelector('#metric-total').textContent)`), total + 1);
  await ev(`document.querySelector('#open-import').click()`);
  assert.equal(await ev(`document.querySelector('#import-editor').open`), true);
  await ev(`document.querySelector('[data-import-close]').click()`);
  console.log('PASS add item persists in demo storage, refresh retains data, import dialog opens.');
  await ev(`document.querySelector('#add-drink').click();document.querySelector('#drink-form [name=name]').value='Chưa lưu';document.querySelector('#editor [data-close]').click()`);
  assert.equal(await ev(`document.querySelector('#discard-editor').open`), true);
  await ev(`document.querySelector('#keep-editing').click()`);
  assert.equal(await ev(`document.querySelector('#editor').open && document.querySelector('#drink-form [name=name]').value==='Chưa lưu'`), true);
  await ev(`document.querySelector('#editor [data-close]').click();document.querySelector('#discard-changes').click()`);
  assert.equal(await ev(`document.querySelector('#editor').open`), false);
  assert.equal(await ev(`Number(document.querySelector('#metric-total').textContent)`), total + 1);
  console.log('PASS unsaved editor changes require an explicit discard and are preserved when continuing.');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await sleep(100);
    assert.ok(await ev('document.documentElement.scrollWidth <= innerWidth'), `Menu fits ${width}px`);
    await shot(`menu-${width}`);
    if (width === 390) { await ev(`document.querySelector('.catalog').scrollIntoView()`); await shot('catalog-mobile'); }
    await ev(`document.querySelector('.drink [data-edit]').click()`);
    assert.ok(await ev(`(()=>{const r=document.querySelector('#editor').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`), `Editor fits ${width}px`);
    if (width === 390) await shot('editor-mobile');
    await ev(`document.querySelector('#editor [data-close]').click()`);
    await ev(`document.querySelector('#tab-images').click()`);
    assert.ok(await ev('document.documentElement.scrollWidth <= innerWidth'), `Images fit ${width}px`);
    if ([1440, 390].includes(width)) await shot(`images-${width}`);
    await ev(`document.querySelector('#tab-shop').click()`);
    assert.ok(await ev('document.documentElement.scrollWidth <= innerWidth'), `Shop fits ${width}px`);
    if ([1440, 390].includes(width)) await shot(`shop-${width}`);
    await ev(`document.querySelector('#tab-menu').click()`);
  }
  console.log('PASS responsive menu, image manager, shop settings and editor at 320, 390, 768, 1024 and 1440px.');
  await ev(`document.querySelector('#logout').click()`);
  await poll(`document.querySelector('#login')&&!document.querySelector('#login').hidden`);
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await sleep(100); await shot('login-mobile');
  assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'));
  assert.deepEqual(errors, [], 'No JavaScript runtime exceptions');
  console.log('PASS mobile login, logout and no runtime exceptions; production database requests blocked throughout.');
} finally { clearTimeout(timeout); ws?.close(); chrome.kill(); }
