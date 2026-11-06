"""Allowlisted noncredential header observations; never infer an origin stack."""
from pathlib import Path
from urllib.parse import urlsplit
import json,re
root=Path(__file__).resolve().parents[1];out=root/'evidence/40-backend-api/2026-10-21'
file=root/'harbour-wallet-v2/E2E-network-log-trust-wallet.har'
har=json.loads(file.read_bytes());hints={}
for ordinal,e in enumerate(har['log']['entries']):
    host=urlsplit(e['request']['url']).hostname or ''
    if not(host.endswith('.trustwallet.com') or host.endswith('.twnodes.com')):continue
    for item in e['response'].get('headers',[]):
        name=item['name'].lower();value=item['value']
        if name in ['server','x-powered-by','cf-cache-status','x-cache'] and re.fullmatch(r'[a-zA-Z0-9 ._()/;:-]{1,128}',value):
            hints.setdefault((host,name,value),[]).append(ordinal)
result={'scope':'Allowlisted noncredential response-header hints from one historical capture only. Headers can be set/rewritten by intermediaries; not evidence of origin application framework/database.','source':str(file.relative_to(root)),'hints':[{'host':host,'header':name,'value':value,'ordinals':ordinals} for (host,name,value),ordinals in sorted(hints.items())]}
(out/'server-header-hints.json').write_text(json.dumps(result,indent=2)+'\n')
print('Historical header hint groups:',len(hints))
