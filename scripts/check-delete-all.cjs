const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.STORY_URL || 'http://localhost:8000/';
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9239', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-delete-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(), errors = [];
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function poll(expression) { for (let i = 0; i < 120; i++) { try { if (await ev(expression)) return; } catch (ex) { if (!/navigated|context.*destroyed|Cannot find context/i.test(ex.message || '')) throw ex; } await sleep(50); } throw Error('Timeout: ' + expression); }
(async () => {
  let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch('http://localhost:9239/json')).json(); break; } catch { await sleep(100); } }
  ws = new WebSocket(tabs[0].webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });
  await call('Page.navigate', { url: base + 'admin/' });
  await poll(`document.querySelector('#login')&&!document.querySelector('#login').hidden`);
  // Seed only disposable records in this isolated browser profile.
  await ev(`localStorage.setItem('homelody:admin-demo',JSON.stringify({drinks:[{id:'a',name:'A',price:30000,category:'Trà',is_active:true,sort_order:10},{id:'b',name:'B',price:40000,category:'Trà',is_active:false,sort_order:20}],shop:{address:'Keep this',story_images:[{image_url:'keep.png'}],space_images:[{image_url:'space.png'}]}}));sessionStorage.setItem('homelody:admin-demo-session','test@example.com')`);
  await call('Page.reload'); await poll(`document.querySelectorAll('.drink').length===2`);
  await ev(`document.querySelector('#search').value='No match';document.querySelector('#search').dispatchEvent(new Event('input'));document.querySelector('#delete-all-drinks').click()`);
  await poll(`document.querySelector('#delete-all-dialog').open`);
  assert.equal(await ev(`document.querySelector('#delete-all-message').textContent.includes('2 sản phẩm')&&document.querySelector('#confirm-delete-all').disabled`), true);
  await ev(`document.querySelector('#delete-all-form').dispatchEvent(new Event('submit',{cancelable:true}));document.querySelector('[data-delete-all-close]').click()`);
  assert.equal(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).drinks.length`), 2);
  console.log('PASS counts hidden and filtered-out products, blocks unconfirmed deletion and allows cancel');
  await ev(`document.querySelector('#delete-all-drinks').click()`); await poll(`document.querySelector('#delete-all-dialog').open`);
  for (const width of [1440, 390]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(350);
    assert.equal(await ev(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#delete-all-dialog').getBoundingClientRect().right<=innerWidth`), true);
    const shot = await call('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync('reports', { recursive: true }); fs.writeFileSync(`reports/delete-all-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  await ev(`document.querySelector('#delete-all-confirmation').value='XOA';document.querySelector('#delete-all-confirmation').dispatchEvent(new Event('input'));window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='homelody:admin-demo')throw Error('quota');return window.originalSetItem.call(this,k,v)};document.querySelector('#delete-all-form').requestSubmit()`);
  await poll(`!document.querySelector('#delete-all-error').hidden`);
  assert.equal(await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).drinks.length===2&&!document.querySelector('#confirm-delete-all').disabled`), true);
  console.log('PASS failed storage write leaves products intact and enables retry');
  await ev(`Storage.prototype.setItem=window.originalSetItem;localStorage.setItem('homelody:menu:v1','stale');document.querySelector('#delete-all-form').requestSubmit()`);
  await poll(`!document.querySelector('#delete-all-dialog').open`);
  assert.equal(await ev(`(()=>{const s=JSON.parse(localStorage.getItem('homelody:admin-demo'));return s.drinks.length===0&&s.shop.address==='Keep this'&&s.shop.story_images[0].image_url==='keep.png'&&s.shop.space_images[0].image_url==='space.png'&&!localStorage.getItem('homelody:menu:v1')&&document.querySelector('#delete-all-drinks').disabled&&document.querySelectorAll('.drink').length===0})()`), true);
  await ev(`window.beforeDeleteReload=true`);
  await call('Page.reload'); await poll(`!window.beforeDeleteReload&&document.querySelector('#app')&&!document.querySelector('#app').hidden&&document.querySelector('#drink-list .empty')`);
  assert.equal(await ev(`document.querySelectorAll('.drink').length===0&&document.querySelector('#delete-all-drinks').disabled`), true);
  console.log('PASS confirmed deletion persists after reload, clears cache and preserves shop/images');
  await ev(`document.querySelector('#add-drink').click();const f=document.querySelector('#drink-form');f.elements.name.value='New product';f.elements.price.value='45000';f.requestSubmit()`);
  await poll(`document.querySelectorAll('.drink').length===1`);
  assert.equal(await ev(`!document.querySelector('#delete-all-drinks').disabled`), true);
  console.log('PASS new products can be added after deletion');
  await call('Page.navigate', { url: base }); await poll(`document.documentElement&&document.documentElement.dataset.menuSource==='demo'`);
  assert.equal(await ev(`document.querySelector('[data-menu-list]').textContent.includes('New product')`), true);
  assert.deepEqual(errors, []); console.log('PASS storefront reads current menu, no runtime errors');
})().catch((ex) => { console.error(ex); process.exitCode = 1; }).finally(() => { clearTimeout(timeout); if (ws) ws.close(); chrome.kill(); });
