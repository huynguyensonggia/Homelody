import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { HEADERS, buildImportPreview, readDrinkSheet } from '../admin/drink-import.mjs';
const require = createRequire(import.meta.url), XLSX = require('../admin/vendor/xlsx-0.20.3.min.js');
const cats = [{ name: 'Cà phê Việt', aliases: ['Coffee'] }, { name: 'Trà' }];
const valid = ['Import Latte', 'Coffee', '45k', 'Mô tả', '', 'Cà phê, Sữa', '', '', 'Có', 'Không'];
let preview = buildImportPreview([HEADERS, valid, valid, ['Bad', 'Trà', '-45000'], ['Free', 'Trà', 0]], [], cats);
assert.deepEqual(preview.map((r) => r.status), ['ready', 'duplicate', 'error', 'ready']);
assert.equal(preview[0].row.price, 45000); assert.equal(preview[0].row.category, 'Cà phê Việt');
assert.equal(preview[0].row.is_active, true); assert.equal(preview[0].row.is_featured, false);
assert.deepEqual(preview[0].row.ingredients, ['Cà phê', 'Sữa']);
assert.equal(buildImportPreview([HEADERS, valid], [{ name: 'IMPORT LATTE', category: 'Cà phê Việt' }], cats)[0].status, 'duplicate');
for (const badPrice of ['', 'abc', '45abc', -1, '1.2', 2147483648]) assert.equal(buildImportPreview([HEADERS, ['Bad', 'Trà', badPrice]], [], cats)[0].status, 'error');
for (const goodPrice of [45000, '45.000', '45,000', '45k']) assert.equal(buildImportPreview([HEADERS, ['Good', 'Trà', goodPrice]], [], cats)[0].row.price, 45000);
assert.throws(() => buildImportPreview([['Tên món'], valid], [], cats), /Thiếu cột/);
assert.throws(() => buildImportPreview([HEADERS, ...Array(501).fill(valid)], [], cats), /500/);
assert.equal(buildImportPreview([HEADERS, ['Bad', 'Unknown', 1]], [], cats)[0].status, 'error');
assert.equal(buildImportPreview([HEADERS, ['Bad', 'Trà', 1, '', '', '', 'javascript:alert(1)']], [], cats)[0].status, 'error');
assert.equal(buildImportPreview([HEADERS, ['Bad', 'Trà', 1, '', '', '', '', '', 'maybe']], [], cats)[0].status, 'error');
const templatePath = 'public/templates/homelody-import-do-uong.xlsx';
const template = XLSX.read(fs.readFileSync(templatePath));
assert.deepEqual(template.SheetNames, ['Do uong', 'Huong dan']);
assert.deepEqual(readDrinkSheet(XLSX, fs.readFileSync(templatePath))[0], HEADERS);
const formulaBook = XLSX.utils.book_new(), formulaSheet = XLSX.utils.aoa_to_sheet([HEADERS, valid]);
formulaSheet.C2 = { t: 'n', v: 45000, f: '45000' }; XLSX.utils.book_append_sheet(formulaBook, formulaSheet, 'Do uong');
assert.equal(buildImportPreview(readDrinkSheet(XLSX, XLSX.write(formulaBook, { type: 'buffer', bookType: 'xlsx' })), [], cats)[0].status, 'error');
const csv = '\uFEFF' + HEADERS.join(',') + '\r\n"Tên, có dấu",Trà,45000';
assert.equal(readDrinkSheet(XLSX, Buffer.from(csv))[1][0], 'Tên, có dấu');
console.log('PASS parser: required headers, prices, flags, groups, duplicates, CSV quoting, formula rejection and actual template');

// Real browser test in an isolated profile, never changes the user's localStorage.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-import-'));
const fixture = path.join(tmp, 'drinks.xlsx');
XLSX.utils.sheet_add_aoa(template.Sheets['Do uong'], [valid, ['Import Tea', 'Trà', 55000, '', '', '', '', '', 'Không', 'Có'], valid, ['Bad', 'Trà', 'bad']], { origin: 'A2' });
fs.writeFileSync(fixture, XLSX.write(template, { type: 'buffer', bookType: 'xlsx' }));
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9238', `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const base = process.env.STORY_URL || 'http://localhost:8000/';
let ws, id = 0; const pending = new Map(), errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
async function ev(expression) {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
}
async function poll(expression) { for (let i = 0; i < 150; i++) { if (await ev(expression)) return; await sleep(50); } throw Error('Timeout: ' + expression); }
try {
  let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch('http://localhost:9238/json')).json(); break; } catch { await sleep(100); } }
  ws = new WebSocket(tabs[0].webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable'); await call('DOM.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });
  await call('Page.navigate', { url: base + 'admin/' });
  await poll(`document.querySelector('#login')&&!document.querySelector('#login').hidden`);
  await ev(`document.querySelector('#login-form [name=email]').value='test@example.com';document.querySelector('#login-form').requestSubmit()`);
  await poll(`document.querySelectorAll('.drink').length>0`);
  await ev(`window.initialCount=document.querySelectorAll('.drink').length;document.querySelector('#open-import').click()`);
  const input = await call('DOM.querySelector', { nodeId: (await call('DOM.getDocument')).root.nodeId, selector: '#import-file' });
  await call('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [fixture] });
  await poll(`document.querySelectorAll('#import-preview tbody tr').length===4`);
  assert.equal(await ev(`document.querySelectorAll('#import-preview tr[data-status=ready]').length`), 2);
  assert.equal(await ev(`document.querySelectorAll('#import-preview tr[data-status=error]').length`), 1);
  assert.equal(await ev(`document.querySelectorAll('.drink').length===window.initialCount`), true);
  console.log('PASS real XLSX preview leaves menu unchanged and identifies invalid/duplicate rows');
  await ev(`window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='homelody:admin-demo')throw Error('quota');return window.originalSetItem.call(this,k,v)};document.querySelector('#import-form').requestSubmit()`);
  await poll(`!document.querySelector('#import-error').hidden`);
  assert.equal(await ev(`document.querySelectorAll('.drink').length===window.initialCount&&!document.querySelector('#confirm-import').disabled`), true);
  await ev(`Storage.prototype.setItem=window.originalSetItem;document.querySelector('#import-form').requestSubmit()`);
  await poll(`document.querySelector('#import-summary').textContent.startsWith('Đã nhập 2 món')`);
  assert.equal(await ev(`document.querySelectorAll('.drink').length===window.initialCount+2`), true);
  assert.equal(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).drinks.find(d=>d.name==='Import Tea').is_active`), false);
  console.log('PASS failed write can retry; valid rows saved atomically with active/featured flags');
  await ev(`document.querySelector('[data-import-close]').click();document.querySelector('#open-import').click()`);
  await call('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [fixture] });
  await poll(`document.querySelectorAll('#import-preview tbody tr').length===4`);
  assert.equal(await ev(`document.querySelector('#confirm-import').disabled&&document.querySelectorAll('#import-preview tr[data-status=duplicate]').length===3`), true);
  console.log('PASS re-import skips saved rows without duplicates');
  fs.mkdirSync('reports', { recursive: true });
  for (const width of [1440, 390]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: false });
    await sleep(100);
    assert.equal(await ev(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#import-editor').getBoundingClientRect().right<=innerWidth`), true);
    const shot = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`reports/drink-import-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  await ev(`document.querySelector('[data-import-close]').click()`);
  await call('Page.navigate', { url: base });
  await poll(`document.documentElement&&document.documentElement.dataset.menuSource==='demo'`);
  assert.equal(await ev(`document.querySelector('[data-menu-list]').textContent.includes('Import Latte')&&!document.querySelector('[data-menu-list]').textContent.includes('Import Tea')`), true);
  assert.deepEqual(errors, []);
  console.log('PASS landing displays imported active drink, hides inactive drink; desktop/mobile fit and no runtime errors');
} finally { clearTimeout(timeout); if (ws) ws.close(); chrome.kill(); }
