"""Check the new handoff's exact-source mappings and REA output digests offline."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidences/re-evidence/40-backend-api/2026-10-21'
TARGET=ROOT/'evidences/extension/samples/trustwallet-extension/26.41.0_0/26.41.0_0'
sha=lambda b:hashlib.sha256(b).hexdigest()
records=[];inputs=[]
for name in ['discovery.json','focus-ranges.json','focus-extra-ranges.json','transport-ranges.json','database-ranges.json']:
    inputs.extend(json.loads((OUT/name).read_text())['inputs'])
source_cache={};range_count=0
for item in inputs:
    original=source_cache.setdefault(item['original'],(TARGET/item['original']).read_bytes())
    assert sha(original)==item['originalSha256'],item['original']
    parts=[]
    for r in item['ranges']:
        exact=original[r['start']:r['end']];assert sha(exact)==r['sha256'],r
        parts.append(r.get('prefix','').encode()+exact+r.get('suffix',';\n').encode());range_count+=1
    b=b''.join(parts);assert b==(OUT/'inputs'/item['input']).read_bytes(),item['input']
    assert sha(b)==item['sha256'],item['input']
for p in sorted(OUT.glob('*-rea.json')):
    e=json.loads(p.read_text())
    if e.get('operation')!='recover_javascript_sources':continue
    assert e['normalized_result']['status']=='complete',p.name
    assert e['normalized_result']['failed']==0,p.name
    for m in e['normalized_result']['modules']:
        a=m['artifact'];local=OUT/a['path'].removeprefix('/output/')
        assert sha(local.read_bytes())==a['sha256'],local
    n=p.name.removesuffix('-rea.json')
    assert sha((OUT/'inputs'/f'{n}.js').read_bytes())==e['subject']['digest']['sha256'],n
    records.append({'file':p.name,'evidenceId':e['evidence_id'],'status':'complete','modules':len(e['normalized_result']['modules'])})
e=json.loads((OUT/'har-rea-final.json').read_text());a=e['normalized_result']['artifact']
assert sha((OUT/'network-projection.har').read_bytes())==a['sha256']
h=json.loads((OUT/'har-contracts.json').read_text());assert len(h['contracts'])==237
assert sum(x['entries'] for x in h['sources'])==5216
assert any(c['path']=='/v2/devices/fingerprint' for c in h['contracts'])
old=json.loads((OUT/'har-rea-success.json').read_text());assert sha((OUT/'network-projection-before-fingerprint-correction.har').read_bytes())==old['normalized_result']['artifact']['sha256']
fixture=json.loads((OUT/'auth-fixtures.json').read_text());assert len(fixture['checks'])==6 and all(x['result']=='pass' for x in fixture['checks'])
errors=[]
for p in [ROOT/'docs/re/TRUST-WALLET-BACKEND.md',OUT/'README.md',OUT/'API-CATALOG.md',OUT/'CLIENT-CONTRACTS.md']:
    if not p.exists():continue
    for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        if '://' in target or target.startswith('#'):continue
        target=target.split('#')[0]
        if target and (p.parent/target).resolve()==OUT/'verification.json':continue # this run creates it below
        if target and not (p.parent/target).exists():errors.append({'file':str(p),'link':target})
assert not errors,errors
report={'status':'pass','sourceMappedInputs':len(inputs),'exactSourceRanges':range_count,'recoveryRuns':records,'historicalRecords':5216,'httpGroups':237,'authenticationChecks':6,'relativeLinks':'all checked links resolve','scope':'Integrity and bounded controlled-function checks; not full extension runtime, live APIs, UI parity or server equivalence.'}
(OUT/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='recoveryRuns'},indent=2))
