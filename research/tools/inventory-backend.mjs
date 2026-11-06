// Inert source analysis only. Never execute/import any target code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parse} from './toolchain/node_modules/@babel/parser/lib/index.js';
const root=path.resolve(import.meta.dirname,'..');
const target=path.join(root,'evidences/extension/samples/trustwallet-extension/26.41.0_0/26.41.0_0');
const out=path.join(root,'evidences/re-evidence/40-backend-api/2026-10-21');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const files=[];function list(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())list(p);else if(p.endsWith('.js'))files.push(path.relative(target,p));}}list(target);
const report={method:'Babel inert AST discovery; candidates require REA recovery and inspection',rangeSemantics:'zero-based half-open UTF-8 bytes',files:[],endpoints:[],urls:[],sql:[],inputs:[],namedFunctions:[]};
for(const file of files){
 const src=fs.readFileSync(path.join(target,file),'utf8'), sha256=hash(src);
 const ast=parse(src,{sourceType:'unambiguous',errorRecovery:true});
 const picked=new Map();const stack=[];const named=[];
 const extra=[];let delta=0;
 for(const m of src.matchAll(/[^\x00-\x7f]/gu)){delta+=Buffer.byteLength(m[0])-m[0].length;extra.push([m.index+m[0].length,delta]);}
 const byte=n=>{let lo=0,hi=extra.length;while(lo<hi){const mid=(lo+hi)>>1;if(extra[mid][0]<=n)lo=mid+1;else hi=mid;}return n+(lo?extra[lo-1][1]:0);};
 function owner(){return stack.findLast(n=>['FunctionDeclaration','ClassDeclaration','VariableDeclarator','ExpressionStatement'].includes(n.type))||null;}
 function name(n){if(!n)return 'module';if(n.id?.name)return n.id.name;if(n.type==='ExpressionStatement')return src.slice(n.start,Math.min(n.start+100,n.end)).split('=')[0];return n.type;}
 function pick(n){if(n&&n.end-n.start<260000)picked.set(n.start,n);}
 function walk(n){
  if(!n||typeof n.type!=='string')return;
  if(n.type==='FunctionDeclaration')named.push(n);
  if(n.type==='StringLiteral'||n.type==='TemplateLiteral'){
   const value=n.type==='StringLiteral'?n.value:n.quasis.map(q=>q.value.cooked).join('${…}');
   const own=owner();
   if(typeof value==='string'&&value.length<1500&&(/\/(?:v[0-9]+|cosmos|cosmwasm|api|graphql|evmos|osmosis|feemarket|nft|balances|transactions|rpc|chains|assets|tickers|quotes|devices|discovery|address|status)(?:\/|\?|$)/.test(value)||/^https?:\/\//.test(value))){
    const record={file,sha256,start:byte(n.start),end:byte(n.end),value,owner:name(own),ownerStart:own?byte(own.start):null};
    if(/^https?:\/\//.test(value))report.urls.push(record);
    if(!/^https?:\/\//.test(value)||/\/(?:v\d|api)\//.test(value))report.endpoints.push(record);
    // Prefer complete enclosing modern init module, class or Kotlin function.
    const enclosing=stack.findLast(a=>a.type==='VariableDeclarator'&&a.id?.name?.startsWith('init_'))||own;
    pick(enclosing);
   }
   if(typeof value==='string'&&/^CREATE (?:TABLE|INDEX|UNIQUE INDEX)/.test(value)){report.sql.push({file,sha256,start:byte(n.start),end:byte(n.end),sql:value,owner:name(own)});pick(own);}
  }
  stack.push(n);
  for(const [key,v] of Object.entries(n)){if(['loc','start','end','extra','errors','comments','tokens'].includes(key))continue;if(Array.isArray(v))for(const c of v)walk(c);else if(v&&typeof v==='object')walk(v);}
  stack.pop();
 }
 walk(ast);
 // Include transport configuration, auth, DB bridge and endpoint-associated Kotlin function families.
 const families=new Set([...picked.values()].filter(n=>n.type==='FunctionDeclaration').map(n=>n.id.name.split('$')[0]).filter(n=>/Client|Service|Contract/.test(n)));
 for(const n of named){if(families.has(n.id.name.split('$')[0])||/^(authenticationInterceptor|unauthenticatedInterceptor|sortQueryParams|getFingerprintIdentifier|createIdentifier|generateTraceparent|isFirstPartyRpcHost|createHttpClient|.*Database.*|.*SqlJs.*)$/.test(n.id.name))pick(n);}
 const selected=[...picked.values()].sort((a,b)=>a.start-b.start).filter((n,i,a)=>!a.some((m,j)=>j!==i&&m.start<=n.start&&m.end>=n.end));
 let parts=[],ranges=[],size=0,idx=0;
 function flush(){if(!parts.length)return;const input=path.basename(file,'.js')+'-'+String(idx++).padStart(2,'0')+'.js';const text=parts.join('');fs.writeFileSync(path.join(out,'inputs',input),text);report.inputs.push({input,original:file,originalSha256:sha256,sha256:hash(text),bytes:Buffer.byteLength(text),ranges});parts=[];ranges=[];size=0;}
 for(const n of selected){const exact=src.slice(n.start,n.end),prefix=n.type==='VariableDeclarator'?'var ':'';const suffix=';\n';if(size+exact.length>150000)flush();ranges.push({name:name(n),start:byte(n.start),end:byte(n.end),sha256:hash(exact),prefix,suffix});parts.push(prefix+exact+suffix);size+=exact.length;}flush();
 report.files.push({file,sha256,bytes:Buffer.byteLength(src),selectedNodes:selected.length,parseErrors:ast.errors.length});
 report.namedFunctions.push(...named.filter(n=>/Client|Database|SqlDriver|Serializer|Authentication|HttpClient/.test(n.id.name)).map(n=>({file,name:n.id.name,start:byte(n.start),end:byte(n.end)})));
 console.log(file,selected.length);
}
fs.writeFileSync(path.join(out,'discovery.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'local-schema.sql'),report.sql.map(r=>`-- ${r.file} bytes ${r.start}..${r.end}; ${r.owner}\n${r.sql};`).join('\n\n')+'\n');
console.log(JSON.stringify({files:report.files.length,endpoints:report.endpoints.length,urls:report.urls.length,ddl:report.sql.length,inputs:report.inputs.map(i=>[i.input,i.bytes])}));
