import json,hashlib,collections,re,pathlib
from urllib.parse import urlsplit,urlunsplit
root=pathlib.Path('/Users/jatinsharma/Desktop/REA');out=root/'evidence/30-dapp-approvals/2026-10-19';out.mkdir(parents=True,exist_ok=True)
p=root/'harbour-wallet-v2/E2E-network-log-trust-wallet.har';raw=p.read_bytes();har=json.loads(raw);entries=[];methods=collections.Counter();hosts=collections.Counter();paths=collections.Counter()
for i,e in enumerate(har['log']['entries']):
 r=e['request'];u=urlsplit(r['url']);host=u.hostname or '';path=re.sub(r'/naas/session/[^/]+','/naas/session/REDACTED',u.path);path=re.sub(r'0x[0-9a-fA-F]{40,}', 'REDACTED_ADDRESS',path);path='/'.join('REDACTED_ID' if len(seg)>24 and any(c.isdigit() for c in seg) else seg for seg in path.split('/'));hosts[host]+=1;paths[(r['method'],host,path)]+=1
 q={'method':r['method'],'url':urlunsplit((u.scheme,u.netloc,path,'','')),'httpVersion':r.get('httpVersion','HTTP/1.1'),'headers':[],'queryString':[],'cookies':[],'headersSize':-1,'bodySize':r.get('bodySize',-1)}
 try:
  body=json.loads(r.get('postData',{}).get('text',''));items=body if isinstance(body,list) else [body];ms=[b['method'] for b in items if isinstance(b,dict) and isinstance(b.get('method'),str)]
  methods.update((host,m) for m in ms)
  if ms:q['postData']={'mimeType':'application/json','text':json.dumps([{'method':m} for m in ms])}
 except (ValueError,TypeError):pass
 entries.append({'_sourceOrdinal':i,'startedDateTime':e.get('startedDateTime'),'time':e.get('time',0),'request':q,'response':{'status':e['response']['status'],'statusText':'','httpVersion':'HTTP/1.1','headers':[],'cookies':[],'content':{'size':e['response'].get('content',{}).get('size',0),'mimeType':e['response'].get('content',{}).get('mimeType','')},'redirectURL':'','headersSize':-1,'bodySize':-1},'cache':{},'timings':{'send':0,'wait':0,'receive':0}})
(out/'network-projection.har').write_text(json.dumps({'log':{'version':'1.2','creator':{'name':'Harbour offline sanitized projection','version':'1'},'entries':entries}},indent=2))
(out/'network-patterns.json').write_text(json.dumps({'source':{'path':str(p.relative_to(root)),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'entries':len(entries)},'projection':'URLs omit query values, naas tokens and hex addresses; headers/cookies/response bodies/params omitted; RPC method names retained. Ordinals unchanged. This is a derivative, not original bytes.','hosts':dict(hosts),'rpcMethods':[{'host':h,'method':m,'count':n} for (h,m),n in methods.items()],'paths':[{'method':m,'host':h,'path':p,'count':n} for (m,h,p),n in paths.items()]},indent=2))
print('projection bytes', (out/'network-projection.har').stat().st_size);print('rpc methods',sorted(set(m for h,m in methods)))
