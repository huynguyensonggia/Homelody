const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {spawn} = require('node:child_process');
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless','--disable-gpu','--remote-debugging-port=9256',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-filter-'))}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
const delay = ms => new Promise(r=>setTimeout(r,ms));
let ws, id=0; const pending=new Map(), results=[], errors=[];
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const timeout=setTimeout(()=>{chrome.kill();process.exit(2)},55000);
(async()=>{
 let tabs;for(let i=0;i<40;i++){try{tabs=await(await fetch('http://127.0.0.1:9256/json')).json();break;}catch{await delay(100);}}
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params);});
 await call('Page.enable');await call('Runtime.enable');
 const fixture=JSON.parse(fs.readFileSync('reports/performance/live-data.json','utf8'));
 fixture.drinks.push({id:'mobile-bakery-fixture',name:'Bánh sừng bò',category:'Bánh',price:35000,description:'Bánh thơm bơ.',image_url:'assets/images/drink-iced-latte.webp',is_active:true,sort_order:100});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:require('../scripts/demo-config.cjs')+'\nlocalStorage.setItem("homelody:admin-demo",'+JSON.stringify(JSON.stringify({drinks:fixture.drinks}))+');'});
 for(const width of [320,390,767,768,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
  await call('Page.navigate',{url:'http://127.0.0.1:8017/'});
  for(let i=0;i<80;i++){if(await ev('!!document.querySelector("#menu-category")'))break;await delay(50);}
  if (!await ev('!!document.querySelector("#menu-category")')) throw Error(await ev('document.location.href + document.body.innerText.slice(0,800)'));
  await ev('document.fonts.ready');
  const initial=await ev(`(()=>{const s=document.querySelector('#menu-category'),t=document.querySelector('.menu-tabs');return {selectVisible:s.getBoundingClientRect().height>0,tabsVisible:t.getBoundingClientRect().height>0,options:s.options.length,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
  if(initial.selectVisible!==(width<768)||initial.tabsVisible!==(width>=768)||initial.overflow||initial.options<8)throw Error('Layout: '+JSON.stringify({width,initial}));
  await ev(`(()=>{const s=document.querySelector('#menu-category');s.selectedIndex=[...s.options].findIndex(o=>o.textContent.startsWith('Bánh'));s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(320);
  const selected=await ev(`(()=>{const s=document.querySelector('#menu-category');return {name:s.selectedOptions[0].textContent,count:document.querySelectorAll('#menu-panel .menu-item').length,heading:document.querySelector('#menu-panel .menu-group__vi').textContent,selectedTab:document.querySelector('.menu-tab[aria-selected="true"]').textContent};})()`);
  if(!selected.heading.startsWith('Bánh')||selected.count!==Number(selected.name.match(/\((\d+)\)$/)[1])||selected.selectedTab!==selected.heading)throw Error('Filter: '+JSON.stringify(selected));
  await ev(`(()=>{const s=document.querySelector('#menu-category');s.selectedIndex=[...s.options].findIndex(o=>o.textContent.startsWith('Cà phê Việt'));s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(320);
  const layout=await ev(`(()=>{const l=document.querySelector('#menu-panel .menu-list'),a=l.children[0].getBoundingClientRect(),b=l.children[1].getBoundingClientRect();return {horizontal:l.scrollWidth>l.clientWidth,sameRow:Math.abs(a.top-b.top)<2,cardRatio:a.width/l.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
  if(layout.horizontal!==(width<768)||!layout.sameRow||layout.overflow||(width<768&&Math.abs(layout.cardRatio-.88)>.01))throw Error('Filtered layout: '+JSON.stringify({width,layout}));
  if(width<768){
    await ev(`document.querySelector('#menu-panel [data-menu-next]').click()`);await delay(500);
    if(!await ev(`document.querySelector('#menu-panel .menu-list').scrollLeft>100`))throw Error('Next card does not scroll');
    await ev(`document.querySelector('#menu-panel [data-menu-prev]').click()`);await delay(500);
    if(await ev(`document.querySelector('#menu-panel .menu-list').scrollLeft`)>1)throw Error('Previous card does not return');
  }
  await ev(`document.querySelector('#thuc-don').scrollIntoView({behavior:'instant'})`);await delay(300);
  if(width===390||width===1440){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync('reports/mobile-menu-'+width+'.png',Buffer.from(shot.data,'base64'));}
  await ev(`document.querySelector('#menu-tab-0').click()`);await delay(320);
  if(await ev('document.querySelector("#menu-category").value')!=='0')throw Error('Tab/select sync');
  results.push({width,...initial,selected,layout});
 }
 if(errors.length)throw Error('Browser exceptions');
 console.log(JSON.stringify(results,null,2));
 fs.writeFileSync('reports/mobile-menu-checks.json',JSON.stringify({results,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clearTimeout(timeout);ws?.close();chrome.kill();});

