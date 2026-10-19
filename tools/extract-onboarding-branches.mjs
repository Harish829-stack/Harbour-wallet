import fs from 'node:fs';import crypto from 'node:crypto';import {parse} from './toolchain/node_modules/@babel/parser/lib/index.js';
const dir='evidence/02-onboarding-flow/2026-10-16-branches/';const manifest=[];
for(const file of ['import-qr-nu_XkZeU.js','Completed-5mEUoaUY.js','biometrics-CO4_TFG1.js']){
 const original='artifacts/reference-26.41.0/chunks/'+file,src=fs.readFileSync(original,'utf8'),ast=parse(src,{sourceType:'module'});let text='',ranges=[];
 for(const n of ast.program.body){const nodes=n.type==='VariableDeclaration'?n.declarations:n.type==='FunctionDeclaration'?[n]:[];
 for(const d of nodes){const t=src.slice(d.start,d.end);if(!/formatMessage|setCurrentStep|currentFlow|currentStep|setCurrentFlow/.test(t))continue;
 const prefix=d.type==='VariableDeclarator'?'const ':'';text+=prefix+t+';\n';ranges.push({start:Buffer.byteLength(src.slice(0,d.start)),end:Buffer.byteLength(src.slice(0,d.end)),prefix,suffix:';\n'});}}
 fs.writeFileSync(dir+'inputs/'+file,text);manifest.push({original,sha256:crypto.createHash('sha256').update(src).digest('hex'),input:file,ranges,bytes:Buffer.byteLength(text)});
}
fs.writeFileSync(dir+'source-ranges.json',JSON.stringify(manifest,null,2));console.log(manifest.map(m=>({file:m.input,bytes:m.bytes})));
