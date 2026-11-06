import pkg from '/opt/npm-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs';
const EXT='/root/re-work/trust-ext/src/26.41.0_0', USERDIR='/root/re-work/runtime/profile';
fs.rmSync(USERDIR,{recursive:true,force:true});
const log=(...a)=>console.log('[RT]',...a);
const ctx=await chromium.launchPersistentContext(USERDIR,{headless:false,args:[`--disable-extensions-except=${EXT}`,`--load-extension=${EXT}`,'--no-sandbox']});
let sw=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker',{timeout:30000});
const extId=sw.url().split('/')[2];
const page=await ctx.newPage();
await page.goto(`chrome-extension://${extId}/home.html#/onboarding`,{waitUntil:'networkidle',timeout:30000}).catch(()=>{});
await page.waitForFunction(()=>{const l=document.getElementById('initial-loader');return !l||l.classList.contains('tw-initial-loader--hidden');},{timeout:20000}).catch(()=>{});
await page.waitForTimeout(2000);
const store=async(tag)=>{const s=await page.evaluate(async()=>await chrome.storage.local.get(null));const keys=Object.keys(s);log(`[store:${tag}]`,JSON.stringify(keys));return s;};
await page.locator('input[type=checkbox]').first().check().catch(()=>{});
await page.getByText('Create new wallet',{exact:true}).click().catch(()=>{});
await page.waitForTimeout(2500);
await page.getByRole('button',{name:'Password'}).first().click().catch(e=>log('pw-intro',e.message));
await page.waitForTimeout(3000);
// now on Create password step — dump all field-like elements
const fields=await page.evaluate(()=>[...document.querySelectorAll('input,textarea,[contenteditable="true"]')].map((e,i)=>({i,tag:e.tagName,type:e.type,ph:e.placeholder,testid:e.getAttribute('data-testid')})));
log('create-pw fields:',JSON.stringify(fields));
const pw='TestThrowaway#2026REA';
const all=page.locator('input, textarea, [contenteditable="true"]');
const n=await all.count(); log('field count:',n);
for(let i=0;i<Math.min(n,2);i++){ await all.nth(i).click().catch(()=>{}); await page.keyboard.type(pw,{delay:15}).catch(()=>{}); await page.waitForTimeout(300); }
await page.waitForTimeout(500);
// continue
let clicked=false;
for(const nm of ['generic.continue','Continue','Next']){ const b=page.getByRole('button',{name:nm}); if(await b.count()&&await b.first().isEnabled().catch(()=>false)){await b.first().click().catch(()=>{});log('clicked',nm);clicked=true;break;} }
if(!clicked) log('no continue enabled');
await page.waitForTimeout(3000);
log('screen2:',await page.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,160)));
// step 2 may repeat confirm or biometrics; try continue again
for(const nm of ['generic.continue','Continue','Next','Done','Skip']){ const b=page.getByRole('button',{name:nm}); if(await b.count()&&await b.first().isEnabled().catch(()=>false)){await b.first().click().catch(()=>{});log('clicked2',nm);break;} }
await page.waitForTimeout(5000);
const s=await store('after-full-create');
// structure dump
const struct={}; for(const k of Object.keys(s)){ const v=s[k]; struct[k]= (v&&typeof v==='object')?Object.keys(v):String(v).slice(0,50); }
fs.writeFileSync('/root/re-work/runtime/vault-final.json',JSON.stringify(s,(k,v)=>v,2));
log('final structure:',JSON.stringify(struct).slice(0,500));
// if trust:store has vault, show its subkeys
if(s['trust:store']){ log('trust:store subkeys:',JSON.stringify(Object.keys(s['trust:store']))); }
await ctx.close(); log('done');
