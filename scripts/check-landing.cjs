const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const out=path.resolve('reports');
const chrome=spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe',['--headless','--disable-gpu','--remote-debugging-port=9230',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-landing-'))}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0;const pending=new Map(),errors=[],requests=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deadline=setTimeout(()=>{chrome.kill();process.exit(2)},90000);
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
let results=[];function check(ok,label){results.push({label,passed:!!ok});if(!ok)throw Error(label);console.log('PASS '+label)}
async function scroll(selector){await ev(`window.scrollTo({top:document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().top+scrollY-90,behavior:'instant'})`);await sleep(700)}
async function shot(name){const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
(async()=>{
 let tabs;for(let i=0;i<40;i++){try{tabs=await(await fetch('http://localhost:9230/json')).json();break}catch{await sleep(250)}}
 ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.method==='Network.responseReceived'&&m.params.response.status>=400)requests.push({url:m.params.response.url,status:m.params.response.status});if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}});
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:'http://localhost:8000/'});
 for(let i=0;i<60;i++){if(await ev(`document.querySelectorAll('.option').length>0&&!!document.querySelector('.social a[href]')`))break;await sleep(200)}
 await ev(`document.fonts.ready.then(()=>true)`);
 // Stop navigation during synthetic clicks, while allowing delegated analytics handlers to run.
 await ev(`document.addEventListener('click',e=>{if(e.target.closest('a[data-link]'))e.preventDefault()},true)`);
 check(await ev(`JSON.stringify([...document.querySelectorAll('.site-nav>a:not(.site-nav__booking)')].map(a=>a.textContent))===JSON.stringify(['Không gian','Câu chuyện','Thực đơn','Ghé quán'])`),'header navigation order');
 check(await ev(`!document.querySelector('[data-stats]')&&document.querySelectorAll('.experiences li').length===4`),'unverified counters removed, four experiences');
 check(await ev(`!document.querySelector('.menu-preview')&&!document.body.innerText.includes('Cần thay')&&!document.querySelector('.visit__media--placeholder')`),'no visible placeholders or menu preview');
 check(await ev(`[...document.querySelectorAll('[data-link="ZALO_URL"]')].every(a=>a.href==='https://zalo.me/0935983263'&&a.target==='_blank'&&a.rel.includes('noopener'))`),'all Zalo links use booking number and safe new tabs');
 check(await ev(`[...document.querySelectorAll('[data-link="MAPS_URL"]')].every(a=>a.href===HOMELODY_CONFIG.links.MAPS_URL)`),'all Maps links use supplied place URL');
 check(await ev(`[...document.querySelectorAll('[data-link="GRABFOOD_URL"],[data-link="SHOPEEFOOD_URL"]')].every(a=>!a.hasAttribute('href')&&a.getAttribute('aria-disabled')==='true')`),'missing delivery URLs never point to invented destinations');
 check(await ev(`[...document.images].filter(i=>!i.closest('.drink-dialog')&&!i.src.startsWith('data:')).every(i=>i.src.endsWith('.webp'))`),'all visible photographic assets use WebP');
 check(await ev(`getComputedStyle(document.querySelector('.hero__media img')).animationName==='none'&&document.querySelector('.hero__media img').fetchPriority==='high'`),'hero image immediate and high priority');
 check(await ev(`document.querySelector('.site-header').classList.contains('is-over-hero')`),'header transparent at top');
 await ev(`scrollTo({top:81,behavior:'instant'})`);await sleep(400);
 check(await ev(`!document.querySelector('.site-header').classList.contains('is-over-hero')&&getComputedStyle(document.querySelector('.site-header')).backgroundColor==='rgba(242, 237, 228, 0.92)'&&Number(getComputedStyle(document.querySelector('.site-header')).zIndex)>=100`),'header opaque above hero content after 80px');
 await scroll('.drinks');
 check(await ev(`getComputedStyle(document.querySelector('.stage'),'::before').backgroundColor==='rgb(237, 228, 214)'&&document.querySelector('.selector-row').contains(document.querySelector('[data-drink-pause]'))`),'cream product stage and pause in thumbnail row');
 const before=await ev(`document.querySelector('.option[aria-checked="true"]').dataset.drink`);await sleep(4500);
 check(before!==await ev(`document.querySelector('.option[aria-checked="true"]').dataset.drink`),'autoplay remains active');
 await scroll('#thuc-don');
 const tabNames=await ev(`Array.from(document.querySelectorAll('.menu-tab[role="tab"]')).map(x=>x.textContent)`);console.log('Tabs '+JSON.stringify(tabNames));
 check(!tabNames.includes('Brunch'),'empty Brunch category hidden');
 const panelHeight=await ev(`document.querySelector('#menu-panel')?.offsetHeight||0`);
 await ev(`document.querySelectorAll('.menu-tab[role="tab"]')[1]?.click()`);await sleep(350);
 check(await ev(`(()=>{const p=document.querySelector('#menu-panel'),last=p?.querySelector('.menu-group:last-child .menu-item:last-child');return !p||(p.offsetHeight<${panelHeight}&&!!last&&Math.abs(p.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom)<=2)})()`),'category filtering shrinks list without trailing blank rows');
 await ev(`document.querySelector('.menu-item__btn').click()`);await sleep(500);
 check(await ev(`document.querySelector('#drink-dialog').open&&document.body.style.position==='fixed'&&document.querySelectorAll('.drink-dialog__actions [data-link]').length===2&&!document.querySelector('[data-dialog-action]')`),'one modal with delivery actions and scroll lock');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(350);
 check(await ev(`!document.querySelector('#drink-dialog').open&&document.activeElement.classList.contains('menu-item__btn')`),'Escape closes modal and restores focus');
 for(const width of [1440,1024,768,375]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await sleep(200);
  await ev(`scrollTo({top:0,behavior:'instant'})`);await sleep(650);
  if(width>=1024) check(await ev(`getComputedStyle(document.querySelector('.site-nav__booking')).display==='none'`),'single desktop booking CTA '+width);
  const overflow=await ev(`({scroll:document.documentElement.scrollWidth,width:innerWidth,bad:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&!e.closest('.menu-tabs,.story__stack,.hero__media,.site-nav,.menu-tabs__ink')}).slice(0,8).map(e=>e.className)})`);console.log(width+' '+JSON.stringify(overflow));
  check(overflow.scroll<=width,'no horizontal overflow '+width);
  const title=await ev(`(()=>{const e=document.querySelector('.hero__title');return e.offsetHeight/parseFloat(getComputedStyle(e).lineHeight)})()`);
  check(title<2.1,'two-line hero heading '+width);
  await shot('landing-hero-'+width);
  if(width===375){
   await ev(`scrollTo({top:80,behavior:'instant'})`);await sleep(50);
   check(await ev(`document.querySelector('.hero__eyebrow').getBoundingClientRect().top>=document.querySelector('.site-header').getBoundingClientRect().bottom`),'hero text stays below header before opaque threshold');
   await ev(`scrollTo({top:0,behavior:'instant'})`);
   check(await ev(`document.querySelector('[data-mobile-order]').hidden`),'mobile sticky hidden on hero');
   await ev(`document.querySelector('[data-nav-toggle]').click()`);await sleep(100);
   check(await ev(`document.documentElement.classList.contains('is-nav-open')&&document.querySelector('.site-nav').getBoundingClientRect().bottom>=innerHeight-1&&document.querySelector('.site-nav__booking').href===HOMELODY_CONFIG.links.ZALO_URL`),'fullscreen mobile navigation and booking CTA');
   await shot('landing-mobile-nav');await ev(`document.querySelector('[data-nav-toggle]').click()`);
   await scroll('.drinks');check(await ev(`!document.querySelector('[data-mobile-order]').hidden`),'mobile sticky appears below hero');
   await ev(`document.querySelector('[data-delivery-toggle]').click()`);check(await ev(`!document.querySelector('#mobile-delivery-menu').hidden`),'mobile delivery menu');
   await ev(`document.querySelector('[data-mobile-order] [data-link="ZALO_URL"]').click()`);
   check(await ev(`dataLayer.some(e=>e.event==='zalo_booking_click'&&e.position==='sticky_mobile')`),'booking click tracking includes position');
   await ev(`document.querySelector('[data-drink-stage]').click()`);await sleep(500);check(await ev(`document.querySelector('[data-mobile-order]').hidden&&document.querySelector('#drink-dialog').open`),'sticky hidden under modal');
   await ev(`document.querySelector('[data-close-dialog]').click()`);await sleep(350);
   await shot('landing-drinks-mobile');
  }
  await scroll('#ghe-quan');check(await ev(`document.querySelectorAll('.visit .info-list__row').length===5&&!document.querySelector('.visit__media')`),'five contact rows, no fake photo '+width);
  if(width===375){await ev(`document.querySelector('.visit__actions [data-link="MAPS_URL"]').click();document.querySelector('.visit__actions [data-link="PHONE"]').click()`);check(await ev(`dataLayer.some(e=>e.event==='directions_click'&&e.position==='contact')&&dataLayer.some(e=>e.event==='call_click'&&e.position==='contact')`),'directions and phone tracking carry contact position');}
  await shot('landing-contact-'+width);
 }
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(100);await scroll('.story');
 check(await ev(`getComputedStyle(document.querySelector('.story__word')).opacity==='1'&&document.querySelector('[data-drink-playback]').hidden`),'reduced motion: readable story and no autoplay');
 check(!errors.length,'no browser JavaScript exceptions');check(!requests.length,'no HTTP errors for loaded assets');
 console.log('Reports: '+out);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{fs.writeFileSync(path.join(out,'landing-checks.json'),JSON.stringify({results,errors,requests},null,2));clearTimeout(deadline);ws?.close();chrome.kill()});
