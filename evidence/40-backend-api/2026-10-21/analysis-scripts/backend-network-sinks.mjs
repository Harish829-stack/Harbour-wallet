// A second inert AST pass: broader path strings and explicit HTTP construction.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {parse} from './toolchain/node_modules/@babel/parser/lib/index.js';
const root=path.resolve(import.meta.dirname,'..'),target=path.join(root,'samples/trustwallet-extension/26.41.0_0/26.41.0_0'),out=path.join(root,'evidence/40-backend-api/2026-10-21');
const files=JSON.parse(fs.readFileSync(path.join(out,'discovery.json'))).files.map(x=>x.file),paths=[],sinks=[];
function clean(s){return s.replace(/(https?:\/\/)[^/@\s]+@/g,'$1{redactedUserInfo}@').replace(/([?&][^=&]+)=[^&]*/g,'$1={redactedValue}');}
for(const file of files){const src=fs.readFileSync(path.join(target,file),'utf8'),ast=parse(src,{sourceType:'unambiguous'}),extra=[];let delta=0;
 for(const m of src.matchAll(/[^\x00-\x7f]/gu)){delta+=Buffer.byteLength(m[0])-m[0].length;extra.push([m.index+m[0].length,delta]);}
 const byte=n=>{let lo=0,hi=extra.length;while(lo<hi){const mid=(lo+hi)>>1;if(extra[mid][0]<=n)lo=mid+1;else hi=mid;}return n+(lo?extra[lo-1][1]:0);};
 const stack=[];function str(n){return n?.type==='StringLiteral'?clean(n.value):n?.type==='TemplateLiteral'?clean(n.quasis.map(x=>x.value.cooked).join('${…}')):null;}
 function walk(n){if(!n||typeof n.type!=='string')return;const value=str(n);
  if(value&&value.length<1500&&/(?:^|\/)v\d+(?:\.\d+)*\//.test(value)){paths.push({file,start:byte(n.start),end:byte(n.end),value,owner:stack.findLast(a=>a.type==='FunctionDeclaration')?.id?.name||stack.findLast(a=>a.type==='ClassMethod')?.key?.name||null});}
  if(n.type==='CallExpression'||n.type==='NewExpression'){
   let callee=n.callee?.name||((n.callee?.object?.name||'dynamic')+'.'+(n.callee?.property?.name||n.callee?.property?.value||'dynamic'));
   if(/^(?:fetch(?:\$\d+)?|WebSocket|XMLHttpRequest)$/.test(callee)||/\.(?:get|post|put|delete|patch|request)$/.test(callee)){
    sinks.push({file,start:byte(n.start),end:byte(n.end),callee,argumentCount:n.arguments.length,firstArgument:{syntax:n.arguments[0]?.type||null,literalOrTemplate:str(n.arguments[0]),identifier:n.arguments[0]?.type==='Identifier'?n.arguments[0].name:null},owner:stack.findLast(a=>a.type==='FunctionDeclaration')?.id?.name||stack.findLast(a=>a.type==='ClassMethod')?.key?.name||null,status:'syntactic candidate; collection.get and dynamic receivers can be false positives; method alone does not establish network'});
   }
  }
  stack.push(n);for(const[k,v]of Object.entries(n)){if(['loc','start','end','extra','errors','comments','tokens'].includes(k))continue;if(Array.isArray(v))for(const x of v)walk(x);else if(v&&typeof v==='object')walk(v);}stack.pop();
 }walk(ast);
}
fs.writeFileSync(path.join(out,'static-supplement.json'),JSON.stringify({method:'Inert Babel AST; original half-open UTF-8 byte ranges; includes decimal API versions. No target execution.',paths},null,2)+'\n');
fs.writeFileSync(path.join(out,'network-sinks.json'),JSON.stringify({method:'Inert syntax candidates only; unresolved/dynamic receiver identity; Ktor/minified DSL calls may not be recognizable by method names.',sinks},null,2)+'\n');
console.log(JSON.stringify({files:files.length,pathOccurrences:paths.length,syntacticSinkCandidates:sinks.length}));
