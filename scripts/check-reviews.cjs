const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const out = path.resolve('reports');
fs.mkdirSync(out, { recursive: true });
const base = process.env.REVIEWS_URL || 'http://localhost:3000/';
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe', [
  '--headless', '--disable-gpu', '--remote-debugging-port=9231',
  `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-reviews-'))}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let ws, sequence = 0;
const pending = new Map(), errors = [], requests = [], results = [], measurements = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => { chrome.kill(); process.exit(2); }, 110000);
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
function check(passed, label, detail) {
  results.push({ label, passed: !!passed, ...(detail === undefined ? {} : { detail }) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`);
}
async function metrics(width) {
  await call('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 1300 : 1250, deviceScaleFactor: 1, mobile: false });
  await sleep(100);
}
async function load() {
  await call('Page.navigate', { url: base });
  for (let i = 0; i < 100; i++) {
    if (await ev(`document.readyState==='complete'&&document.querySelectorAll('.reviews__column').length>0`)) break;
    await sleep(100);
  }
  await ev('document.fonts.ready.then(()=>true)'); await sleep(150);
}
async function anchor() {
  await ev(`scrollTo({top:document.querySelector('#danh-gia').getBoundingClientRect().top+scrollY-120,behavior:'instant'})`);
  await sleep(800);
}
async function shot(width) {
  const result = await call('Page.captureScreenshot', { format: 'png' });
  const file = path.join(out, 'reviews-columns-' + width + '.png');
  fs.writeFileSync(file, Buffer.from(result.data, 'base64')); console.log('SCREENSHOT ' + file);
}
async function key(key, code) {
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
  await sleep(150);
}
const original = `.reviews__copy:not(.reviews__copy--duplicate)`;
const state = `(()=>{const s=document.querySelector('[data-reviews]'),w=document.querySelector('[data-reviews-wall]'),m=[...w.querySelectorAll('.reviews__marquee')],o=[...w.querySelectorAll('${original} .reviews__card')];return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,columns:m.length,count:o.length,indices:o.map(c=>+c.dataset.reviewIndex).sort((a,b)=>a-b),static:s.classList.contains('reviews--static'),reading:s.classList.contains('is-reading'),visible:s.classList.contains('is-visible'),mask:getComputedStyle(w).maskImage,wallHeight:w.clientHeight,hasPauseControl:!!document.querySelector('[data-reviews-pause]'),y:m.map(e=>getComputedStyle(e).transform==='none'?0:new DOMMatrixReadOnly(getComputedStyle(e).transform).m42),play:m.map(e=>getComputedStyle(e).animationPlayState),groups:m.map(e=>[...e.children].map(g=>g.offsetHeight)),clones:[...w.querySelectorAll('.reviews__copy--duplicate')].map(g=>({hidden:g.getAttribute('aria-hidden'),tabbable:[...g.querySelectorAll('a,button')].filter(e=>e.tabIndex>=0).length,display:getComputedStyle(g).display})),excerpts:o.map(c=>{const t=c.querySelector('.reviews__text'),b=c.querySelector('.reviews__read-more');return {overflow:t.scrollHeight>t.clientHeight+1,hidden:b.hidden}})}})()`;
async function mouse(x = 0, y = 0) { await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); }
async function openReview(clone = false) {
  return ev(`(()=>{const b=[...document.querySelectorAll('${clone ? '.reviews__copy--duplicate' : original} .reviews__read-more')].find(b=>!b.hidden);window.__reviewOpener=b;window.__expectedReview=HOMELODY_CONFIG.customerReviews[Number(b.closest('[data-review-index]').dataset.reviewIndex)];${clone ? '' : 'b.focus({preventScroll:true});'}b.click();return !!b})()`);
}
(async () => {
  let tabs;
  for (let i = 0; i < 50; i++) { try { tabs = await (await fetch('http://localhost:9231/json')).json(); break; } catch { await sleep(200); } }
  ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data), waiting = pending.get(message.id);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) requests.push({ url: message.params.response.url, status: message.params.response.status });
    if (waiting) { pending.delete(message.id); message.error ? waiting.reject(message.error) : waiting.resolve(message.result); }
  });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.setCacheDisabled', { cacheDisabled: true });
  // Capture final real data before exercising modes that change section height or focus.
  for (const width of [1440, 768, 390]) {
    await metrics(width); await load(); await mouse(); await anchor(); await shot(width);
  }
  for (const width of [1440, 768, 390]) {
    await metrics(width); await load(); await mouse(); await anchor();
    const initial = await ev(state); measurements.push(initial);
    check(initial.columns === (width >= 1024 ? 3 : width >= 768 ? 2 : 1), 'responsive column count ' + width, initial.columns);
    check(initial.count === 12 && initial.indices.every((index, i) => index === i), 'every real review remains reachable ' + width);
    check(initial.pageWidth <= width, 'no horizontal page overflow ' + width);
    check(!initial.static && initial.visible && initial.play.every(p => p === 'running'), 'visible columns animate ' + width);
    check(initial.groups.every(([a, b]) => a === b), 'loop copies have matching height ' + width, initial.groups);
    check(initial.clones.every(c => c.hidden === 'true' && c.tabbable === 0), 'clones hidden from accessibility and Tab ' + width);
    check(initial.excerpts.every(e => e.overflow !== e.hidden), 'read more only for clipped reviews ' + width);
    await sleep(250); const moved = await ev(state);
    check(moved.y.every((y, i) => y < initial.y[i] - 2), 'all columns move upward ' + width);
    check(!initial.hasPauseControl, 'pause button removed ' + width);
    const hover = await ev(`(()=>{const r=document.querySelector('[data-reviews-wall]').getBoundingClientRect();return {x:r.left+r.width/2,y:Math.max(100,r.top+80)}})()`);
    await mouse(hover.x, hover.y); await sleep(50); const hovered = await ev(state); await sleep(200); const held = await ev(state);
    check(held.play.every(p => p === 'paused') && held.y.every((y, i) => Math.abs(y - hovered.y[i]) < 1), 'hover holds all columns ' + width);
    await mouse();
    await openReview(false);
    check(await ev(`document.querySelector('.review-dialog').open&&document.querySelector('.review-dialog__text').textContent===window.__expectedReview.text&&document.documentElement.classList.contains('is-review-open')`), 'original review opens matching modal ' + width);
    await key('Escape', 27);
    check(await ev(`!document.querySelector('.review-dialog').open&&document.activeElement===window.__reviewOpener&&!document.documentElement.classList.contains('is-review-open')`), 'Escape restores original opener ' + width);
    // A keyboard reader sees all originals, with no clipping or visual-only copies.
    await key('Tab', 9);
    await ev(`document.querySelector('${original} a.reviews__source').focus({preventScroll:true})`);
    const reading = await ev(state);
    check(reading.reading && reading.mask === 'none' && reading.clones.every(c => c.display === 'none'), 'keyboard focus enables stable unclipped reading ' + width);
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await sleep(100);
    const reduced = await ev(state);
    check(reduced.static && reduced.count === 12 && reduced.mask === 'none' && !reduced.hasPauseControl && reduced.clones.every(c => c.display === 'none'), 'reduced motion keeps complete static list ' + width);
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  }
  await metrics(1440); await load(); await mouse(); await anchor();
  await openReview(true);
  check(await ev(`document.querySelector('.review-dialog').open&&document.querySelector('.review-dialog__text').textContent===window.__expectedReview.text`), 'visual duplicate opens matching review');
  await key('Escape', 27);
  check(await ev(`document.activeElement===document.querySelector('.reviews__link')`), 'duplicate modal returns focus to Maps link');
  await openReview(false); await metrics(390);
  check((await ev(state)).columns === 3, 'breakpoint rebuild deferred while modal open');
  await key('Escape', 27);
  const resized = await ev(state);
  check(resized.columns === 1 && resized.count === 12, 'closing modal applies pending responsive layout');
  check(await ev(`!!document.activeElement.closest('[data-reviews]')&&document.activeElement.isConnected`), 'focus remains connected after modal resize');
  // Seek CSS animation to its loop boundary; copies must align exactly at the wrap.
  await metrics(1440); await load(); await mouse(); await anchor();
  const wrap = await ev(`(()=>{return [...document.querySelectorAll('.reviews__marquee')].map(m=>{const a=m.getAnimations()[0],duration=a.effect.getTiming().duration,g=m.firstElementChild;a.pause();a.currentTime=duration-.001;const before=new DOMMatrixReadOnly(getComputedStyle(m).transform).m42;a.currentTime=0;const after=new DOMMatrixReadOnly(getComputedStyle(m).transform).m42;return {before,after,height:g.offsetHeight,delta:Math.abs(Math.abs(before-after)-g.getBoundingClientRect().height)}})})()`);
  check(wrap.every(w => w.delta < .1), 'loop wrap advances exactly one copy height', wrap);
  for (const count of [1, 2]) {
    const injection = await call('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window,'HOMELODY_CONFIG',{configurable:true,get(){return this.__reviewsConfig},set(value){value.customerReviews=value.customerReviews.slice(0,${count});this.__reviewsConfig=value}})` });
    for (const width of [1440, 390]) {
      await metrics(width); await load(); await anchor(); const edge = await ev(state);
      check(edge.count === count && edge.static && !edge.hasPauseControl, 'short dataset uses complete static list ' + count + ' at ' + width, { count: edge.count, static: edge.static });
      check(edge.pageWidth <= width && edge.clones.every(c => c.display === 'none'), 'short dataset has no overflow or visible clones ' + count + ' at ' + width);
    }
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  }
  check(errors.length === 0, 'no JavaScript exceptions', errors);
  check(requests.filter(request => request.url.startsWith(base)).length === 0, 'no local asset HTTP errors', requests);
})().catch(error => { console.error(error); results.push({ label: 'runner completed', passed: false, error: String(error) }); process.exitCode = 1; }).finally(() => {
  fs.writeFileSync(path.join(out, 'reviews-checks.json'), JSON.stringify({ base, results, measurements, errors, requests }, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
  clearTimeout(deadline); ws?.close(); chrome.kill();
});
