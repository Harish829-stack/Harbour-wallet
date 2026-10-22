// Exact target bytes for REA; parser selects complete top-level declarations.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from './toolchain/node_modules/@babel/parser/lib/index.js';
const original='evidences/extension/reference-26.41.0/chunks/import-qr-nu_XkZeU.js';
const dir='evidences/re-evidence/02-onboarding-flow/2026-10-16-qr-reader';
fs.mkdirSync(`${dir}/inputs`,{recursive:true});
const source=fs.readFileSync(original,'utf8');
const ast=parse(source,{sourceType:'module'});
const names=new Set(['isInRange','createQrSyncReader']);
let input='';const ranges=[];
for(const node of ast.program.body){
  if(node.type!=='FunctionDeclaration'||!node.id||!names.has(node.id.name))continue;
  const exact=source.slice(node.start,node.end);
  input+=`${exact}\n`;
  ranges.push({name:node.id.name,start:Buffer.byteLength(source.slice(0,node.start)),end:Buffer.byteLength(source.slice(0,node.end)),suffix:'\n'});
}
if(ranges.length!==2)throw Error(`Expected both QR reader functions; got ${ranges.length}`);
fs.writeFileSync(`${dir}/inputs/qr-reader-exact.js`,input);
fs.writeFileSync(`${dir}/source-ranges.json`,JSON.stringify({original,sha256:crypto.createHash('sha256').update(source).digest('hex'),input:'inputs/qr-reader-exact.js',inputSha256:crypto.createHash('sha256').update(input).digest('hex'),ranges,unresolvedImports:['cs.URDecoder','gunzipSync','strFromU8']},null,2)+'\n');
console.log(JSON.stringify({bytes:Buffer.byteLength(input),ranges}));
