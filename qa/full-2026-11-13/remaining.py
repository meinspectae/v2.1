from http_client import *
from live import PREFIX,ledger
import urllib.parse
# All targets are records created during this run.
main=load_private('main');id=main['id']
s,d,e,_=request('N','sync-pull','/api/sync/inspections');check('Sync','full inspection sync',s==200 and any(x['id']==id for x in d.get('data',[])),e['label'])
s,d,e,_=request('N','sync-push','/api/sync/push',{'inspections':[{'id':id,'propertyType':'apartment','status':'draft','property':{'buildingName':'<script>alert(1)</script>','area':'"><img src=x onerror=alert(1)>','city':'Dubai'},'tenant':{'name':'QA Test','email':'delivered@resend.dev'},'rooms':main['rooms'],'extra':main['extra'],'generalNotes':'QA sync round trip','createdAt':'2026-11-13T06:33:00Z'}]})
check('Sync','push QA inspection',s==200,e['label'])
paths=[p['cloudPath'] for p in main['photos']]
s,d,e,_=request('N','photos-batch','/api/download/photos',{'paths':paths});check('Photos','owner batch download URLs',s==200 and len(d.get('urls',[]))==3 and all(x.get('ok') for x in d['urls']),e['label'])
s,d,e,_=request('B','B-photos-batch','/api/download/photos',{'paths':paths});check('Access control','second account batch denied per item',s==200 and all(x.get('ok') is False and not x.get('downloadUrl') for x in d['urls']),e['label'])
s,d,e,_=request('N','reference-empty','/api/inspections/'+id+'/reference');check('Fields','empty reference attachment returns 404',s==404,e['label'])
s,d,e,_=request('N','reference-presign','/api/inspections/'+id+'/reference/upload',{})
if s==200:
 path=d['path'];data=(OUT/'QA-Test-final.pdf').read_bytes()
 s,d,e,_=request('N','reference-upload','',method='PUT',url=d['uploadUrl'],binary=data,headers={'Content-Type':'application/pdf'});check('Fields','reference PDF upload',s==200,e['label']);ledger('storage reference PDF',path,inspectionId=id,state='retained')
 extra=main['extra'];extra['moveInReference']['attachment']={'path':path,'name':'QA Test reference.pdf'}
 request('N','reference-save','/api/inspections/'+id,{'extra':extra},'PUT')
 s,d,e,_=request('N','reference-download','/api/inspections/'+id+'/reference');check('Fields','saved move-in PDF returned',s==200,e['label'])
 s,d,e,_=request('B','B-reference-denied','/api/inspections/'+id+'/reference');check('Access control','second account reference PDF denied',s==404,e['label'])
for actor,id in [('T',PREFIX+'tester'),('C',PREFIX+'credit-1')]:
 s,d,e,_=request(actor,actor+'-reconcile','/api/inspections/'+id+'/reconcile-payment',{});check('Payments',actor+' paid access reconciliation',s==200,e['label'])
s,d,e,_=request('T','tester-order-invoice','/api/orders/89/invoice');check('Payments','tester order receipt returned',s==200,e['label'])
s,d,e,_=request('B','B-order-invoice-denied','/api/orders/89/invoice');check('Access control','second account invoice denied',s in [403,404],e['label'])
for suffix in ['normal','welcome20','meinspect10','inspector','invalid','launch50']:
 f=OUT/('pay-'+suffix+'-checkout'+('-retry' if suffix=='launch50' else '')+'.json');session=json.loads(f.read_text())['response']['sessionId']
 s,d,e,_=request('N','checkout-status-'+suffix,'/api/checkout/'+session)
 check('Payments',suffix+' expired session does not unlock',s==200 and not (d.get('data',{}).get('paid') is True),e['label'])
