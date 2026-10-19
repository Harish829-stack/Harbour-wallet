// Extract literal illustration/validation data only; never execute shipped JS.
import { parse } from './toolchain/node_modules/@babel/parser/lib/index.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'artifacts/reference-26.41.0');
const out = path.join(root, 'harbour-wallet/public/reference');
mkdirSync(out, { recursive: true });
const hash = b => createHash('sha256').update(b).digest('hex');
function literal(n) {
  if (['StringLiteral','NumericLiteral','BooleanLiteral'].includes(n.type)) return n.value;
  if (n.type === 'NullLiteral') return null;
  if (n.type === 'ArrayExpression') return n.elements.map(literal);
  if (n.type === 'UnaryExpression' && n.operator === '-') return -literal(n.argument);
  if (n.type === 'UnaryExpression' && n.operator === '!') return !literal(n.argument);
  if (n.type === 'ObjectExpression') return Object.fromEntries(n.properties.map(p => {
    if (p.type !== 'ObjectProperty' || p.computed) throw new Error('Nonliteral property');
    return [p.key.name ?? p.key.value, literal(p.value)];
  }));
  throw new Error('Nonliteral asset node: ' + n.type);
}
const provenance = [];
for (const [filename, names] of [
  ['Globe--aAbxHdG.js',['globe']], ['Security-BkVC-Kss.js',['security']],
  ['authentication-CGHHMXIG.js',['lock']], ['SelectImportMethod-ClL8FjcB.js',['import']],
  ['Completed-5mEUoaUY.js',['empty-wallet','confetti','wallet-created']],
  ['import-qr-nu_XkZeU.js',['qr-mobile']],
]) {
  const src = readFileSync(path.join(target, 'chunks', filename), 'utf8');
  const ast = parse(src, { sourceType: 'module' }); let index = 0;
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const d of statement.declarations) {
      if (d.init?.type !== 'ObjectExpression' || !d.init.properties.some(p => p.key?.name === 'layers')) continue;
      const name = names[index++]; if (!name) throw new Error('Unmapped animation');
      const data = JSON.stringify(literal(d.init)); writeFileSync(path.join(out, name + '.json'), data + '\n');
      provenance.push({ output: 'public/reference/' + name + '.json', source: 'chunks/' + filename,
        source_sha256: hash(src), original_utf8_start: Buffer.byteLength(src.slice(0,d.init.start)),
        original_utf8_end: Buffer.byteLength(src.slice(0,d.init.end)), output_sha256: hash(data+'\n'), transform: 'AST literal serialization; no code execution' });
    }
  }
}
for (const filename of ['Inter-Regular-BpskOkD5.ttf','Inter-Medium-BtfNrkJj.ttf','Inter-SemiBold-C9_sHzqi.ttf','Inter-Bold-BVTOCPiq.ttf','pancakeswap-banner-DZpaafr7.png']) {
  copyFileSync(path.join(target,'assets',filename),path.join(out,filename));
  provenance.push({output:'public/reference/'+filename,source:'assets/'+filename,sha256:hash(readFileSync(path.join(out,filename))),transform:'byte-identical copy'});
}
const src = readFileSync(path.join(target,'chunks/useValidatePassword-Dn2iwOd-.js'),'utf8');
const ast = parse(src,{sourceType:'module'});
const arrays = ast.program.body.filter(s=>s.type==='VariableDeclaration').flatMap(s=>s.declarations).filter(d=>d.init?.type==='ArrayExpression' && d.init.elements.length>100);
if (arrays.length!==1) throw new Error('Ambiguous common-password list');
const data = JSON.stringify(literal(arrays[0].init),null,2)+'\n';
writeFileSync(path.join(root,'harbour-wallet/src/core/commonPasswords.json'),data);
provenance.push({output:'src/core/commonPasswords.json',source:'chunks/useValidatePassword-Dn2iwOd-.js',source_sha256:hash(src),output_sha256:hash(data),transform:'literal common-password policy data; not user credentials'});
writeFileSync(path.join(root,'evidence/02-onboarding-flow/2026-10-15-complete-pass/asset-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log('Extracted',provenance.length,'literal assets/policy records');
