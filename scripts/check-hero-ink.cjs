const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const out=path.resolve('reports'),base=process.env.HERO_URL||'http://localhost:3000/';
fs.mkdirSync(out,{recursive:true});
const chrome=spawn(process.env.CHROME_BIN||'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe',['--headless','--disable-gpu','--remote-debugging-port=9231',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-hero-'))}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0,requestMode='pass';const pending=new Map(),errors=[],results=[],paused=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deadline=setTimeout(()=>{chrome.kill();process.exit(2)},75000);
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
function check(ok,label,detail){results.push({label,passed:!!ok,...(detail===undefined?{}:{detail})});console.log((ok?'PASS ':'FAIL ')+label+(detail===undefined?'':' '+JSON.stringify(detail)))}
async function poll(expression,limit=4000){for(let i=0;i<limit/25;i++){if(await ev(expression))return true;await sleep(25)}return false}
async function navigate(){await call('Page.navigate',{url:base});await poll(`!!document.querySelector('.hero__media')&&document.readyState!=='loading'`)}
async function shot(name){const r=await call('Page.captureScreenshot',{format:'png'});const file=path.join(out,name+'.png');fs.writeFileSync(file,Buffer.from(r.data,'base64'));console.log('SCREENSHOT '+file)}
const pictureState=`(()=>{const i=document.querySelector('.hero__media img'),s=getComputedStyle(i);return {opacity:s.opacity,transform:s.transform,animation:s.animationName,mask:s.maskImage,crop:s.objectPosition,fit:s.objectFit,width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height}})()`;
const buttonsClear=`[...document.querySelectorAll('.hero__actions a')].every(a=>{const r=a.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit&&(hit===a||a.contains(hit))&&getComputedStyle(a).opacity==='1'})`;
(async()=>{
 let tabs;for(let i=0;i<50;i++){try{tabs=await(await fetch('http://localhost:9231/json')).json();break}catch{await sleep(150)}}
 ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.method==='Fetch.requestPaused'){if(requestMode==='slow')paused.push(m.params.requestId);else if(requestMode==='error')void call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Failed'});else void call('Fetch.continueRequest',{requestId:m.params.requestId})}if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}});
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 // Pause only the reveal animation at its start so screenshots sample exact effect times.
 const hook=await call('Page.addScriptToEvaluateOnNewDocument',{source:`document.addEventListener('animationstart',e=>{if(e.animationName==='hero-ink-flow'){window.__inkAnimation=e.target.getAnimations().find(a=>a.animationName==='hero-ink-flow');window.__inkAnimation.pause()}},true)`});
 for(const width of [1440,390]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await navigate();
  check(await poll(`!!window.__inkAnimation`),'load starts one reveal '+width);
  await ev(`document.fonts.ready.then(()=>true)`);const before=await ev(pictureState);
  for(const time of [150,650,1500]){
   await ev(`if(window.__inkAnimation)window.__inkAnimation.currentTime=${time}`);await sleep(25);await shot('hero-ink-'+width+'-'+time);
   if(time===650){check(await ev(buttonsClear),'buttons remain hit-testable during reveal '+width);check(await ev(`(()=>{const w=document.querySelector('.hero__ink-wash'),t=document.querySelector('.hero__title');return !!w&&!w.parentElement.contains(t)&&getComputedStyle(w).pointerEvents==='none'})()`),'wash is isolated from text and pointer input '+width)}
  }
  check(await poll(`!document.querySelector('.hero__ink-wash')`,2200),'wash removed after reveal '+width);
  const after=await ev(pictureState);
  check(await ev(`getComputedStyle(document.querySelector('.hero__title')).opacity==='1'`),'existing title entrance completes normally '+width);
  check(after.opacity==='1'&&after.transform==='none'&&after.animation==='none','photo remains visible and never zooms '+width,after);
  check(before.mask===after.mask&&before.crop===after.crop&&before.fit===after.fit&&before.height===after.height,'image crop and existing mask unchanged '+width);
  if(width===390)check(after.mask.includes('linear-gradient')&&after.crop==='83% 50%','mobile keeps gradient mask and intended cup crop');
  check(await ev(`document.documentElement.scrollWidth<=innerWidth`),'no horizontal page overflow '+width);
 }
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate();
 check(await poll(`!document.querySelector('.hero__ink-wash')`),'reduced motion immediately uses static photo');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await call('Fetch.enable',{patterns:[{urlPattern:'*hero-coffee-banner*.webp*',requestStage:'Request'}]});
 requestMode='error';await navigate();check(await poll(`!document.querySelector('.hero__ink-wash')`),'failed image removes wash safely');
 requestMode='slow';await navigate();check(await poll(`!document.querySelector('.hero__ink-wash')`,3300),'slow image timeout removes wash');
 requestMode='pass';for(const requestId of paused.splice(0))await call('Fetch.continueRequest',{requestId});await poll(`document.querySelector('.hero__media img').naturalWidth>0`);await sleep(100);
 check(await ev(`!document.querySelector('.hero__ink-wash')&&!document.querySelector('.hero__media').classList.contains('is-ink-revealing')`),'late image load does not restart reveal');
 await call('Fetch.disable');
 // Keep the inline .js marker, but block the enhancement file to exercise CSS fallback.
 await call('Network.setBlockedURLs',{urls:['*assets/js/landing.js*']});await navigate();await sleep(3500);
 check(await ev(`(()=>{const w=document.querySelector('.hero__ink-wash');return !w||getComputedStyle(w).visibility==='hidden'||getComputedStyle(w).opacity==='0'})()`),'CSS fallback clears wash when enhancement fails');
 await call('Network.setBlockedURLs',{urls:[]});await call('Emulation.setScriptExecutionDisabled',{value:true});await navigate();await sleep(150);
 check(await ev(`getComputedStyle(document.querySelector('.hero__ink-wash')).display==='none'`),'fully disabled JavaScript shows original static photo');
 await call('Emulation.setScriptExecutionDisabled',{value:false});
 check(errors.length===0,'no browser JavaScript exceptions',errors);
})().catch(e=>{console.error(e);results.push({label:'runner completed',passed:false,error:String(e)});process.exitCode=1}).finally(()=>{fs.writeFileSync(path.join(out,'hero-ink-checks.json'),JSON.stringify({base,results,errors},null,2));if(results.some(r=>!r.passed))process.exitCode=1;clearTimeout(deadline);ws?.close();chrome.kill()});
