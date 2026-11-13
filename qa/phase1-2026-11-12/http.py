"""Real authorized QA requests. Cookies private; only allowlisted response evidence retained."""
import argparse,datetime,json,os,pathlib,subprocess,tempfile
ROOT=pathlib.Path('qa/phase1-2026-11-12');PRIVATE=ROOT/'.private';PRIVATE.mkdir(mode=0o700,exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('environment',choices=['staging','production']);p.add_argument('label');p.add_argument('path');p.add_argument('--method');p.add_argument('--body');p.add_argument('--login',action='store_true');p.add_argument('--wrong-signature',action='store_true');a=p.parse_args()
base='https://'+('staging--' if a.environment=='staging' else '')+'olkmxpl1sliijytnc48w.youbase.cloud'
cookie=PRIVATE/(a.environment+'.cookies')
body=json.loads(pathlib.Path(a.body).read_text()) if a.body else None
if a.login:body={'email':os.environ['QA_EMAIL'],'password':os.environ['QA_PASSWORD']}
method=a.method or ('POST' if body is not None else 'GET')
with tempfile.TemporaryDirectory(dir=PRIVATE) as tmp:
    h=pathlib.Path(tmp)/'headers';d=pathlib.Path(tmp)/'body'
    cmd=['curl','--silent','--show-error','--max-time','60','--cookie',str(cookie),'--cookie-jar',str(cookie),'--dump-header',str(h),'--output',str(d),'--write-out','%{http_code}','--header','Content-Type: application/json','--header','Origin: '+base,'--request',method]
    if body is not None:cmd+=['--data-binary','@-']
    if a.wrong_signature:cmd+=['--header','stripe-signature: t=1,v1=0000000000000000000000000000000000000000000000000000000000000000']
    r=subprocess.run(cmd+[base+a.path],input=json.dumps(body) if body is not None else None,text=True,capture_output=True)
    headers={}
    for line in h.read_text().splitlines() if h.exists() else []:
        if ':' in line:
            k,v=line.split(':',1);headers[k.lower()]=v.strip()
    try:data=json.loads(d.read_text())
    except Exception:data={'error':'Non-JSON or transport response; raw content not retained'}
    status=int(r.stdout) if r.stdout.isdigit() else 0
    if a.login:
        user=data.get('user') or {};safe={'authenticated':status==200 and bool(user.get('id')),'userId':user.get('id'),'cookieRetained':cookie.exists() and cookie.stat().st_size>150,'error':data.get('message') or data.get('error')}
    elif a.path=='/api/user/profile':
        obj=data.get('data',data);safe={k:obj.get(k) for k in ['id','isAdmin','isTester','freeInspections','error']}
    elif a.path.startswith('/api/inspections') and method in ['GET','POST']:
        obj=data.get('data',data)
        def summary(obj):
            return {k:obj.get(k) for k in ['id','userId','status','reportGenerated','paymentData','createdAt','error']}
        safe={'data':[summary(x) for x in obj]} if isinstance(obj,list) else {'data':summary(obj)}
    elif a.path=='/api/admin/prices':safe={'responseKeys':list(data.keys()),'rowCount':len(data.get('data',[])) if isinstance(data.get('data'),list) else None,'error':data.get('error')}
    else:
        safe={k:data[k] for k in ['success','received','error','message','sentCount','failedCount','results','status','orderId','sessionId','isTester','alreadyPaid'] if k in data}
    evidence={'environment':a.environment,'method':method,'path':a.path,'status':status,'requestId':headers.get('x-request-id') or headers.get('request-id'),'cfRay':headers.get('cf-ray'),'serverDate':headers.get('date'),'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'response':safe}
    (ROOT/(a.environment+'-'+a.label+'.json')).write_text(json.dumps(evidence,indent=2));print(json.dumps(evidence,indent=2))
    if cookie.exists():cookie.chmod(0o600)
