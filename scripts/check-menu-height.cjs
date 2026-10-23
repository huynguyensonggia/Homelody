const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const chrome=spawn(process.env.CHROME_BIN||'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe',['--headless','--disable-gpu','--remote-debugging-port=9231',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-menu-height-'))}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0;const pending=new Map(),results=[],errors=[],measurements=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
function check(ok,label,detail){results.push({label,passed:!!ok,...(detail===undefined?{}:{detail})});console.log((ok?'PASS ':'FAIL ')+label+(detail===undefined?'':' '+JSON.stringify(detail)))}
const deadline=setTimeout(()=>{chrome.kill();process.exit(2)},45000);
const state=`(()=>{const m=document.querySelector('#thuc-don'),p=document.querySelector('#menu-panel'),next=m.nextElementSibling,last=Math.max(...[...p.querySelectorAll('.menu-item')].map(e=>e.getBoundingClientRect().bottom)),s=getComputedStyle(m),selected=document.querySelector('.menu-tab[role="tab"][aria-selected="true"]');return {count:p.querySelectorAll('.menu-item').length,height:p.offsetHeight,minHeight:p.style.minHeight,selected:selected.textContent,label:p.getAttribute('aria-labelledby'),selectedId:selected.id,padding:parseFloat(s.paddingBottom),gap:next.getBoundingClientRect().top-last,unexplainedGap:next.getBoundingClientRect().top-last-parseFloat(s.paddingBottom),pageWidth:document.documentElement.scrollWidth,width:innerWidth}})()`;
async function click(label){await ev(`[...document.querySelectorAll('.menu-tab[role="tab"]')].find(t=>t.textContent===${JSON.stringify(label)}).click()`);await sleep(350)}
(async()=>{
 let tabs;for(let i=0;i<40;i++){try{tabs=await(await fetch('http://localhost:9231/json')).json();break}catch{await sleep(150)}}
 ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}});
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 const drinks=Array.from({length:13},(_,i)=>({id:'height-fixture-'+i,name:i===0?'Cà phê Việt kiểm tra':'Món kiểm tra '+i,category:i===0?'Cà phê Việt':i<9?'Trà':'Bánh',price:45000,description:'Món dùng trong kiểm tra chiều cao.',image_url:'assets/images/drink-iced-latte.webp',is_featured:i===0,is_active:true,sort_order:i}));
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('homelody:admin-demo',${JSON.stringify(JSON.stringify({drinks}))})`});
 for(const width of [1440,390]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://localhost:3000/'});
  for(let i=0;i<80;i++){if(await ev(`!!document.querySelector('#menu-panel')&&document.querySelectorAll('#menu-panel .menu-item').length===13`))break;await sleep(50)}
  await ev(`document.fonts.ready.then(()=>true)`);await ev(`document.querySelector('#thuc-don').scrollIntoView({behavior:'instant'})`);await sleep(200);
  const all=await ev(state);await click('Cà phê Việt');const one=await ev(state);measurements.push({width,all,one});
  check(one.count===1&&one.selected==='Cà phê Việt','single-item Vietnamese category '+width);
  check(one.height<all.height*.5&&!one.minHeight,'filtered panel shrinks to content '+width,{all:all.height,filtered:one.height,minHeight:one.minHeight});
  check(Math.abs(one.unexplainedGap)<3,'next section follows normal menu padding '+width,{gap:one.gap,padding:one.padding,extra:one.unexplainedGap});
  check(one.label===one.selectedId,'filtered panel remains labelled by selected tab '+width);
  await click('Tất cả');const restored=await ev(state);
  check(restored.count===13&&Math.abs(restored.height-all.height)<3,'All restores all items and natural height '+width);
  await ev(`(()=>{const tabs=[...document.querySelectorAll('.menu-tab[role="tab"]')];['Trà','Tất cả','Bánh','Cà phê Việt'].forEach(name=>tabs.find(t=>t.textContent===name).click())})()`);await sleep(350);const rapid=await ev(state);
  check(rapid.count===1&&rapid.selected==='Cà phê Việt'&&Math.abs(rapid.height-one.height)<3,'rapid switches leave final content and height correct '+width);
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await click('Tất cả');await click('Cà phê Việt');const reduced=await ev(state);
  check(reduced.count===1&&Math.abs(reduced.height-one.height)<3&&Math.abs(reduced.unexplainedGap)<3,'reduced-motion filtering shrinks correctly '+width);
  check(reduced.pageWidth<=width,'no horizontal overflow '+width);
  await call('Emulation.setEmulatedMedia',{features:[]});
 }
 check(errors.length===0,'no browser JavaScript exceptions',errors);
})().catch(e=>{console.error(e);results.push({label:'runner completed',passed:false,error:String(e)});process.exitCode=1}).finally(()=>{fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/menu-height-checks.json',JSON.stringify({results,measurements,errors},null,2));if(results.some(r=>!r.passed))process.exitCode=1;clearTimeout(deadline);ws?.close();chrome.kill()});
