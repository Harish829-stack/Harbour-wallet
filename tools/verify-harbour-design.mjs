// Isolated development-fixture QA and vector icon export. Never connects to a wallet.
import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import React from '../harbour-wallet-v2/node_modules/react/index.js';
import {renderToStaticMarkup} from '../harbour-wallet-v2/node_modules/react-dom/server.node.js';
import {Anchor} from '../harbour-wallet-v2/node_modules/lucide-react/dist/cjs/lucide-react.js';
const root=path.resolve(import.meta.dirname,'..');process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'tools/browsers');const {chromium}=await import('./toolchain/node_modules/playwright/index.mjs');
const output=path.join(root,'audit/design/2026-10-16');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:path.join(root,'tools/browsers/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium'),headless:true});
const results=[];try{
 const iconPage=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
 const glyph=renderToStaticMarkup(React.createElement(Anchor,{size:80,color:'white',strokeWidth:1.6}));
 const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="35" fill="#145e50"/><g transform="translate(24 24)">${glyph}</g></svg>`;
 await writeFile(path.join(root,'harbour-wallet-v2/public-production/icons/harbour.svg'),icon);
 await iconPage.setContent(`<style>body{margin:0}svg{display:block;width:100%;height:100%}</style>${icon}`);
 for(const size of [16,32,48,128]){await iconPage.setViewportSize({width:size,height:size});await iconPage.screenshot({path:path.join(root,`harbour-wallet-v2/public-production/icons/icon${size}.png`),omitBackground:true});}await iconPage.close();
 const page=await browser.newPage({viewport:{width:1365,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/src/popup/index.html?design-preview');
 const menu=s=>page.locator('.hb-preview-tools').getByRole('button',{name:new RegExp('^'+s+'$','i')});await menu('portfolio').waitFor();await page.evaluate(()=>document.fonts.ready);
 for(const s of ['portfolio','send','approval','components','welcome']){await menu(s).click();await page.locator('.hb-preview-surface').screenshot({path:path.join(output,`${s}-desktop.png`)});results.push({case:s+' rendered',status:'captured, requires inspection'});}
 await menu('send').click();assert.equal(await page.getByRole('button',{name:'Review send',exact:true}).isEnabled(),false);const recipient=page.locator('.preview-form input').nth(0),amount=page.locator('.preview-form input').nth(1);await recipient.fill('invalid');assert.equal(await page.getByText('Enter a valid Ethereum address',{exact:true}).isVisible(),true);await recipient.fill('0x0000000000000000000000000000000000000001');await amount.fill('0.01');assert.equal(await page.getByRole('button',{name:'Review send',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'Review send',exact:true}).click();assert.equal(await page.getByRole('dialog').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);results.push({case:'form validation, review gating, dialog Escape',status:'pass'});
 await menu('approval').click();await page.getByRole('button',{name:'Reject',exact:true}).click();assert.equal(await page.getByRole('status').last().innerText(),'Preview request rejected.');results.push({case:'preview rejection feedback',status:'pass'});
 await page.setViewportSize({width:375,height:600});for(const s of ['portfolio','send','approval','welcome']){await menu(s).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`${s}-375x600.png`)});}results.push({case:'375x600 horizontal overflow (four fixture surfaces)',status:'pass'});
 assert.deepEqual(errors,[]);results.push({case:'browser page errors',status:'pass'});await writeFile(path.join(output,'checks.json'),JSON.stringify({browser:browser.version(),scope:'development fixtures only; no extension integration or target parity claim',results},null,2)+'\n');console.log(JSON.stringify({output,checks:results.length,errors:errors.length}));
}finally{await browser.close();}
