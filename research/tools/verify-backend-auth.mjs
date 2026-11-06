// Controlled execution of exact target functions only. Synthetic public fixtures;
// no extension startup, wallet, credential reuse, host network or real signing.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'evidences/re-evidence/40-backend-api/2026-10-21');
const raw=fs.readFileSync(path.join(root,'evidences/extension/samples/trustwallet-extension/26.41.0_0/26.41.0_0/background.js'));
const d=JSON.parse(fs.readFileSync(path.join(out,'discovery.json'))),f=JSON.parse(fs.readFileSync(path.join(out,'focus-ranges.json')));
const ranges=[...d.inputs,...f.inputs].flatMap(x=>x.ranges),names=['sortQueryParams','authenticationInterceptor','parseApiGatewayUrl','isFirstPartyRpcHost'];
const selected=names.map(name=>{const r=ranges.find(x=>x.name===name);assert(r,`missing ${name}`);return {name,...r};});
const device='synthetic-device',key=Buffer.alloc(32),nonce='00000000-0000-4000-8000-000000000000',date='Wed, 21 Oct 2026 00:00:00 GMT';
const state={app:{deviceId:device,hashKey:key}};
const ctx=vm.createContext({URL,URLSearchParams,API_GATEWAY_ORIGIN:'https://gateway.us.trustwallet.com',FIRST_PARTY_RPC_DOMAINS:['trustwallet.com','twnodes.com'],store:{getState:()=>state},import_crypto_browserify$4:{createHmac:crypto.createHmac},crypto:{randomUUID:()=>nonce},Date:class{toUTCString(){return date;}}});
vm.runInContext(selected.map(r=>raw.subarray(r.start,r.end).toString()).join('\n'),ctx,{timeout:1000});
const checks=[];function test(name,fn){fn();checks.push({name,result:'pass'});}
test('duplicate query values retain order within sorted keys',()=>assert.equal(ctx.sortQueryParams('b=2&a=one+two&a=x%2Fy'),'a=one%20two&a=x%2Fy&b=2'));
const request={url:'https://gateway.us.trustwallet.com/v1/assets?b=2&a=1',method:'post',params:{ignored:3},headers:{},data:{synthetic:1}};
ctx.authenticationInterceptor(request);
const canonical=['POST','/v1/assets','a=1&b=2',device,nonce,date].join(';');
const expected=crypto.createHmac('sha256',key).update(canonical).digest('base64');
test('exact six-field canonical string and Base64 HMAC',()=>assert.equal(request.headers.Authorization,`HMAC-SHA256 Signature=${expected}`));
test('body is not included in this client signature',()=>{const b={...request,headers:{},data:{different:2}};ctx.authenticationInterceptor(b);assert.equal(b.headers.Authorization,request.headers.Authorization);});
test('gateway origin guard excludes a suffix-lookalike host',()=>{const r={url:'https://gateway.us.trustwallet.com.invalid/v1/assets',method:'get',headers:{}};ctx.authenticationInterceptor(r);assert.equal(r.headers.Authorization,undefined);});
test('missing device credentials leave request unsigned',()=>{state.app={};const r={url:'https://gateway.us.trustwallet.com/v1/assets',method:'get',headers:{}};ctx.authenticationInterceptor(r);assert.equal(r.headers.Authorization,undefined);state.app={deviceId:device,hashKey:key};});
test('X-Origin helper accepts exact domain and true subdomains only',()=>{assert.equal(ctx.isFirstPartyRpcHost('https://ethereum.twnodes.com/a'),true);assert.equal(ctx.isFirstPartyRpcHost('https://twnodes.com.invalid/a'),false);});
fs.writeFileSync(path.join(out,'auth-fixtures.json'),JSON.stringify({method:'controlled execution of four exact target functions in node:vm, explicit local synthetic dependencies; not full extension runtime or server acceptance',targetSha256:crypto.createHash('sha256').update(raw).digest('hex'),environment:{node:process.version,platform:process.platform,arch:process.arch},syntheticInputs:{keyEncoding:'32 all-zero bytes; synthetic public fixture, not a captured credential',device,nonce,date,request:{url:request.url,method:request.method,params:request.params}},canonical,syntheticSignature:expected,sourceRanges:selected,checks,limitations:['Crypto-browserify is replaced by Node HMAC for this controlled slice; no claim of full dependency/runtime equivalence.','No actual device registration, server clock policy, nonce replay enforcement or network request tested.','Only ASCII query-key ordering exercised; locale-sensitive non-ASCII sorting remains untested.']},null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,result:'pass'}));
