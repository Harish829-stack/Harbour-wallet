// Inert AST discovery. Never imports or executes reference code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from './toolchain/node_modules/@babel/parser/lib/index.js';
const root=path.resolve(import.meta.dirname,'..');
const sourceRoot=path.join(root,'evidences/extension/reference-26.41.0');
const out=path.join(root,'evidences/re-evidence/00-screen-structure/2026-10-16');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const files=fs.readdirSync(path.join(sourceRoot,'chunks')).filter(f=>f.endsWith('.js')).map(f=>'chunks/'+f);
const result={baseline:'26.41.0',method:'Babel inert AST candidate extraction; REA recovery required for claims',files:[],routes:[],indexRoutes:[],navigation:[],recoveryInputs:[],limitations:['Route candidates do not prove reachability or enabled behavior.','State machines, dialogs and dynamic destinations require recursive code and runtime investigation.','Background bundle is excluded from this pass.']};
for(const file of files){
 const src=fs.readFileSync(path.join(sourceRoot,file),'utf8');
 const ast=parse(src,{sourceType:'module'});
 const hash=digest(src);let routes=[];
 function walk(n,anc=[]){if(!n||typeof n!=='object')return;
  if(n.type==='ObjectExpression'&&n.properties.some(p=>p.key?.name==='index')&&n.properties.some(p=>p.key?.name==='element')){const o=[...anc].reverse().find(a=>a.type==='FunctionDeclaration'||a.type==='VariableDeclarator');const el=n.properties.find(p=>p.key?.name==='element');result.indexRoutes.push({file,sha256:hash,offset:Buffer.byteLength(src.slice(0,n.start)),owner:o?.id?.name||'anonymous',element:src.slice(el.value.start,el.value.end)});}
  if(n.type==='ObjectProperty'&&['path','to'].includes(n.key.name||n.key.value)&&n.value.type==='StringLiteral'){
   const owner=[...anc].reverse().find(a=>a.type==='FunctionDeclaration'||a.type==='VariableDeclarator');
   const obj=anc.at(-1);const fields=obj?.properties||[];const el=fields.find(p=>p.key?.name==='element');
   const r={file,sha256:hash,offset:Buffer.byteLength(src.slice(0,n.start)),end:Buffer.byteLength(src.slice(0,n.end)),owner:owner?.id?.name||'anonymous',value:n.value.value,element:el?src.slice(el.value.start,el.value.end):null,conditions:anc.filter(a=>['LogicalExpression','ConditionalExpression'].includes(a.type)).map(a=>src.slice(a.start,Math.min(a.start+180,a.end))),status:'code-discovered',runtime:'unverified'};
   if((n.key.name||n.key.value)==='path'){result.routes.push(r);routes.push({r,anc});}else result.navigation.push(r);
  }
  for(const [k,v] of Object.entries(n)){if(['loc','start','end','extra'].includes(k))continue;if(Array.isArray(v))for(const c of v)walk(c,[...anc,n]);else if(v&&typeof v==='object')walk(v,[...anc,n]);}
 }
 walk(ast);
 result.files.push({file,sha256:hash,bytes:Buffer.byteLength(src),routeCandidates:routes.length});
 if(routes.length){
  // Select complete enclosing functions/declarators, retaining exact original source.
  const picked=new Map();
  for(const {anc} of routes){const owner=anc.find(a=>a.type==='FunctionDeclaration'||a.type==='VariableDeclarator');if(owner)picked.set(owner.start,owner);}
  let joined='';let ranges=[];
  for(const n of picked.values()){
   const prefix=n.type==='VariableDeclarator'?'const ':'';const text=src.slice(n.start,n.end);
   ranges.push({start:Buffer.byteLength(src.slice(0,n.start)),end:Buffer.byteLength(src.slice(0,n.end)),prefix,suffix:';\n',sha256:digest(text)});joined+=prefix+text+';\n';
  }
  const filename=path.basename(file).replace('.js','-routes.js');
  fs.writeFileSync(path.join(out,'inputs',filename),joined);
  result.recoveryInputs.push({file:filename,original:file,originalSha256:hash,sha256:digest(joined),ranges,bytes:Buffer.byteLength(joined)});
 }
}
fs.writeFileSync(path.join(out,'discovery.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({files:result.files.length,routes:result.routes.length,navigation:result.navigation.length,inputs:result.recoveryInputs.map(i=>({file:i.file,bytes:i.bytes}))},null,2));
