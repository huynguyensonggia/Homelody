const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const base = process.env.PERF_URL || 'http://localhost:8015/';
const label = process.env.PERF_LABEL || 'current';
const output = path.resolve('reports/performance'); fs.mkdirSync(output, {recursive:true});
const chrome = spawn(process.env.CHROME_BIN || 'C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe', ['--headless','--disable-gpu','--remote-debugging-port=9245',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-perf-'))}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r,ms));
let ws, id=0; const pending=new Map();
function call(method,params={}) { return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));}); }
async function ev(expression) { const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value; }
const observer = `window.__perf={shifts:[],lcp:[]};new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__perf.shifts.push({t:e.startTime,v:e.value,y:scrollY,nodes:e.sources.map(s=>({node:s.node?.className||s.node?.nodeName,from:s.previousRect.toJSON(),to:s.currentRect.toJSON()}))})})).observe({type:'layout-shift',buffered:true});new PerformanceObserver(list=>list.getEntries().forEach(e=>window.__perf.lcp.push({t:e.startTime,size:e.size,url:e.url,node:e.element?.className}))).observe({type:'largest-contentful-paint',buffered:true});`;
const deadline=setTimeout(()=>{chrome.kill();process.exit(2)},180000);
(async()=>{
  let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://localhost:9245/json')).json();break}catch{await sleep(150)}}
  ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let requests={}, failures=[], exceptions=[];
  ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}
    if(m.method==='Fetch.requestPaused'){
      const fixture=JSON.parse(fs.readFileSync(path.join(output,'live-data.json'),'utf8'));
      const body=m.params.request.url.includes('/drinks?')?fixture.drinks:fixture.shop;
      call('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'apikey,authorization,content-type'},{name:'Access-Control-Allow-Methods',value:'GET,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')}).catch(console.error);
    }
    if(m.method==='Network.responseReceived'){const r=m.params.response;requests[m.params.requestId]={url:r.url,status:r.status,mime:r.mimeType};}
    if(m.method==='Network.loadingFinished'&&requests[m.params.requestId])requests[m.params.requestId].bytes=m.params.encodedDataLength;
    if(m.method==='Network.loadingFailed'&&!m.params.canceled)failures.push(m.params);
    if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params);
  });
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:observer});
  if(process.env.PERF_FIXTURE==='1') await call('Fetch.enable',{patterns:[{urlPattern:'*/rest/v1/*'}]});
  const results=[];
  for(const width of (process.env.PERF_WIDTH?[Number(process.env.PERF_WIDTH)]:[390,1440])){
    requests={};failures=[];exceptions=[];
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    if(process.env.PERF_THROTTLE==='1') await call('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:100000});
    await call('Page.navigate',{url:base});await sleep(12000);
    const initial=await ev(`({lcp:window.__perf.lcp.at(-1),shifts:window.__perf.shifts.slice(),source:document.documentElement.dataset.menuSource})`);
    const total=process.env.PERF_INITIAL_ONLY==='1'?0:await ev('document.documentElement.scrollHeight');
    for(let y=0;y<Math.min(total,20000);y+=600){await ev(`scrollTo({top:${y},behavior:'instant'})`);await sleep(400);}
    if(total) await sleep(process.env.PERF_THROTTLE==='1'?18000:3500);
    const page=await ev(`({...window.__perf,images:[...document.images].map(i=>({src:i.currentSrc,w:i.naturalWidth,h:i.naturalHeight,displayWidth:i.clientWidth,displayHeight:i.clientHeight,width:i.getAttribute('width'),height:i.getAttribute('height')})),overflow:document.documentElement.scrollWidth>innerWidth})`);
    let max=0,sum=0,first=0,last=0;for(const s of page.shifts){if(s.t-last>1000||s.t-first>5000){sum=0;first=s.t;}sum+=s.v;max=Math.max(max,sum);last=s.t;}
    const result={width,initial,cls:max,...page,bytes:Object.values(requests).reduce((n,r)=>n+(r.bytes||0),0),requests:Object.values(requests).sort((a,b)=>(b.bytes||0)-(a.bytes||0)),failures,exceptions};
    results.push(result);fs.writeFileSync(path.join(output,`${label}.json`),JSON.stringify(results,null,2));
    if(process.env.PERF_FIXTURE==='1'&&initial.source!=='live')throw Error('Expected public-data fixture, received fallback');
    if(page.overflow||exceptions.length)throw Error('Overflow or JavaScript exception');
    if(page.images.some(i=>!i.width||!i.height))throw Error('Image without reserved dimensions');
    if(result.requests.some(r=>r.url.startsWith(base)&&r.status>=400))throw Error('Local asset failed to load');
    if(process.env.PERF_SCREENSHOT==='1'){
      for(const selector of ['#top','#do-uong','#cau-chuyen','#khong-gian','#thuc-don']){
        await ev(`document.querySelector('${selector}').scrollIntoView({behavior:'instant',block:'start'})`);await sleep(800);
        const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${label}-${width}-${selector.slice(1)}.png`),Buffer.from(shot.data,'base64'));
      }
    }
    console.log(JSON.stringify({width,cls:max,lcp:initial.lcp,bytes:result.bytes,requests:result.requests.length,shifts:page.shifts.length,source:initial.source,failures:failures.length,exceptions:exceptions.length}));
    await call('Page.navigate',{url:'about:blank'});await sleep(200);
  }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{clearTimeout(deadline);ws?.close();chrome.kill()});
