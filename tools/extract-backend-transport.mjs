import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parse} from './toolchain/node_modules/@babel/parser/lib/index.js';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'evidences/re-evidence/40-backend-api/2026-10-21');
const file='background.js',raw=fs.readFileSync(path.join(root,'evidences/extension/samples/trustwallet-extension/26.41.0_0/26.41.0_0',file)),src=raw.toString();
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const d=JSON.parse(fs.readFileSync(path.join(out,'discovery.json')));
const ranges=[],parts=[];let count=0;
const unsafe=s=>/createHmac\([^,]+,\s*['"]/.test(s)||/(?:defaultApiKey|apiKey|API_KEY|defaultProjectId|projectId|dsn|secret|token|appKey|hashKey)[\w$]*\s*[:=]\s*['"][^'"]{12,}/i.test(s);
// Salvage exact independent comma-sequence expressions; never rewrite sensitive literals.
for(const r of []){
 const text=raw.subarray(r.start,r.end).toString();let ast;try{ast=parse(text,{sourceType:'script'});}catch{continue;}
 const seq=ast.program.body[0]?.expression;
 if(seq?.type!=='SequenceExpression')continue;
 for(const n of seq.expressions){const exact=text.slice(n.start,n.end);if(unsafe(exact))continue;
  const start=r.start+Buffer.byteLength(text.slice(0,n.start)),end=r.start+Buffer.byteLength(text.slice(0,n.end));
  ranges.push({start,end,sha256:sha(exact),prefix:'',suffix:';\n'});parts.push(exact+';\n');count++;
 }
}
const ast=parse(src,{sourceType:'script'}),wanted=new Set(['init_realtimeStream_service','init_balanceStreamRetry','init_storage_service','init_naasRpcTimeout','init_naasSessionRecovery','init_naas_interceptor','init_isExpectedApiError','init_SafeMethod_decorator']);
const functions=new Set(['SafeMethod','isExpectedApiError','getHttpStatus']);
function walk(n){if(!n||typeof n.type!=='string')return;
 if((n.type==='VariableDeclarator'&&wanted.has(n.id?.name))||(n.type==='FunctionDeclaration'&&functions.has(n.id?.name))){
  const text=src.slice(n.start,n.end);if(!unsafe(text)){const prefix=n.type==='VariableDeclarator'?'var ':'';ranges.push({name:n.id.name,start:Buffer.byteLength(src.slice(0,n.start)),end:Buffer.byteLength(src.slice(0,n.end)),sha256:sha(text),prefix,suffix:';\n'});parts.push(prefix+text+';\n');}
 }
 for(const [k,v]of Object.entries(n)){if(['loc','start','end','extra','errors','comments','tokens'].includes(k))continue;if(Array.isArray(v))for(const x of v)walk(x);else if(v&&typeof v==='object')walk(v);}
}walk(ast);
// Bounded batches for recovery.
const inputs=[];let batch=[],rr=[],size=0,i=0;
function flush(){if(!batch.length)return;const name=`transport-${i++}.js`,text=batch.join('');fs.writeFileSync(path.join(out,'inputs',name),text);inputs.push({input:name,original:file,originalSha256:sha(raw),sha256:sha(text),bytes:Buffer.byteLength(text),ranges:rr});batch=[];rr=[];size=0;}
for(let i=0;i<parts.length;i++){if(size+parts[i].length>120000)flush();batch.push(parts[i]);rr.push(ranges[i]);size+=parts[i].length;}flush();
fs.writeFileSync(path.join(out,'transport-ranges.json'),JSON.stringify({method:'Inert AST extraction; exact expressions separated by synthetic semicolon/newline, variable declarators prefixed var. Whole expressions containing credential literals excluded. No target execution.',inputs},null,2)+'\n');
console.log(JSON.stringify(inputs.map(x=>({input:x.input,bytes:x.bytes,ranges:x.ranges.length}))));
