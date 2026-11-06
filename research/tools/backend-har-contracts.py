"""Offline, value-free HAR contract inventory. No network or target execution.

All headers retain names only. JSON values retain types/shapes only, except
JSON-RPC method names. No passwords, tokens, device IDs, addresses or bodies
are copied. Array alternatives are merged, with a bounded example shape.
"""
import base64, collections, hashlib, json, pathlib, re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, quote

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'evidences/re-evidence/40-backend-api/2026-10-21'
def path_template(path):
    path=re.sub(r'(/naas/session/)[^/]+',r'\1{sessionToken}',path)
    path=re.sub(r'(/devices/)(?!fingerprint(?:/|$))[^/]+',r'\1{deviceId}',path)
    path=re.sub(r'(/projects/)[^/]+',r'\1{projectId}',path)
    path=re.sub(r'0x[0-9a-fA-F]{40,}', '{hexValue}',path)
    parts=[]
    for s in path.split('/'):
        if re.fullmatch(r'c\d+(?:_t.*)?',s):s='{assetId}'
        elif re.fullmatch(r'\d+',s):s='{number}'
        elif len(s)>24 and re.search(r'\d',s):s='{opaqueValue}'
        parts.append(s)
    return '/'.join(parts)
def safe_key(key):
    # Retain schema names; dynamic keys may themselves carry address/token data.
    if len(key)>64 or re.search(r'0x[0-9a-fA-F]{40,}',key) or re.fullmatch(r'c\d+(?:_t.*)?',key):return '{dynamicKey}'
    return key
def shape(value,depth=0):
    if depth>16:return {'type':'depth-limit'}
    if value is None:return {'type':'null'}
    if isinstance(value,bool):return {'type':'boolean'}
    if isinstance(value,(float,int)):return {'type':'number'}
    if isinstance(value,str):return {'type':'string'}
    if isinstance(value,list):
        variants={}
        for v in value:
            sh=shape(v,depth+1);variants[json.dumps(sh,sort_keys=True)]=sh
        return {'type':'array','observedLengths':[len(value)],'itemVariants':list(variants.values())[:20],'omittedVariants':max(0,len(variants)-20)}
    return {'type':'object','properties':{safe_key(str(k)):shape(v,depth+1) for k,v in value.items()}}
def parse_text(text,encoding=None):
    if encoding=='base64':
        try:text=base64.b64decode(text).decode('utf8')
        except Exception:return None
    try:return json.loads(text)
    except (ValueError,TypeError):
        # Newline-delimited JSON / SSE preserve shape only.
        objects=[]
        for line in (text or '').splitlines():
            line=re.sub(r'^data:\s*','',line)
            try:objects.append(json.loads(line))
            except ValueError:pass
        return objects if objects else None
contracts={};sources=[];projection=[];rpc=collections.Counter()
for file in sorted((ROOT/'evidences/network-logs').glob('*.har')):
    raw=file.read_bytes();parse_limit=None
    try:har=json.loads(raw);entries=har.get('log',{}).get('entries',[])
    except json.JSONDecodeError as err:
        # Recover only complete entry objects from a truncated HAR. Do not repair bytes.
        text=raw.decode('utf8');start=re.search(r'"entries"\s*:\s*\[',text)
        if not start:raise
        pos=start.end();entries=[];decoder=json.JSONDecoder()
        while pos<len(text):
            while pos<len(text) and text[pos] in ' \n\r\t,':pos+=1
            if text[pos:pos+1]==']':break
            try:entry,end=decoder.raw_decode(text,pos)
            except json.JSONDecodeError:break
            entries.append(entry);pos=end
        parse_limit={'reason':'malformed/truncated HAR; complete prefix entry objects only','originalErrorCharacter':err.pos,'stoppedCharacter':pos,'trailingCharactersExcluded':len(text)-pos}
    sources.append({'file':str(file.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'entries':len(entries),'parseLimitation':parse_limit,'attribution':'historical capture; extension version and action attribution not independently verified'})
    for ordinal,e in enumerate(entries):
        req=e['request'];res=e['response'];u=urlsplit(req['url']);host=u.hostname or '';p=path_template(u.path);method=req['method']
        key=(host,method,p)
        c=contracts.setdefault(key,{'host':host,'method':method,'path':p,'count':0,'statuses':{},'queryKeys':set(),'requestHeaderNames':set(),'responseHeaderNames':set(),'requestVariants':{},'responseVariants':{},'mimeTypes':set(),'records':[],'rpcMethods':set()})
        c['count']+=1;c['statuses'][str(res['status'])]=c['statuses'].get(str(res['status']),0)+1
        c['queryKeys'].update(safe_key(k) for k,v in parse_qsl(u.query,keep_blank_values=True))
        c['requestHeaderNames'].update(h['name'].lower() for h in req.get('headers',[]));c['responseHeaderNames'].update(h['name'].lower() for h in res.get('headers',[]))
        content=res.get('content',{});c['mimeTypes'].add(content.get('mimeType',''))
        request=parse_text(req.get('postData',{}).get('text'));response=parse_text(content.get('text'),content.get('encoding'))
        for val,bucket in [(request,c['requestVariants']),(response,c['responseVariants'])]:
            if val is not None:
                sh=shape(val);bucket[json.dumps(sh,sort_keys=True)]=sh
        methods=[]
        for item in request if isinstance(request,list) else [request]:
            if isinstance(item,dict) and isinstance(item.get('method'),str) and re.fullmatch(r'[A-Za-z0-9_.]{1,100}',item['method']):
                methods.append(item['method']);c['rpcMethods'].add(item['method']);rpc[(host,item['method'])]+=1
        c['records'].append({'source':file.name,'ordinal':ordinal})
        # Compact derivative to keep under REA's 32 MiB limit; one record per original.
        projection.append({'_sourceFile':file.name,'_sourceOrdinal':ordinal,'startedDateTime':e.get('startedDateTime','1970-01-01T00:00:00Z'),'time':e.get('time',0),'request':{'method':method,'url':urlunsplit((u.scheme,host,quote(p,safe='/:-._~'),'','')),'httpVersion':'HTTP/1.1','headers':[],'cookies':[],'queryString':[{'name':safe_key(k),'value':'REDACTED'} for k,v in parse_qsl(u.query,keep_blank_values=True)],'headersSize':-1,'bodySize':-1,**({'postData':{'mimeType':'application/json','text':json.dumps({'rpcMethods':methods})}} if methods else {})},'response':{'status':res['status'],'statusText':'','httpVersion':'HTTP/1.1','headers':[],'cookies':[],'redirectURL':'','headersSize':-1,'bodySize':-1,'content':{'mimeType':content.get('mimeType',''),'size':0}},'cache':{},'timings':{'send':0,'wait':0,'receive':0}})
result=[]
for key,c in sorted(contracts.items()):
    for k in ['queryKeys','requestHeaderNames','responseHeaderNames','mimeTypes','rpcMethods']:c[k]=sorted(c[k])
    for k in ['requestVariants','responseVariants']:c[k]=list(c[k].values())
    result.append(c)
(OUT/'har-contracts.json').write_text(json.dumps({'sources':sources,'redaction':'All values omitted. Header names, query keys, JSON shapes and RPC method names retained. Dynamic URL segments templated. This is a lossy derivative; shapes are observations, not validation schemas.','contracts':result,'rpcMethods':[{'host':h,'method':m,'count':n} for (h,m),n in sorted(rpc.items())]},indent=2)+'\n')
(OUT/'network-projection.har').write_text(json.dumps({'log':{'version':'1.2','creator':{'name':'offline value-free projection','version':'1'},'entries':projection}},separators=(',',':')))
print(json.dumps({'sources':sources,'contracts':len(result),'records':len(projection),'projectionBytes':(OUT/'network-projection.har').stat().st_size,'rpcMethods':len(rpc)},indent=2))
