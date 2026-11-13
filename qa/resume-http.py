import json, pathlib, datetime, subprocess
ROOT=pathlib.Path('qa/resume-2026-11-04');ROOT.mkdir(exist_ok=True)
BASE='https://olkmxpl1sliijytnc48w.youbase.cloud'
def call(who,label,path,body=None,method=None,base=BASE):
    headers=ROOT/(label+'.headers'); dest=ROOT/(label+'-body.json')
    args=['curl','-sS','--max-time','60','-b',str(ROOT/(who+'.cookies')),'-c',str(ROOT/(who+'.cookies')),'-D',str(headers),'-o',str(dest),'-w','%{http_code}','-H','Content-Type: application/json','-H','Origin: '+base,'-X',method or ('POST' if body is not None else 'GET')]
    if body is not None:args+=['--data-binary','@-']
    args+=[base+path]
    p=subprocess.run(args,input=json.dumps(body) if body is not None else None,text=True,capture_output=True)
    raw=dest.read_text() if dest.exists() else p.stderr
    try:data=json.loads(raw)
    except:data=raw[:2000]
    h={}
    for line in headers.read_text().splitlines() if headers.exists() else []:
        if ':' in line:
            k,v=line.split(':',1);h[k.lower()]=v.strip()
    if '/_es/auth/' in path and isinstance(data,dict):data={k:v for k,v in data.items() if k not in ('token','session')}
    result={'status':int(p.stdout or 0),'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'date':h.get('date'),'cfRay':h.get('cf-ray'),'requestId':h.get('stripe-request-id') or h.get('x-request-id'),'body':data}
    (ROOT/(label+'.json')).write_text(json.dumps(result,indent=2))
    return result
