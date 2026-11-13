"""Staging-only QA client; credentials and signed URLs never enter public evidence."""
import pathlib,json,subprocess,tempfile,datetime,os,re,uuid
OUT=pathlib.Path('qa/full-2026-11-13');PRIVATE=OUT/'.private';PRIVATE.mkdir(mode=0o700,exist_ok=True)
BASE='https://staging--olkmxpl1sliijytnc48w.youbase.cloud'
SENSITIVE=re.compile(r'token|password|secret|cookie|authorization|uploadurl|downloadurl',re.I)
def safe(x):
    if isinstance(x,dict):return {k:('[REDACTED]' if SENSITIVE.search(k) else safe(v)) for k,v in x.items()}
    if isinstance(x,list):return [safe(v) for v in x]
    if isinstance(x,str):
        if 'X-Amz-' in x or re.search(r'\b(?:sk_live_|sk_test_|whsec_)[A-Za-z0-9]',x):return '[REDACTED]'
        return x
    return x
def store_private(name,data):
    p=PRIVATE/(name+'.json');p.write_text(json.dumps(data));p.chmod(0o600)
def load_private(name):return json.loads((PRIVATE/(name+'.json')).read_text())
def request(actor,label,path,body=None,method=None,headers=None,binary=None,url=None):
    method=method or ('POST' if body is not None else 'GET');cookie=PRIVATE/(actor+'.cookies')
    target=url or BASE+path
    assert target.startswith(BASE) or (url and re.match(r'^https://',target)), 'HTTPS only'
    with tempfile.TemporaryDirectory(dir=PRIVATE) as tmp:
        h=pathlib.Path(tmp)/'headers';d=pathlib.Path(tmp)/'body'
        cmd=['curl','--silent','--show-error','--max-time','60','--dump-header',str(h),'--output',str(d),'--write-out','%{http_code}','--request',method]
        if not url:
            cmd+=['--cookie',str(cookie),'--header','Origin: '+BASE]
            # Avoid concurrent requests truncating the shared cookie jar.
            if path.startswith('/api/_es/auth/') and not path.endswith('/get-session'):
                cmd+=['--cookie-jar',str(cookie)]
        if binary is None:cmd+=['--header','Content-Type: application/json']
        for k,v in (headers or {}).items():cmd+=['--header',k+': '+v]
        payload=binary if binary is not None else (json.dumps(body,ensure_ascii=False).encode() if body is not None else None)
        if payload is not None:cmd+=['--data-binary','@-']
        r=subprocess.run(cmd+[target],input=payload,capture_output=True)
        hs={}
        for line in h.read_text().splitlines() if h.exists() else []:
            if ':' in line:k,v=line.split(':',1);hs[k.lower()]=v.strip()
        raw=d.read_bytes() if d.exists() else b''
        try:data=json.loads(raw)
        except Exception:data={'nonJson':True,'bytes':len(raw)}
        status=int(r.stdout) if r.stdout.isdigit() else 0
        public={'label':label,'actor':actor,'method':method,'path':path if not url else '[signed storage URL]','status':status,'requestId':hs.get('x-request-id') or hs.get('request-id'),'cfRay':hs.get('cf-ray'),'storageRequestId':hs.get('x-amz-request-id'),'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'response':safe(data)}
        (OUT/(label+'.json')).write_text(json.dumps(public,indent=2,ensure_ascii=False))
        print(json.dumps({k:public[k] for k in ['label','status','requestId','cfRay']}),flush=True)
        if cookie.exists():cookie.chmod(0o600)
        return status,data,public,raw

def check(area,test,passed,evidence,detail='',not_run=False):
    entry={'area':area,'test':test,'result':'NOT RUN' if not_run else ('PASS' if passed else 'FAIL'),'evidence':evidence,'detail':detail}
    with (OUT/'results.jsonl').open('a') as f:f.write(json.dumps(entry,ensure_ascii=False)+'\n')
    print(entry['result'],test,flush=True)
    return entry

def signup(actor):
    s,d,e,_=request(actor,actor+'-signup','/api/_es/auth/sign-in/anonymous',{'name':'QA Test'})
    user=d.get('user',{})
    if s==200 and user.get('id'):
        store_private(actor,{'id':user['id'],'email':user.get('email'),'name':user.get('name')})
        # Both auth display name and app profile explicitly use the requested QA name.
        request(actor,actor+'-auth-name','/api/_es/auth/update-user',{'name':'QA Test'})
        request(actor,actor+'-profile-create','/api/user/profile',{'name':'QA Test','phone':'','location':''})
        with (OUT/'ledger.jsonl').open('a') as f:f.write(json.dumps({'type':'anonymous account','actor':actor,'id':user['id'],'name':'QA Test','state':'created'})+'\n')
    check('Auth',actor+' anonymous sign up',s==200 and bool(user.get('id')),e['label'])
    return user
if __name__=='__main__':
    for actor in ['N','B','T','C']:
        signup(actor)
