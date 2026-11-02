import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(!html.includes('Matcha Latte') && !html.includes('e9c0eee833b774aa'), 'No sample Matcha image or text in initial HTML');
assert.ok(!/<img[^>]*class="glass__img"[^>]*src=/.test(html), 'Featured image source comes from resolved data');
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless', '--disable-gpu', '--remote-debugging-port=9255', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'homelody-sticky-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
const pending = new Map(), errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function poll(expression) { for (let i = 0; i < 100; i++) { if (await ev(expression)) return; await sleep(75); } throw Error('Timeout: ' + expression); }
const timeout = setTimeout(() => { chrome.kill(); process.exit(2); }, 60000);
try {
  let tab;
  for (let i = 0; i < 60; i++) { try { tab = (await (await fetch('http://localhost:9255/json/list')).json()).find(t => t.type === 'page'); } catch {} if (tab) break; await sleep(100); }
  assert.ok(tab); ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['*supabase.co*'] });


  const hook = function () {
    Object.defineProperty(window,'HOMELODY_CONFIG',{configurable:true,set(value){value.supabaseUrl='https://gallery-fixture.supabase.co';value.supabaseKey='sb_publishable_fixture';Object.defineProperty(window,'HOMELODY_CONFIG',{value,configurable:true});}});
    const original=window.fetch;
    window.fetch=function(input,options){const url=String(input);if(!url.includes('gallery-fixture.supabase.co/rest/v1/'))return original(input,options);
      const offline=location.search.includes('offline');if(offline)return Promise.reject(new Error('Fixture offline'));
      const shop=url.includes('shop_settings');const photo={image_url:'public/cau-chuyen/story-khach-hang.png',image_alt:'Current test gallery'};
      if(!shop&&location.search.includes('menu-fail'))return new Promise((resolve,reject)=>setTimeout(()=>reject(new Error('Fixture menu failed')),2000));
      const rows=shop?[{id:1,story_images:Array(5).fill(photo),space_images:Array(3).fill(photo)}]:[{id:'probe',name:'Current first drink',category:'Test',price:1000,is_active:true,image_url:'assets/images/drink-iced-latte.webp',image_alt:'Current first drink',is_featured:true}];
      return new Promise(resolve=>setTimeout(()=>resolve(new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}})),shop?1500:3500));
    };
    window.galleryFlash=[];
    function inspect(){if(document.documentElement.classList.contains('js'))document.querySelectorAll('[data-story-stack] .story__card img,#khong-gian .space-card>img').forEach(img=>{if(!location.search.includes('offline')&&getComputedStyle(img).opacity!=='0'&&img.alt!=='Current test gallery')window.galleryFlash.push(img.src);});requestAnimationFrame(inspect);}requestAnimationFrame(inspect);
  };
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+hook.toString()+')()'});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const width of [390,1440]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await call('Page.navigate',{url:'http://localhost:8000/?galleryWidth='+width+'#khong-gian'});
    await poll("location.search==='?galleryWidth="+width+"'&&document.querySelectorAll('#khong-gian .space-card>img').length===3");
    assert.ok(await ev("Array.from(document.querySelectorAll('#khong-gian .space-card>img')).every(img=>getComputedStyle(img).opacity==='0')"),'Default photos hidden during delayed settings');
    await poll("document.querySelectorAll('#khong-gian img[data-gallery-ready]').length===3");
    assert.ok(await ev("Array.from(document.querySelectorAll('#khong-gian img')).every(img=>img.alt==='Current test gallery'&&img.naturalWidth>0&&getComputedStyle(img).opacity==='1')"),'Current photos appear only after loading');
    assert.equal(await ev("!!document.querySelector('#menu-panel')"),false,'Gallery does not wait for slower menu request');
    assert.deepEqual(await ev('window.galleryFlash'),[],'No frame shows static fallback photos');
    await ev("document.querySelector('#cau-chuyen').scrollIntoView({behavior:'instant'})");
    await poll("document.querySelectorAll('[data-story-stack] img[data-gallery-ready]').length===5");
    assert.deepEqual(await ev('window.galleryFlash'),[]);
    await poll("!!document.querySelector('#do-uong[data-featured-ready]')");
    assert.equal(await ev("document.querySelector('[data-field=name]').textContent"), 'Current first drink');
    assert.ok(await ev("(()=>{const img=document.querySelector('.glass__img'),v=window.HOMELODY_IMAGE_VARIANTS['assets/images/drink-iced-latte.webp'],src=v?(v.find(x=>x.width>=800)||v[v.length-1]).src:'assets/images/drink-iced-latte.webp';return img.naturalWidth>0&&img.src===new URL(src,location.href).href})()"));
    assert.ok(await ev("!document.querySelector('[data-menu-list]').textContent.includes('Matcha')"), 'Menu has no sample dish');
    await ev("document.querySelector('button[data-open-drink]').click()");
    await poll("document.querySelector('#drink-dialog').open&&document.querySelector('[data-dialog-field=image][data-product-ready]')");
    assert.equal(await ev("document.querySelector('[data-dialog-field=name]').textContent"), 'Current first drink');
    assert.equal(await ev("document.querySelector('[data-dialog-field=image]').src"), await ev("document.querySelector('.glass__img').src"));
    await ev("document.querySelector('[data-close-dialog]').click()");
    await poll("!document.querySelector('#drink-dialog').open");
    await call('Page.reload',{ignoreCache:true});
    await poll("document.querySelectorAll('[data-gallery-ready]').length===0");
    await poll("document.querySelectorAll('#khong-gian img[data-gallery-ready]').length===3");
    assert.deepEqual(await ev('window.galleryFlash'),[],'Hard reload has no old photo flash');
    console.log('PASS delayed settings/menu, correct featured/menu/dialog images, story/space and hard reload at '+width);
  }
  await call('Page.navigate',{url:'http://localhost:8000/?menu-fail=1#khong-gian'});
  await poll("location.search==='?menu-fail=1'&&document.documentElement?.hasAttribute('data-menu-source')");
  assert.ok(await ev("Array.from(document.querySelectorAll('#khong-gian img')).every(img=>img.alt==='Current test gallery')"),'Menu failure keeps fresh gallery settings');
  assert.deepEqual(await ev('window.galleryFlash'),[]);
  console.log('PASS menu failure does not restore stale gallery photos.');
  await call('Page.navigate',{url:'http://localhost:8000/?offline=1#khong-gian'});
  await poll("document.querySelectorAll('#khong-gian img[data-gallery-ready]').length===3");
  assert.ok(await ev("Array.from(document.querySelectorAll('#khong-gian img')).every(img=>img.naturalWidth>0&&getComputedStyle(img).opacity==='1')"),'Offline fallback remains visible');
  assert.equal(errors.length,0,'No browser exceptions');
  console.log('PASS offline fallback and no JavaScript exceptions.');
}finally{clearTimeout(timeout);ws?.close();chrome.kill();}
