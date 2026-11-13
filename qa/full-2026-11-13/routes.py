from http_client import *
import re,concurrent.futures
source=pathlib.Path('backend/src/index.ts').read_text();routes=re.findall(r"app\.(get|post|put|delete)\('([^']+)'",source)
assert len(routes)==50
# Gate coverage is not positive functional coverage; no mutation can pass auth.
def probe(entry):
 i,(m,p)=entry;path=re.sub(r':[A-Za-z]+','qa-20261113-missing',p)
 body={} if m in ['post','put'] else None
 if p=='/api/public/verify/:id':body={'hash':'0'*64,'kind':'content'}
 s,d,e,_=request('unauth','route-'+str(i).zfill(2),path,body,m.upper())
 expected=401 if not (p.startswith('/api/public/') or p.startswith('/api/webhooks/')) else None
 result='PASS' if (s==expected if expected else s in [200,302,400,401,404,422]) else 'FAIL'
 return {'method':m.upper(),'path':p,'status':s,'cfRay':e['cfRay'],'requestId':e['requestId'],'result':result,'scope':'unauthenticated gate' if expected else 'public validation response','evidence':e['label'],'error':d.get('error') if isinstance(d,dict) else None}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(probe,enumerate(routes,1)))
(OUT/'route-matrix.json').write_text(json.dumps(results,indent=2));print('Routes invoked:',len(results))
