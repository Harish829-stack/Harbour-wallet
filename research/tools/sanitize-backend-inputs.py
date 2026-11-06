"""Omit whole extracted nodes with embedded credential candidates; never rewrite source.
Run after inventory-backend.mjs and before REA. Retains hashes/ranges for omissions.
No original target or pre-existing evidence is modified.
"""
from pathlib import Path
import re,json,hashlib
root=Path(__file__).resolve().parents[1];p=root/'evidences/re-evidence/40-backend-api/2026-10-21'
d=json.loads((p/'discovery.json').read_text());excluded=d.get('excludedCredentialNodes',[])
for item in d['inputs']:
    original=(root/'evidences/extension/samples/trustwallet-extension/26.41.0_0/26.41.0_0'/item['original']).read_bytes()
    parts=[];ranges=[]
    for r in item['ranges']:
        exact=original[r['start']:r['end']];s=exact.decode()
        if 'dsn:' in r['name'] or re.search(r'createHmac\([^,]+,\s*[\'\"]',s) or re.search(r'(?:defaultApiKey|apiKey|API_KEY|defaultProjectId|projectId|dsn|secret|token|appKey|hashKey)[\w$]*\s*[:=]\s*[\'\"][^\'\"]{12,}',s,re.I):
            excluded.append({'input':item['input'],'name':r['name'].split('dsn:')[0],'start':r['start'],'end':r['end'],'reason':'omitted whole node containing embedded service credential candidate; no substituted source'})
            continue
        parts.append(r['prefix'].encode()+exact+r['suffix'].encode());ranges.append(r)
    raw=b''.join(parts);(p/'inputs'/item['input']).write_bytes(raw)
    item.update(ranges=ranges,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
for r in d['urls']+d['endpoints']:
    r['value']=re.sub(r'(https?://)[^/@\s]+@',r'\1{redactedUserInfo}@',r['value'])
    r['value']=re.sub(r'([?&][^=&]+)=[^&]*',r'\1={redactedValue}',r['value'])
d['excludedCredentialNodes']=excluded
(p/'discovery.json').write_text(json.dumps(d,indent=2)+'\n')
print('Excluded credential candidate nodes:',len(excluded))
