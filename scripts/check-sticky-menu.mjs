import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9253', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-sticky-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
const pending = new Map(), errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function poll(expression) { for (let i = 0; i < 100; i++) { if (await ev(expression)) return; await sleep(75); } throw Error('Timeout: ' + expression); }
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
try {
  let tab;
  for (let i = 0; i < 60; i++) { try { tab = (await (await fetch('http://localhost:9253/json/list')).json()).find(t => t.type === 'page'); } catch {} if (tab) break; await sleep(100); }
  assert.ok(tab); ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const width of [320, 390, 767, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: 'http://localhost:8000/' });
    await poll(`!!document.querySelector('.menu-filters')`);
    await ev('document.fonts.ready');
    assert.ok(await ev('document.documentElement.scrollWidth <= innerWidth'), 'No page overflow');
    const selected = await ev(`document.querySelector('.menu-tab[aria-selected="true"]').textContent`);
    assert.equal(selected, width < 768 ? 'Cà phê Việt' : 'Tất cả');
    if (width >= 768) { assert.equal(await ev(`getComputedStyle(document.querySelector('.menu-filters')).position`), 'static'); continue; }
    assert.ok(await ev(`getComputedStyle(document.querySelector('.menu-tab[aria-selected="true"]')).backgroundColor !== 'rgba(0, 0, 0, 0)'`), 'Selected tab has a filled background');
    await ev(`window.scrollTo({top:document.querySelector('.menu-filters').getBoundingClientRect().top+scrollY-64+160,behavior:'instant'})`);
    await sleep(100);
    assert.ok(await ev(`Math.abs(document.querySelector('.menu-filters').getBoundingClientRect().top-document.querySelector('.site-header').getBoundingClientRect().bottom)<2`), 'Sticky below header');
    await ev(`document.querySelector('.menu-tab[data-tab="0"]').click()`);
    await poll(`document.querySelectorAll('#menu-panel .menu-group').length>1`);
    await ev(`window.scrollBy({top:400,behavior:'instant'})`); await sleep(100);
    assert.ok(await ev(`Math.abs(document.querySelector('.menu-filters').getBoundingClientRect().top-parseFloat(getComputedStyle(document.querySelector('.menu-filters')).top))<2`), 'Sticky through all groups');
    await ev(`document.querySelector('.menu-tab[role="tab"]:last-of-type').focus();document.querySelector('.menu-tabs').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))`);
    await sleep(100);
    assert.ok(await ev(`(()=>{const t=document.querySelector('.menu-tab[aria-selected="true"]').getBoundingClientRect(),r=document.querySelector('.menu-tabs').getBoundingClientRect();return t.left>=r.left-1&&t.right<=r.right+1})()`), 'Selected last category visible');
    assert.equal(await ev(`document.querySelector('#menu-panel').getAttribute('aria-labelledby')`), await ev(`document.querySelector('.menu-tab[aria-selected="true"]').id`));
    await ev(`document.activeElement?.blur();document.querySelector('.menu-tab[data-tab="1"]').click();document.querySelector('#thuc-don').scrollIntoView({behavior:'instant'})`);
    await sleep(100);
    fs.mkdirSync('reports/sticky-menu', { recursive: true });
    const shot = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`reports/sticky-menu/mobile-${width}.png`, Buffer.from(shot.data, 'base64'));
    await ev(`document.querySelector('#thuc-don').nextElementSibling.scrollIntoView({behavior:'instant'})`); await sleep(100);
    assert.ok(await ev(`document.querySelector('.menu-filters').getBoundingClientRect().bottom<=document.querySelector('.site-header').getBoundingClientRect().bottom`), 'Released after menu');
    console.log('PASS mobile default, sticky bounds, horizontal selection, keyboard and overflow at ' + width);
  }
  assert.equal(errors.length, 0, 'No JavaScript exceptions');
  console.log('PASS desktop retains all groups and ordinary category tabs.');
} finally { clearTimeout(timeout); ws?.close(); chrome.kill(); }
