// Build human-readable catalogues from inert AST observations and REA outputs.
import fs from 'node:fs';import path from 'node:path';
import {parse} from './toolchain/node_modules/@babel/parser/lib/index.js';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'evidences/re-evidence/40-backend-api/2026-10-21');
const discovery=JSON.parse(fs.readFileSync(path.join(out,'discovery.json'))),har=JSON.parse(fs.readFileSync(path.join(out,'har-contracts.json')));
const supplement=JSON.parse(fs.readFileSync(path.join(out,'static-supplement.json')));
const locations=new Set(discovery.endpoints.map(x=>x.file+':'+x.start));
const allPaths=[...discovery.endpoints,...supplement.paths.filter(x=>!locations.has(x.file+':'+x.start))];
const esc=s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
const methods=[],recoveries=[];
for(const dir of fs.readdirSync(path.join(out,'recovery')).sort()){
 const f=path.join(out,'recovery',dir,'modules/bundle.js');if(!fs.existsSync(f))continue;
 const src=fs.readFileSync(f,'utf8');let ast;try{ast=parse(src,{sourceType:'unambiguous',plugins:['jsx']});}catch{continue;}
 const evidence=JSON.parse(fs.readFileSync(path.join(out,dir+'-rea.json')));recoveries.push({input:dir,evidenceId:evidence.evidence_id,status:evidence.normalized_result.status,file:path.relative(out,f)});
 const ancestors=[];
 function walk(n){if(!n||typeof n.type!=='string')return;
  if(n.type==='ClassMethod'){
   const c=ancestors.findLast(x=>['ClassDeclaration','ClassExpression'].includes(x.type));
   const name=c?.id?.name;
   if(name==='ApiService')methods.push({class:name,method:n.key.name||n.key.value,source:path.relative(out,f),line:n.loc.start.line,endLine:n.loc.end.line,evidenceId:evidence.evidence_id,code:src.slice(n.start,n.end)});
  }
  ancestors.push(n);for(const [k,v]of Object.entries(n)){if(['loc','start','end','extra','errors','comments','tokens'].includes(k))continue;if(Array.isArray(v))for(const x of v)walk(x);else if(v&&typeof v==='object')walk(v);}ancestors.pop();
 }walk(ast);
}
const unique=[...new Map(methods.map(m=>[m.method,m])).values()];
fs.writeFileSync(path.join(out,'client-methods.json'),JSON.stringify({scope:'Recovered ApiService methods only; not every HTTP call and not the server implementation. Names and code are recovered, runtime equivalence unknown.',methods:unique,recoveries},null,2)+'\n');
let md='# Recovered API client contracts — supplied v26.41.0\n\n[certain, CODE-CONFIRMED] Exact method bodies below are extracted from REA/Wakaru recovered output. See source locations, original byte mappings in discovery.json, and REA manifests. Synthetic recovery names and runtime equivalence remain unknown. Public methods being bundled does not establish UI reachability. Decorators and interceptors can alter error/retry behavior; see the main backend document.\n\n';
for(const m of unique)md+=`## ${m.method}\n\nSource: [${m.source}:${m.line}](${m.source}#L${m.line}); Evidence \`${m.evidenceId}\`.\n\n\`\`\`javascript\n${m.code}\n\`\`\`\n\n`;
fs.writeFileSync(path.join(out,'CLIENT-CONTRACTS.md'),md);
let cat='# API catalogue — static and historical observations\n\nThis is a bounded inventory, not proof that every bundled API is enabled or that every possible runtime endpoint is known. No recorded URL was fetched. Source target: supplied v26.41.0. Captures have historical, unverified runtime attribution.\n\n## Historical HTTP routes\n\n[OBSERVED-ONLY] All 237 host/method/templated-path groups, including unrelated browser resources, are retained below so capture scope is auditable. Different query strings share a route. Template normalization is lossy and does not establish a server router. See HAR-SCHEMAS.md and har-contracts.json for shapes, variants, source ordinals, MIME types, header names and status counts.\n\n| # | Method | Host | Templated path | Query keys | Count | Status counts |\n|---|---|---|---|---|---|---|\n';
har.contracts.forEach((c,i)=>cat+=`| ${i+1} | ${c.method} | ${c.host} | \`${esc(c.path)}\` | ${esc(c.queryKeys.join(', '))} | ${c.count} | ${esc(JSON.stringify(c.statuses))} |\n`);
cat+='\n## Historical JSON-RPC methods\n\n[OBSERVED-ONLY] The following records name an RPC method; HTTP success does not prove the RPC response was successful. Parameters and response shapes are in the contract JSON.\n\n| Host | RPC method | Occurrences |\n|---|---|---|\n';
for(const c of har.rpcMethods)cat+=`| ${c.host} | \`${c.method}\` | ${c.count} |\n`;
cat+='\n## Static path literal candidates\n\n[Discovery only] Every selected path-literal occurrence is retained, including SDK internals, duplicates in background/UI, templates, paths not proven to be HTTP, and documentation examples. Original zero-based UTF-8 byte offsets are supplied. An owner label is a discovery aid, not proof of a request method or reachable caller. Decimal API versions are supplemented in static-supplement.json. No HTTP method is guessed from a name.\n\n| File | Original byte start | Owner | Literal / template |\n|---|---|---|---|\n';
for(const r of allPaths)cat+=`| ${r.file} | ${r.start} | ${esc(r.owner)} | \`${esc(r.value)}\` |\n`;
fs.writeFileSync(path.join(out,'API-CATALOG.md'),cat);
// Human shape notation deliberately makes no requiredness or validation claims.
function shape(s,depth=0){if(!s)return 'UNKNOWN';if(depth>10)return '…';if(s.type==='object')return '{ '+Object.entries(s.properties).map(([k,v])=>`${k}: ${shape(v,depth+1)}`).join(', ')+' }';if(s.type==='array')return 'Array<'+(s.itemVariants.length?s.itemVariants.map(v=>shape(v,depth+1)).join(' | '):'UNKNOWN item; empty in capture')+'>';return s.type;}
let schemas='# Historical request / response shapes\n\n[OBSERVED-ONLY] Values are removed. These are observed shapes, not server validation schemas. Field requiredness, bounds, enums, empty-array item types and absent fields are UNKNOWN. All original shape variants, observed array lengths, truncation counts and record references are in har-contracts.json. Repeated equivalent shape text is collapsed below. NDJSON lines are represented as an analysis array, never a claim of a JSON-array wire response. Unparseable/non-JSON bodies are not retained. Header names never contain credential values.\n\n';
har.contracts.forEach((c,i)=>{schemas+=`## ${i+1}. ${c.method} ${c.host}${c.path}\n\nQuery keys: ${c.queryKeys.join(', ')||'none recorded'}. Status counts: \`${JSON.stringify(c.statuses)}\`. MIME: ${c.mimeTypes.join(', ')||'UNKNOWN'}.\n\nRequest header names: ${c.requestHeaderNames.join(', ')}.\n\n`;for(const [label,variants]of [['Request',c.requestVariants],['Response',c.responseVariants]]){const v=[...new Set(variants.map(s=>shape(s)))];schemas+=`${label}:\n\n\`\`\`text\n${v.join('\nOR\n')||'UNKNOWN / no parseable JSON body retained'}\n\`\`\`\n\n`;}schemas+=`Record references: ${c.records.map(r=>r.source+':'+r.ordinal).join(', ')}.\n\n`;});
fs.writeFileSync(path.join(out,'HAR-SCHEMAS.md'),schemas);
console.log(JSON.stringify({clientMethods:unique.length,recoveries:recoveries.length,httpGroups:har.contracts.length,staticOccurrences:allPaths.length}));
