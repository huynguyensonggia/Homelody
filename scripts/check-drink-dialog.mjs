import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9257', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-sticky-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
const pending = new Map(), errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function poll(expression) { for (let i = 0; i < 100; i++) { if (await ev(expression)) return; await sleep(75); } throw Error('Timeout: ' + expression); }
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
try {
  let tab;
  for (let i = 0; i < 60; i++) { try { tab = (await (await fetch('http://localhost:9257/json/list')).json()).find(t => t.type === 'page'); } catch {} if (tab) break; await sleep(100); }
  assert.ok(tab); ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });

  const seed = { drinks: [
    { id: 'peach', name: 'Trà đào cam sả', category: 'Trà', price: 45000, description: 'Trà thanh nhẹ cùng đào, cam và sả. '.repeat(18), note: 'Thơm đào · Chua dịu · Hương sả', ingredients: ['Trà ủ mộc', 'Đào giòn', 'Cam tươi', 'Sả tươi', 'Đường', 'Đá viên'], image_url: 'assets/images/drink-iced-latte.webp', image_alt: 'Ảnh kiểm thử', is_active: true, is_featured: true },
    { id: 'text', name: 'Món chưa có ảnh', category: 'Trà', price: 25000, description: 'Thông tin món không có ảnh.', note: '', ingredients: ['Đường', 'Đá viên'], image_url: '', is_active: true, is_featured: false }
  ] };
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('homelody:admin-demo', ${JSON.stringify(JSON.stringify(seed))})` });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  fs.mkdirSync('reports/drink-dialog', { recursive: true });
  for (const [width, height] of [[320, 640], [375, 812], [390, 844], [768, 1024], [1440, 1000]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: `http://localhost:8000/?dialog=${width}` });
    await poll(`!!document.querySelector('#do-uong[data-featured-ready]')`);
    await ev(`document.querySelector('button[data-open-drink]').click();document.fonts.ready`);
    await poll(`document.querySelector('#drink-dialog').open`);
    assert.deepEqual(await ev(`Array.from(document.querySelectorAll('.drink-dialog__ingredients li'),e=>e.textContent)`), ['Trà ủ mộc', 'Đào giòn', 'Cam tươi', 'Sả tươi']);
    assert.equal(await ev(`document.querySelector('[data-dialog-field=note]').textContent`), 'Thanh mát · Chua dịu · Hương thảo mộc');
    assert.equal(await ev(`document.querySelector('.drink-dialog__price>span').textContent`), 'Giá tại quán');
    assert.ok(await ev(`(()=>{const buttons=Array.from(document.querySelectorAll('.drink-dialog__actions .btn'));const a=getComputedStyle(buttons[0]),b=getComputedStyle(buttons[1]);return a.backgroundColor===b.backgroundColor&&a.border===b.border&&Math.abs(buttons[0].offsetWidth-buttons[1].offsetWidth)<=1&&buttons.every(e=>e.href.startsWith('https://'))})()`), 'Equal CTA treatment and existing links');
    if (width < 768) {
      const before = await ev(`document.querySelector('.drink-dialog__order').getBoundingClientRect().top`);
      await ev(`document.querySelector('.drink-dialog__body').scrollTop=10000`);
      const after = await ev(`document.querySelector('.drink-dialog__order').getBoundingClientRect().top`);
      assert.ok(Math.abs(before-after)<1, 'CTA remains fixed while details scroll');
      assert.ok(await ev(`(()=>{const body=document.querySelector('.drink-dialog__body'),price=document.querySelector('.drink-dialog__price').getBoundingClientRect(),order=document.querySelector('.drink-dialog__order').getBoundingClientRect();return body.scrollTop>0&&price.bottom<=order.top+1&&order.bottom<=innerHeight+1&&order.left>=0&&order.right<=innerWidth})()`), 'Price and CTA accessible on narrow screens');
    }
    assert.ok(await ev(`document.querySelector('.drink-dialog__panel').scrollWidth<=document.querySelector('.drink-dialog__panel').clientWidth`), 'No popup horizontal overflow');
    await ev(`document.querySelectorAll('.drink-dialog__actions a')[1].focus();document.querySelector('#drink-dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}))`);
    assert.equal(await ev(`document.activeElement.hasAttribute('data-close-dialog')`), true, 'Keyboard focus wraps within popup');
    await ev(`document.activeElement.blur()`);
    const shot = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`reports/drink-dialog/popup-${width}.png`, Buffer.from(shot.data, 'base64'));
    await ev(`document.querySelector('[data-close-dialog]').click()`);
    await poll(`!document.querySelector('#drink-dialog').open`);
    await ev(`Array.from(document.querySelectorAll('[data-menu-list] .menu-item__btn')).find(b=>b.textContent.includes('Món chưa có ảnh')).click()`);
    await poll(`document.querySelector('#drink-dialog').open`);
    assert.equal(await ev(`document.querySelector('.drink-dialog__ingredients').hidden`), true, 'Empty meaningful ingredient group hidden');
    assert.equal(await ev(`document.querySelector('#drink-dialog').classList.contains('is-text-only')`), true);
    assert.ok(await ev(`document.querySelector('.drink-dialog__order').getBoundingClientRect().width>0`));
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await poll(`!document.querySelector('#drink-dialog').open`);
    if (width === 390) {
      await ev(`document.querySelector('button[data-open-drink]').click()`);
      await poll(`document.querySelector('#drink-dialog').open`);
      const handle = await ev(`(()=>{const r=document.querySelector('.drink-dialog__handle').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+14}})()`);
      await sleep(60);
      assert.equal(await ev(`document.elementFromPoint(${handle.x},${handle.y}).className`), 'drink-dialog__handle', 'Drag handle receives pointer input');
      await call('Emulation.setTouchEmulationEnabled', { enabled: true });
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: handle.x, y: handle.y, id: 0 }] });
      await sleep(40);
      await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: handle.x, y: handle.y + 140, id: 0 }] });
      await sleep(40);
      const translation = await ev(`document.querySelector('.drink-dialog__panel').style.transform`);
      assert.ok(/translateY\(/.test(translation) && parseFloat(translation.slice(11)) > 110, 'Drag moves the sheet: ' + translation);
      await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await poll(`!document.querySelector('#drink-dialog').open`);
      await call('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    console.log('PASS balanced CTAs, ingredient display, mobile scroll/footer, text-only and keyboard at ' + width);
  }
  assert.equal(errors.length, 0, 'No JavaScript exceptions');
} finally { clearTimeout(timeout); ws?.close(); chrome.kill(); }

