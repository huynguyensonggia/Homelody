const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const out=path.resolve('reports'),base=process.env.CHAPTER_URL||'http://localhost:3000/';fs.mkdirSync(out,{recursive:true});
const chrome=spawn(process.env.CHROME_BIN||'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe',['--headless','--disable-gpu','--remote-debugging-port=9231',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-cover-'))}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0;const pending=new Map(),errors=[],results=[],measurements=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deadline=setTimeout(()=>{chrome.kill();process.exit(2)},90000);
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
function check(ok,label,detail){results.push({label,passed:!!ok,...(detail===undefined?{}:{detail})});console.log((ok?'PASS ':'FAIL ')+label+(detail===undefined?'':' '+JSON.stringify(detail)))}
async function poll(expression,limit=4000){for(let i=0;i<limit/40;i++){if(await ev(expression))return true;await sleep(40)}return false}
async function metrics(width,height=900){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(150)}
async function load(hash=''){await call('Page.navigate',{url:base+hash});await poll(`document.readyState==='complete'&&!!document.querySelector('[data-story-space]')`);await ev('document.fonts.ready.then(()=>true)');await sleep(120)}
async function scroll(top,wait=150){await ev(`scrollTo({top:${top},behavior:'instant'})`);await sleep(wait)}
async function settle(){let old=-1,stable=0;for(let i=0;i<45;i++){await sleep(70);const y=await ev('scrollY');stable=Math.abs(y-old)<.1?stable+1:0;old=y;if(stable>=3)return}}
async function shot(width,phase){const r=await call('Page.captureScreenshot',{format:'png'});const file=path.join(out,`chapter-cover-${width}-${phase}.png`);fs.writeFileSync(file,Buffer.from(r.data,'base64'));console.log('SCREENSHOT '+file)}
const state=`(()=>{const c=document.querySelector('[data-story-space]'),s=document.querySelector('#cau-chuyen'),p=document.querySelector('#khong-gian'),h=document.querySelector('[data-header]'),b=document.querySelector('[data-mobile-order]'),sign=s.querySelector('.story__sign'),last=s.querySelector('.story__body:last-child'),r=e=>{const a=e.getBoundingClientRect();return {top:a.top,bottom:a.bottom,height:a.height}},bar=b&&!b.hidden&&getComputedStyle(b).position==='fixed'?r(b).height:0;return {width:innerWidth,height:innerHeight,y:scrollY,pageWidth:document.documentElement.scrollWidth,origin:r(c).top+scrollY,spaceOrigin:r(p).top+scrollY,header:r(h),story:r(s),space:r(p),sign:r(sign),last:r(last),bar,pin:parseFloat(getComputedStyle(s).top),storyHeight:s.offsetHeight,enabled:c.classList.contains('is-cover-enabled'),position:getComputedStyle(s).position,storyPadding:parseFloat(getComputedStyle(s).paddingTop),spaceZ:getComputedStyle(p).zIndex,storyZ:getComputedStyle(s).zIndex,scale:getComputedStyle(s.firstElementChild).transform,shade:getComputedStyle(s,'::after').opacity,covered:c.classList.contains('is-story-covered')}})()`;
async function pin(){let s;for(let i=0;i<3;i++){s=await ev(state);await scroll(s.origin-(Number.isFinite(s.pin)?s.pin:0),750);s=await ev(state);if(Math.abs(s.story.top-s.pin)<2)return s}return s}
async function phase(progress){const s=await ev(state);await scroll(s.spaceOrigin-(s.height-(s.height-s.header.height)*progress),750);return ev(state)}
(async()=>{
 let tabs;for(let i=0;i<50;i++){try{tabs=await(await fetch('http://localhost:9231/json')).json();break}catch{await sleep(150)}}
 ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}});
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 // Save transition stages first so the design can be inspected while tests continue.
 for(const width of [1440,390]){await metrics(width);await load();await pin();await shot(width,'start');await phase(.5);await shot(width,'half');await phase(1);await shot(width,'full')}
 for(const width of [1440,390]){
  await metrics(width);await load();const start=await pin();measurements.push(start);
  check(start.enabled&&start.position==='sticky','story cover enabled '+width);
  check(Math.abs(start.story.top-start.pin)<2,'story reaches measured pin '+width,{top:start.story.top,pin:start.pin});
  check(start.sign.top>=start.header.bottom-2&&start.sign.bottom<=start.height-start.bar+2&&start.last.bottom<=start.height-start.bar+2,'last paragraph and signature readable before cover '+width,{last:start.last,sign:start.sign,bar:start.bar});
  check(start.storyPadding===(width<768?32:56),'original story boundary spacing retained '+width,start.storyPadding);
  const half=await phase(.5),full=await phase(1);
  check(Math.abs(half.story.top-start.story.top)<2&&Math.abs(full.story.top-start.story.top)<2,'story remains pinned while incoming section rises '+width);
  check(full.space.top<half.space.top&&Math.abs(full.space.top-full.header.height)<2,'space moves up to header '+width);
  check(await ev(`getComputedStyle(document.querySelector('.story__carousel > .story__card')).animationPlayState==='paused'`),'fully covered story photo loop pauses '+width);
  check(await ev(`(()=>{const p=document.querySelector('#khong-gian'),h=document.querySelector('[data-header]'),a=document.elementFromPoint(innerWidth/2,h.getBoundingClientRect().bottom+30);return !!a&&(a===p||p.contains(a))})()`),'incoming space actually covers story '+width);
  check(await ev(`(()=>{const h=document.querySelector('[data-header]'),a=document.elementFromPoint(24,20);return !!a&&(a===h||h.contains(a))})()`),'fixed header remains above both chapters '+width);
  const reverse=await phase(.5);check(Math.abs(reverse.space.top-half.space.top)<2&&Math.abs(reverse.story.top-half.story.top)<2,'reverse scroll restores same geometry '+width);
  const y=reverse.y;await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:width/2,y:450,deltaX:0,deltaY:120});await sleep(150);
  check((await ev('scrollY'))>y+50,'native wheel scroll remains active '+width);
  await ev(`document.querySelector('#thuc-don').scrollIntoView({block:'start',behavior:'instant'})`);await sleep(180);
  check(await ev(`document.querySelector('#thuc-don').getBoundingClientRect().top>=0&&document.querySelector('#thuc-don').getBoundingClientRect().top<innerHeight`),'menu remains reachable after stack '+width);
  await ev(`document.querySelector('a[href="#cau-chuyen"]').click()`);await settle();const anchored=await ev(state);
  check(Math.abs(anchored.origin-anchored.y-anchored.header.height)<2,'story anchor from below targets flow start '+width,{top:anchored.origin-anchored.y,header:anchored.header.height});
  await ev(`document.querySelector('a[href="#khong-gian"]').click()`);await settle();const spaceAnchor=await ev(state);
  check(Math.abs(spaceAnchor.space.top-spaceAnchor.header.height)<2,'space anchor stays below header '+width,{spaceTop:spaceAnchor.space.top,header:spaceAnchor.header.height});
  await load('#cau-chuyen');await sleep(150);const fresh=await ev(state);
  check(Math.abs(fresh.origin-fresh.y-fresh.header.height)<3,'fresh story hash opens chapter start '+width,{top:fresh.origin-fresh.y,header:fresh.header.height});
  check(fresh.pageWidth<=width,'no horizontal page overflow '+width);
 }
 for(const width of [1440,390]){
  await metrics(width,600);await load();const short=await pin();
  check(Math.abs(short.pin-Math.min(short.header.height,short.height-short.bar-short.storyHeight))<2,'short viewport pin accounts for full content and mobile CTA '+width);
  check(short.sign.bottom<=short.height-short.bar+2&&short.sign.top>=short.header.bottom-2,'short viewport signature stays readable '+width,{sign:short.sign,bar:short.bar});
 }
 const before=await ev(state);await ev(`document.querySelectorAll('#cau-chuyen .story__body').forEach(p=>p.style.fontSize='22px')`);await sleep(220);const changed=await ev(state);
 check(changed.storyHeight!==before.storyHeight&&Math.abs(changed.pin-Math.min(changed.header.height,changed.height-changed.bar-changed.storyHeight))<2,'content resize recomputes story pin');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(100);const reduced=await ev(state);
 check(!reduced.enabled&&reduced.position==='static','reduced motion uses normal document flow');
 check(await ev(`[...document.querySelectorAll('#cau-chuyen .story__body,#khong-gian [data-space-reveal]')].every(e=>getComputedStyle(e).opacity==='1')`),'reduced motion leaves story and space content visible');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await sleep(100);
 check((await ev(state)).enabled,'turning motion back on restores chapter cover');
 await call('Emulation.setScriptExecutionDisabled',{value:true});await load();
 check(await ev(`getComputedStyle(document.querySelector('#cau-chuyen')).position==='static'&&!document.querySelector('[data-story-space]').classList.contains('is-cover-enabled')`),'no JavaScript preserves static readable sections');
 await call('Emulation.setScriptExecutionDisabled',{value:false});
 check(errors.length===0,'no browser JavaScript exceptions',errors);
})().catch(e=>{console.error(e);results.push({label:'runner completed',passed:false,error:String(e)});process.exitCode=1}).finally(()=>{fs.writeFileSync(path.join(out,'chapter-cover-checks.json'),JSON.stringify({base,results,measurements,errors},null,2));if(results.some(r=>!r.passed))process.exitCode=1;clearTimeout(deadline);ws?.close();chrome.kill()});
