import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const chrome=spawn('C:/Users/PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe',['--headless','--disable-gpu','--remote-debugging-port=9278',`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'homelody-hero-info-'))}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0; const pending=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const timer=setTimeout(()=>{chrome.kill();process.exit(2)},90000);
try {
let tab;for(let n=0;n<60;n++){try{tab=(await(await fetch('http://localhost:9278/json/list')).json())[0];break;}catch{await sleep(100);}}
ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});

async function poll(expression) { for(let n=0;n<120;n++){if(await ev(expression))return;await sleep(100);}throw Error('Timeout: '+expression); }
async function visit(suffix='') { await call('Page.navigate',{url:'http://localhost:8000/'+suffix});await poll(`!!document.querySelector('[data-featured-ready] .option')`);await ev('document.fonts.ready');await sleep(100); }
for(const lang of ['vi','en'])for(const width of [320,390,768,1024,1440]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await visit('?lang='+lang);
 const state=await ev(`(()=>{const elements=[...document.querySelector('.site-header__inner').children].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width),rects=elements.map(e=>e.getBoundingClientRect());return {lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth,overlap:rects.some((r,i)=>i&&r.left<rects[i-1].right-1),name:document.querySelector('[data-field=name]').textContent}})()`);
 if(state.lang!==lang||state.overflow||state.overlap)throw Error(JSON.stringify(state));
 console.log('PASS',lang,width,state.name);
 if(width===390){await ev(`document.querySelector('.nav-toggle').click()`);if(!await ev(`document.querySelector('.site-header').classList.contains('is-open')`))throw Error('Drawer failed');await ev(`document.querySelector('.nav-toggle').click()`);}
}
await visit();if(await ev('document.documentElement.lang')!=='en')throw Error('Remembered language failed');
await visit('?lang=vi');await visit();if(await ev('document.documentElement.lang')!=='vi')throw Error('Explicit language failed');
await visit('?lang=en');await ev(`document.querySelector('[data-open-drink]').click()`);await sleep(100);
if(!await ev(`document.querySelector('#drink-dialog').innerText.includes('Ingredients')`))throw Error('English dialog failed');
console.log('PASS language persistence and English dialog');
// All admin writes below are confined to the disposable browser demo.
await call('Network.setBlockedURLs',{urls:['*supabase.co*']});
await call('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'HOMELODY_CONFIG',{configurable:true,set(value){value.supabaseUrl='';value.supabaseKey='';Object.defineProperty(window,'HOMELODY_CONFIG',{value,writable:true,configurable:true});}});"});
await call('Page.navigate',{url:'http://localhost:8000/admin/'});await poll(`!!document.querySelector('#login:not([hidden])')`);
await ev(`document.querySelector('#login-form [name=email]').value='bilingual-test@example.com';document.querySelector('#login-form').requestSubmit()`);
await poll(`!!document.querySelector('[data-edit]')`);await ev(`document.querySelector('[data-edit]').click()`);
if(!await ev(`document.documentElement.lang==='vi'&&!document.querySelector('#english-fields').disabled`))throw Error('Admin language/schema readiness');
await ev(`(()=>{const f=document.querySelector('#drink-form');window.testId=f.closest('dialog').id;f.name_en.value='Test English Drink';f.description_en.value='English description from admin';f.note_en.value='One, Two, Three, Four';f.note_en.dispatchEvent(new Event('input'));if(f.note_en.validity.valid)throw Error('Four flavours accepted');f.note_en.value='One, Two, Three';f.note_en.dispatchEvent(new Event('input'));if(!f.note_en.validity.valid)throw Error('Three flavours rejected');f.requestSubmit();})()`);
await poll(`!document.querySelector('#editor').open`);
if(!await ev(`JSON.parse(localStorage.getItem('homelody:admin-demo')).drinks.some(d=>d.name_en==='Test English Drink'&&d.note_en==='One \u00b7 Two \u00b7 Three')`))throw Error('English not saved');
await visit('?lang=en');
if(!await ev(`[...document.querySelectorAll('.menu-card')].some(e=>e.textContent.includes('Test English Drink'))`))throw Error('Saved English not rendered');
console.log('PASS admin demo English save, three-flavour limit, public rendering');
}finally{clearTimeout(timer);ws?.close();chrome.kill();}
