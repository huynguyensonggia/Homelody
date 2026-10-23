const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const out = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
fs.mkdirSync(out, { recursive: true });
const chrome = spawn('C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9234', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-design-audit-')), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, sequence = 0;
const pending = new Map(), errors = [], measurements = [], sleep = ms => new Promise(r => setTimeout(r, ms));
const deadline = setTimeout(() => { chrome.kill(); process.exit(2); }, 100000);
const sections = [['hero', '#top'], ['stats', '.stats'], ['drinks', '#do-uong'], ['bakery', '#banh-nha-lam'], ['story', '#cau-chuyen'], ['space', '#khong-gian'], ['menu', '#thuc-don'], ['experiences', '.experiences'], ['reviews', '#danh-gia'], ['visit', '#ghe-quan'], ['footer', '.site-footer']].filter(([name]) => !process.argv[4] || process.argv[4].split(',').includes(name));
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
(async () => {
  let tabs;
  for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://localhost:9234/json')).json(); break; } catch { await sleep(100); } }
  ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable'); await call('DOM.enable'); await call('CSS.enable');
  for (const width of (process.argv[3] || '1440,390').split(',').map(Number)) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: 'http://localhost:3000/' });
    for (let i = 0; i < 50; i++) { if (await ev(`!!document.querySelector('.reviews__card')&&!!document.querySelector('.menu-card')`)) break; await sleep(100); }
    await ev('document.fonts.ready.then(()=>true)'); await sleep(1900);
    await ev(`(()=>{const s=document.createElement('style');s.textContent='.story__card,.reviews__marquee{animation-play-state:paused!important}';document.head.appendChild(s)})()`);
    for (const [name, selector] of sections) {
      await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}), flow=${JSON.stringify(name)}==='story'?document.querySelector('[data-story-space]'):e;window.scrollTo({top:Math.max(0,flow.getBoundingClientRect().top+scrollY-76),behavior:'instant'})})()`);
      await sleep(850);
      const data = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}), fields=['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','color','backgroundColor','backgroundImage','textShadow'];function style(n){if(!n)return null;const s=getComputedStyle(n);return Object.fromEntries(fields.map(k=>[k,s[k]]))}return {width:innerWidth,name:${JSON.stringify(name)},height:e.offsetHeight,surface:style(e),headings:[...e.querySelectorAll('h1,h2,h3')].slice(0,5).map(n=>({text:n.textContent.trim(),...style(n)})),paragraphs:[...e.querySelectorAll('p,blockquote,dt')].filter(n=>n.textContent.trim()).slice(0,4).map(n=>({text:n.textContent.trim().slice(0,100),...style(n)})),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
      measurements.push(data);
      const shot = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, `${name}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    const special = await ev(`(()=>{const selectors=['.site-header__cta','.hero__menu-cta','.bakery__page','.drinks .stage','.destination__heading>p','.destination__card','.destination__eyebrow','.destination__details li p','.site-footer__copyright'];return selectors.map(q=>{const n=document.querySelector(q);if(!n)return {selector:q};const s=getComputedStyle(n);return {selector:q,text:n.textContent.trim().slice(0,80),font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,color:s.color,bg:s.backgroundColor,gradient:s.backgroundImage}})})()`);
    measurements.push({ width, special });
    const doc = await call('DOM.getDocument');
    for (const selector of ['.hero__title', '.hero__lead', '.destination__heading>p', '.menu-group__title']) {
      const { nodeId } = await call('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      if (nodeId) measurements.push({ width, selector, actualFonts: (await call('CSS.getPlatformFontsForNode', { nodeId })).fonts });
    }
    console.log('Captured desktop/mobile width ' + width);
  }
  fs.writeFileSync(path.join(out, 'measured-styles.json'), JSON.stringify({ measurements, errors }, null, 2));
  console.log('Sections captured: ' + sections.length + '; browser exceptions: ' + errors.length);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { clearTimeout(deadline); ws?.close(); chrome.kill(); });
