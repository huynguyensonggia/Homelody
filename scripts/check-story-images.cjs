const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const base = process.env.STORY_URL || 'http://localhost:8000/';
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe', [
  '--headless', '--disable-gpu', '--remote-debugging-port=9237',
  `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-images-'))}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let ws, seq = 0; const pending = new Map(), errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
function call(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
async function ev(expression) {
  const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function poll(expression) {
  for (let i = 0; i < 160; i++) { if (await ev(expression)) return; await sleep(50); }
  throw Error('Timed out: ' + expression);
}
async function check(expression, label) {
  if (!(await ev(expression))) throw Error(label);
  console.log('PASS ' + label);
}
async function navigate(url, ready) {
  await call('Page.navigate', { url }); await poll(`!!document.documentElement && location.href===${JSON.stringify(url)} && (${ready})`);
}
(async () => {
  let tabs;
  for (let i = 0; i < 60; i++) { try { tabs = await (await fetch('http://localhost:9237/json')).json(); break; } catch { await sleep(100); } }
  ws = new WebSocket(tabs[0].webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params);
    const item = pending.get(msg.id);
    if (item) { pending.delete(msg.id); msg.error ? item.reject(msg.error) : item.resolve(msg.result); }
  });
  await call('Page.enable'); await call('Runtime.enable'); await call('DOM.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: require('./demo-config.cjs') });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate(base + 'admin/', `document.querySelector('#login') && !document.querySelector('#login').hidden`);
  await ev(`document.querySelector('#login-form [name=email]').value='test@example.com'; document.querySelector('#login-form').requestSubmit()`);
  await poll(`document.querySelectorAll('#story-image-list .story-image-card').length===5 && document.querySelectorAll('#space-image-list .story-image-card').length===3`);
  await ev(`document.querySelector('#tab-images').click()`);
  await check(`!document.querySelector('#panel-images').hidden && document.querySelector('#save-story').disabled`, 'image tab loads five slots with clean state');
  await poll(`[...document.querySelectorAll('.story-image-card img')].every(i=>i.complete&&i.naturalWidth>0)`);
  console.log('PASS all five default images load');
  await ev(`document.querySelector('[data-story-alt]').value='Draft'; document.querySelector('[data-story-alt]').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#story-cancel').click()`);
  await check(`document.querySelector('[data-story-alt]').value!=='Draft'&&document.querySelector('#save-story').disabled`, 'cancel restores saved descriptions');
  await ev(`(()=>{const input=document.querySelector('[data-story-file]'),dt=new DataTransfer();dt.items.add(new File(['bad'],'bad.txt',{type:'text/plain'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await poll(`!document.querySelector('#story-error').hidden`);
  await check(`document.querySelector('#save-story').disabled`, 'invalid file rejected without dirtying saved images');
  const doc = await call('DOM.getDocument');
  const input = await call('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '[data-story-file]' });
  await call('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path.resolve('public/cau-chuyen/story-vuon.png')] });
  await poll(`document.querySelector('.story-image-card img').src.startsWith('blob:')&&!document.querySelector('#save-story').disabled`);
  await ev(`document.querySelector('[data-story-alt]').value='Uploaded garden';document.querySelector('[data-story-alt]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#story-form').requestSubmit()`);
  await poll(`document.querySelector('#save-story').disabled && JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.story_images?.[0].image_alt==='Uploaded garden'`);
  await check(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.story_images[0].image_url.startsWith('data:image/webp;base64,')`, 'upload compressed and saved');
  await navigate(base + 'admin/', `document.querySelectorAll('#story-image-list .story-image-card').length===5`);
  await ev(`document.querySelector('#tab-images').click()`);
  await check(`document.querySelector('[data-story-alt]').value==='Uploaded garden'`, 'uploaded image survives reload');
  // Failed storage write must leave the saved state unchanged and allow retry.
  await ev(`window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='homelody:admin-demo')throw new Error('quota');return window.originalSetItem.call(this,k,v)};document.querySelector('[data-story-alt]').value='Should fail';document.querySelector('[data-story-alt]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#story-form').requestSubmit()`);
  await poll(`!document.querySelector('#story-error').hidden`);
  await check(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.story_images[0].image_alt==='Uploaded garden'&&!document.querySelector('#save-story').disabled`, 'failed save preserves persisted state and allows retry');
  await ev(`Storage.prototype.setItem=window.originalSetItem;document.querySelector('#story-cancel').click()`);
  const spaceInput = await call('DOM.querySelector', { nodeId: (await call('DOM.getDocument')).root.nodeId, selector: '#space-image-list [data-story-file]' });
  await call('DOM.setFileInputFiles', { nodeId: spaceInput.nodeId, files: [path.resolve('public/khong-gian/hero-coffee-banner-960.webp')] });
  await poll(`document.querySelector('#space-image-list img').src.startsWith('blob:')&&!document.querySelector('#save-space').disabled`);
  await ev(`document.querySelector('#space-image-list [data-story-alt]').value='Space uploaded';document.querySelector('#space-image-list [data-story-alt]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#space-form').requestSubmit()`);
  await poll(`document.querySelector('#save-space').disabled&&JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.space_images?.[0].image_alt==='Space uploaded'`);
  await check(`JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.story_images[0].image_alt==='Uploaded garden'`, 'space upload saves independently from story');
  await ev(`document.querySelector('#space-image-list [data-story-reset]').click();document.querySelector('#space-cancel').click()`);
  await check(`document.querySelector('#space-image-list [data-story-alt]').value==='Space uploaded'&&document.querySelector('#save-space').disabled`, 'space cancel restores uploaded image');
  fs.mkdirSync('reports', { recursive: true });
  await ev(`document.fonts.ready.then(()=>true)`);
  for (const width of [1440, 390]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await check(`document.documentElement.scrollWidth<=innerWidth`, 'no admin overflow at ' + width);
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/story-admin-${width}.png`, Buffer.from(shot.data, 'base64'));
    await ev(`document.querySelector('#space-form').scrollIntoView({block:'start'})`);
    const spaceShot = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/space-admin-${width}.png`, Buffer.from(spaceShot.data, 'base64'));
  }
  await navigate(base, `document.documentElement.dataset.menuSource==='demo'`);
  await ev(`document.querySelector('#cau-chuyen').scrollIntoView()`);
  await poll(`[...document.querySelectorAll('[data-story-stack] img')].every(i=>i.complete&&i.naturalWidth>0)`);
  await check(`document.querySelector('[data-story-stack] img').alt==='Uploaded garden'&&document.querySelector('[data-story-stack] img').src.startsWith('data:image/webp')`, 'landing uses uploaded image and description');
  await ev(`document.querySelector('#khong-gian').scrollIntoView()`);
  await poll(`[...document.querySelectorAll('#khong-gian .space-card img')].every(i=>i.complete&&i.naturalWidth>0)`);
  await check(`document.querySelector('#khong-gian .space-card img').src.startsWith('data:image/webp')&&document.querySelector('#khong-gian .space-card img').alt==='Space uploaded'`, 'landing uses uploaded space image');
  await call('Emulation.setDeviceMetricsOverride', { width: 1914, height: 1000, deviceScaleFactor: 1, mobile: false });
  console.log('Space desktop dimensions:', await ev(`JSON.stringify([...document.querySelectorAll('#khong-gian .space-card')].map(el=>({width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height)})))`));
  await ev(`(()=>{const data=JSON.parse(localStorage.getItem('homelody:admin-demo'));data.shop.story_images[0].image_alt='Synced';localStorage.setItem('homelody:admin-demo',JSON.stringify(data));dispatchEvent(new StorageEvent('storage',{key:'homelody:admin-demo'}))})()`);
  await check(`document.querySelector('[data-story-stack] img').alt==='Synced'`, 'landing updates on cross-tab storage event');
  await navigate(base + 'admin/', `document.querySelectorAll('#story-image-list .story-image-card').length===5`);
  await ev(`document.querySelector('#tab-images').click();document.querySelector('[data-story-reset]').click();document.querySelector('#story-form').requestSubmit()`);
  await poll(`document.querySelector('#save-story').disabled&&JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.story_images[0].image_url==='public/cau-chuyen/story-nhan-vien.png'`);
  console.log('PASS restore default image and save');
  await ev(`document.querySelector('#space-image-list [data-story-reset]').click();document.querySelector('#space-form').requestSubmit()`);
  await poll(`document.querySelector('#save-space').disabled&&JSON.parse(localStorage.getItem('homelody:admin-demo')).shop.space_images[0].image_url==='public/khong-gian/story-vuon.webp'`);
  console.log('PASS space restore default image and save');
  if (errors.length) throw Error(JSON.stringify(errors));
  console.log('PASS no browser runtime errors');
})().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => { clearTimeout(timeout); if (ws) ws.close(); chrome.kill(); });
