const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const out=path.resolve('reports'),base=process.env.STORY_URL||'http://localhost:3000/';fs.mkdirSync(out,{recursive:true});
const chrome=spawn(process.env.CHROME_BIN||'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe',['--headless','--disable-gpu','--remote-debugging-port=9231',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-words-'))}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0;const pending=new Map(),errors=[],results=[],measurements=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deadline=setTimeout(()=>{chrome.kill();process.exit(2)},75000);
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
function check(ok,label,detail){results.push({label,passed:!!ok,...(detail===undefined?{}:{detail})});console.log((ok?'PASS ':'FAIL ')+label+(detail===undefined?'':' '+JSON.stringify(detail)))}
async function poll(expression){for(let i=0;i<100;i++){if(await ev(expression))return true;await sleep(30)}return false}
async function metrics(width){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await sleep(100)}
async function load(){await call('Page.navigate',{url:base});await poll(`document.readyState==='complete'&&!!document.querySelector('.story__text')`);await ev('document.fonts.ready.then(()=>true)');await sleep(100)}
async function scroll(y){await ev(`scrollTo({top:${y},behavior:'instant'})`);await sleep(180)}
async function shot(width,phase){const r=await call('Page.captureScreenshot',{format:'png'});const file=path.join(out,`story-words-${width}-${phase}.png`);fs.writeFileSync(file,Buffer.from(r.data,'base64'));console.log('SCREENSHOT '+file)}
const geometry=`(()=>{const s=document.querySelector('#cau-chuyen'),p=s.querySelector('.story__body'),n=document.querySelector('#khong-gian'),h=document.querySelector('[data-header]'),b=document.querySelector('[data-mobile-order]');return {y:scrollY,height:innerHeight,header:h.getBoundingClientRect().height,bar:b&&!b.hidden?b.getBoundingClientRect().height:0,firstTop:p.getBoundingClientRect().top,spaceOrigin:n.getBoundingClientRect().top+scrollY,storyTop:s.getBoundingClientRect().top,pin:parseFloat(getComputedStyle(s).top)}})()`;
const state=`(()=>{const s=document.querySelector('#cau-chuyen'),w=[...s.querySelectorAll('.story__word')],styles=w.map(e=>getComputedStyle(e)),opacities=styles.map(x=>+x.opacity),blur=styles.map(x=>x.filter==='none'?0:parseFloat(x.filter.slice(5)));return {count:w.length,min:Math.min(...opacities),max:Math.max(...opacities),mean:opacities.reduce((a,b)=>a+b,0)/opacities.length,blur:Math.max(...blur),clear:styles.every(x=>+x.opacity>=.999&&(x.filter==='none'||parseFloat(x.filter.slice(5))<.01)),paragraphs:[...s.querySelectorAll('.story__body')].map(p=>({text:p.textContent,height:p.offsetHeight,parentOpacity:getComputedStyle(p).opacity,parentReveal:p.hasAttribute('data-story-reveal'),values:[...p.querySelectorAll('.story__word')].map(w=>+getComputedStyle(w).opacity)})),pageWidth:document.documentElement.scrollWidth,width:innerWidth}})()`;
// Sample while the body enters the reading area; the compact desktop copy is already clear higher up.
async function partial(){for(let i=0;i<2;i++){const g=await ev(geometry);await scroll(g.y+g.firstTop-(g.header+(g.height-g.header-g.bar)*.55))}await sleep(550);return ev(geometry)}
async function clear(){for(let i=0;i<2;i++){const g=await ev(geometry);await scroll(g.spaceOrigin-(g.height-g.bar))}await sleep(200);return ev(geometry)}
(async()=>{
 const html=await(await fetch(base)).text(),original=[...html.matchAll(/<p class="story__body">([\s\S]*?)<\/p>/g)].map(m=>m[1]);
 let tabs;for(let i=0;i<50;i++){try{tabs=await(await fetch('http://localhost:9231/json')).json();break}catch{await sleep(150)}}
 ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}});
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 // Capture the two meaningful visual states before running the rest of the checks.
 for(const width of [1440,390]){await metrics(width);await load();await partial();await shot(width,'partial');await clear();await shot(width,'clear')}
 for(const width of [1440,390]){
  await metrics(width);await load();const p=await partial(),before=await ev(state);measurements.push({width,partial:before});
  check(before.count===119,'all original word tokens enhanced '+width,before.count);
  check(JSON.stringify(before.paragraphs.map(p=>p.text))===JSON.stringify(original),'paragraph content and whitespace exactly preserved '+width);
  const wrapping=await ev(`(()=>{return [...document.querySelectorAll('.story__body')].map(p=>{const clone=p.cloneNode(false);clone.textContent=p.textContent;clone.style.cssText='position:absolute;left:0;top:0;visibility:hidden;margin:0;width:'+p.clientWidth+'px';p.parentElement.appendChild(clone);const range=document.createRange();range.selectNodeContents(clone);const originalLines=new Set([...p.querySelectorAll('.story__word')].flatMap(w=>[...w.getClientRects()].map(r=>r.top.toFixed(2)))).size,plainLines=range.getClientRects().length,result={height:p.offsetHeight,plainHeight:clone.offsetHeight,lines:originalLines,plainLines};clone.remove();return result})})()`);
  check(wrapping.every(x=>x.height===x.plainHeight&&x.lines===x.plainLines),'word spans preserve plain-text height and wrapping '+width,wrapping);
  check(before.min<.5&&before.max>.95&&before.blur>0&&before.blur<=1,'partial scroll mixes sharp text with a gentle blur '+width,{min:before.min,max:before.max,blur:before.blur});
  check(before.paragraphs.every(p=>p.parentOpacity==='1'&&!p.parentReveal),'paragraph parents have no second entrance fade '+width);
  check(await ev(`[...document.querySelectorAll('.story__word')].every(w=>getComputedStyle(w).display==='inline'&&!w.hasAttribute('tabindex')&&!w.closest('[aria-hidden="true"]')&&!w.hasAttribute('aria-live'))`),'word semantics remain inline and accessible '+width);
  await scroll(p.y+70);const advanced=await ev(state);
  check(advanced.mean>before.mean+.01,'further scroll increases clarity '+width,{before:before.mean,after:advanced.mean});
  const c=await clear(),finished=await ev(state);
  check(finished.clear,'all text sharp before incoming cover including mobile CTA '+width,{bar:c.bar,mean:finished.mean});
  await scroll(c.y+100);const covered=await ev(geometry);
  check(Math.abs(covered.storyTop-c.storyTop)<2&&(await ev(state)).clear,'sticky cover remains stable with clear words '+width);
  await scroll(p.y);const reversed=await ev(state);
  check(Math.abs(reversed.mean-before.mean)<.015&&reversed.mean<finished.mean-.005,'reverse scroll naturally restores earlier text state '+width,{partial:before.mean,reversed:reversed.mean,clear:finished.mean});
  check(before.pageWidth<=width,'no horizontal page overflow '+width);
  check(await ev(`(()=>{const p=document.querySelector('.story__text'),r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);const selected=getSelection().toString().replace(/\\s+/g,' ').trim(),actual=p.textContent.replace(/\\s+/g,' ').trim();getSelection().removeAllRanges();return selected===actual})()`),'text remains selectable across word spans '+width);
  check(await ev(`window.find('Lý Thường Kiệt')`),'browser search finds phrase across word spans '+width);
  await ev(`getSelection().removeAllRanges()`);
 }
 await partial();await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(100);
 check((await ev(state)).clear,'dynamic reduced motion clears opacity and blur');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await partial();
 check(!(await ev(state)).clear,'motion can resume from current scroll position');
 await call('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});await sleep(100);
 check((await ev(state)).clear,'forced colors keeps every word sharp');
 await call('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'none'},{name:'prefers-reduced-motion',value:'reduce'}]});await load();
 check((await ev(state)).clear,'initial reduced motion uses fully readable paragraphs');
 await call('Emulation.setEmulatedMedia',{features:[]});await call('Emulation.setScriptExecutionDisabled',{value:true});await load();
 check(await ev(`document.querySelectorAll('.story__word').length===0&&[...document.querySelectorAll('.story__body')].every(p=>getComputedStyle(p).opacity==='1'&&getComputedStyle(p).filter==='none')`),'no JavaScript preserves original sharp text');
 check(JSON.stringify(await ev(`[...document.querySelectorAll('.story__body')].map(p=>p.textContent)`))===JSON.stringify(original),'no JavaScript preserves exact original content');
 await call('Emulation.setScriptExecutionDisabled',{value:false});check(errors.length===0,'no browser JavaScript exceptions',errors);
})().catch(e=>{console.error(e);results.push({label:'runner completed',passed:false,error:String(e)});process.exitCode=1}).finally(()=>{fs.writeFileSync(path.join(out,'story-words-checks.json'),JSON.stringify({base,results,measurements,errors},null,2));if(results.some(r=>!r.passed))process.exitCode=1;clearTimeout(deadline);ws?.close();chrome.kill()});
