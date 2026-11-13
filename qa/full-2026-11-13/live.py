from http_client import *
import hashlib,zlib,struct,base64,concurrent.futures,time
PREFIX='qa-20261113-'
PAYLOADS=['<script>alert(1)</script>','"><img src=x onerror=alert(1)>','{"__proto__":{"x":1}}','x'*5000,'مرحبا بالعالم','🏠🔑😀']

def ledger(kind,id,**extra):
    with (OUT/'ledger.jsonl').open('a') as f:f.write(json.dumps({'type':kind,'id':id,**extra},ensure_ascii=False)+'\n')
def create(actor,suffix,extra=None):
    id=PREFIX+suffix
    payload={'id':id,'propertyType':'apartment','status':'draft','property':{'buildingName':'QA Test','unitNumber':'13','city':'Dubai'},'tenant':{'name':'QA Test','email':'delivered@resend.dev'},'rooms':[],'generalNotes':'QA Test disposable inspection'}
    payload.update(extra or {})
    s,d,e,_=request(actor,suffix+'-create','/api/inspections',payload)
    if s==201:ledger('inspection',id,actor=actor,state='created')
    check('Inspections',suffix+' create',s==201,e['label'])
    return id

def png(n):
    def chunk(tag,data):return struct.pack('!I',len(data))+tag+data+struct.pack('!I',zlib.crc32(tag+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',4,4,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\x00'+bytes([n*50,100,180])*4)*4))+chunk(b'IEND',b'')

def basic():
    for actor in ['N','B','T','C']:
        s,d,e,_=request(actor,actor+'-session','/api/_es/auth/get-session')
        check('Auth',actor+' persisted session',s==200 and (d or {}).get('user',{}).get('id')==load_private(actor)['id'],e['label'])
        s,d,e,_=request(actor,actor+'-profile','/api/user/profile')
        check('Accounts',actor+' profile and initial balance',s==200 and d['data']['name']=='QA Test' and d['data']['freeInspections']>=0,e['label'])
    s,d,e,_=request('wrong','wrong-password','/api/_es/auth/sign-in/email',{'email':load_private('N')['email'],'password':'DeliberatelyWrong-QA-20261113'})
    check('Auth','wrong password rejected',s==401,e['label'],'Anonymous identity has no password; real supplied-account wrong password NOT RUN')
    check('Auth','supplied A password sign in and admin access',False,'credential-availability','QA_EMAIL and QA_PASSWORD absent; no retained supplied A session located',True)
    sigs=[{'dataUrl':'data:image/png;base64,'+base64.b64encode(png(n)).decode(),'signedAt':'2026-11-13T06:32:00Z','role':role,'name':'QA Test '+role} for n,role in enumerate(['tenant','landlord','inspector'],1)]
    rooms=[{'id':'room1','name':'QA Test Living room','overallComments':'QA notes','overallCondition':'good','items':[{'id':'item1','name':'Walls','condition':'fair','comments':'QA scuff','checked':True,'photos':[]}]}]
    extras={'keys':{'frontDoor':'2','mailbox':'1'},'utilityMeters':{'electricity':{'reading':'123.4'},'water':{'reading':'0'},'gas':{'reading':''}},'moveInReference':{'keys':'2 keys','cards':'1 card','defects':'Old scratch','newDefects':'None'},'meta':{'inspectorName':'QA Test','inspectorEmail':''}}
    id=create('N','main',{'rooms':rooms,'signatures':sigs,'extra':extras,'generalNotes':'\n'.join(PAYLOADS),'property':{'buildingName':PAYLOADS[0],'area':PAYLOADS[1],'city':'Dubai'},'tenant':{'name':PAYLOADS[2],'email':'delivered@resend.dev'},'landlord':{'name':PAYLOADS[3]},'agent':{'name':PAYLOADS[4]+PAYLOADS[5]}})
    s,d,e,_=request('N','main-open','/api/inspections/'+id);row=d.get('data',{})
    check('Inspections','open rooms ratings notes',s==200 and json.loads(row['roomsData'])==rooms and row['generalNotes']=='\n'.join(PAYLOADS),e['label'])
    check('Fields','keys meters move-in round trip',s==200 and json.loads(row['extraData'])==extras,e['label'])
    check('Signatures','all three signatures round trip',s==200 and json.loads(row['signatures'])==sigs,e['label'])
    check('Input safety','six adversarial strings stored literally',s==200 and json.loads(row['propertyData'])['buildingName']==PAYLOADS[0] and json.loads(row['propertyData'])['area']==PAYLOADS[1] and json.loads(row['tenantData'])['name']==PAYLOADS[2] and json.loads(row['landlordData'])['name']==PAYLOADS[3] and json.loads(row['agentData'])['name']==PAYLOADS[4]+PAYLOADS[5],e['label'])
    s,d,e,_=request('N','main-edit','/api/inspections/'+id,{'rooms':rooms,'extra':extras,'generalNotes':'Edited QA notes\n'+'\n'.join(PAYLOADS)},method='PUT')
    check('Inspections','edit inspection',s==200,e['label'])
    s,d,e,_=request('N','main-list','/api/inspections');check('Inspections','list includes new inspection',s==200 and any(x['id']==id for x in d.get('data',[])),e['label'])
    empty=create('N','empty',{'property':{},'tenant':{},'rooms':[],'signatures':[],'generalNotes':'','extra':{'utilityMeters':{},'moveInReference':{'keys':'','cards':'','defects':'','newDefects':''}}})
    s,d,e,_=request('N','empty-open','/api/inspections/'+empty);check('Fields','empty optional fields',s==200 and json.loads(d['data']['extraData'])['moveInReference']['keys']=='',e['label'])
    s,d,e,_=request('N','empty-delete','/api/inspections/'+empty,method='DELETE');check('Delete rules','draft delete returns 200',s==200,e['label']);ledger('inspection',empty,state='deleted' if s==200 else 'retained')
    s,d,e,_=request('N','empty-gone','/api/inspections/'+empty);check('Delete rules','deleted draft returns 404',s==404,e['label'])
    for actor in ['N','T']:
        routes=re.findall(r"app\.(get|post|put|delete)\('(/api/admin/[^']+)'",pathlib.Path('backend/src/index.ts').read_text())
        for method,path in routes:
            label=actor+'-admin-'+method+'-'+path.split('/')[-1]
            s,d,e,_=request(actor,label,path,{} if method=='post' else None,method.upper())
            check('Access control',actor+' '+method.upper()+' '+path+' denied',s==403,e['label'])
    denied=[('GET','/api/inspections/'+id,None),('PUT','/api/inspections/'+id,{'generalNotes':'unauthorized QA mutation'}),('DELETE','/api/inspections/'+id,None),('GET','/api/download/pdf/'+id,None),('GET','/api/inspections/'+id+'/photos',None),('POST','/api/upload/pdf',{'inspectionId':id}),('POST','/api/upload/photo',{'inspectionId':id,'photoId':'blocked'}),('POST','/api/inspections/'+id+'/finalise',{}),('POST','/api/checkout',{'inspectionId':id}),('POST','/api/send-email',{'inspectionId':id})]
    for i,(m,p,b) in enumerate(denied):
        s,d,e,_=request('B','B-denied-'+str(i),p,b,m);check('Access control','second account '+m+' '+p,s in [403,404],e['label'])
    photo_records=[]
    for n in range(1,4):
        photoId=PREFIX+'photo'+str(n);data=png(n)
        s,d,e,_=request('N','photo'+str(n)+'-presign','/api/upload/photo',{'inspectionId':id,'photoId':photoId,'contentType':'image/png','roomId':'room1','itemId':'item1','metadata':{'timestamp':'2026-11-13T06:32:00Z','caption':'QA Test photo '+str(n)}})
        check('Photos','photo '+str(n)+' upload route',s==200,e['label'])
        if s!=200:continue
        path=d['path'];ledger('photo backup',photoId,path=path,inspectionId=id)
        s,_,e,_=request('N','photo'+str(n)+'-put','',method='PUT',headers={'Content-Type':'image/png'},binary=data,url=d['uploadUrl']);check('Photos','photo '+str(n)+' binary upload',s==200,e['label'])
        s,_,e,_=request('N','photo'+str(n)+'-confirm','/api/inspections/'+id+'/photos/'+photoId+'/confirm',{});check('Photos','photo '+str(n)+' confirmed',s==200,e['label'])
        s,d,e,_=request('N','photo'+str(n)+'-get-url','/api/download/photo?path='+path)
        if s==200:
            s,_,e,raw=request('N','photo'+str(n)+'-download','',url=d['downloadUrl'])
            hashes={'source':hashlib.sha256(data).hexdigest(),'download':hashlib.sha256(raw).hexdigest()};(OUT/('photo'+str(n)+'-hashes.json')).write_text(json.dumps(hashes,indent=2))
            check('Photos','photo '+str(n)+' hash matches',s==200 and hashes['source']==hashes['download'],e['label'])
        s,d,e,_=request('B','B-photo'+str(n),'/api/download/photo?path='+path);check('Access control','second account photo '+str(n)+' denied',s==403,e['label'])
        photo_records.append({'id':photoId,'cloudPath':path,'url':'','timestamp':'2026-11-13T06:32:00Z','caption':'QA Test'})
    rooms[0]['items'][0]['photos']=photo_records
    request('N','main-photo-reference-save','/api/inspections/'+id,{'rooms':rooms},'PUT')
    s,d,e,_=request('N','main-photo-list','/api/inspections/'+id+'/photos');check('Photos','three saved photo references restored',s==200 and len(d.get('photos',[]))==3,e['label'])
    store_private('main',{'id':id,'rooms':rooms,'extra':extras,'photos':photo_records})
    for label,headers in [('unsigned',{}),('wrong-signature',{'stripe-signature':'t=1,v1='+'0'*64})]:
        s,d,e,_=request('N','webhook-'+label,'/api/webhooks/stripe',{'id':'invalid-no-stripe-retrieval'},headers=headers)
        check('Webhook',label+' returns 400',s==400,e['label'],d.get('error',''))

def payments():
    for suffix,code,expected in [('normal',None,199),('welcome20','WELCOME20',159),('launch50','LAUNCH50',149),('meinspect10','MEINSPECT10',179),('inspector','INSPECTOR',99),('free','FREE_REPORT',0),('invalid','QA_INVALID_20261113',199)]:
        id=create('N','pay-'+suffix,{'tenant':{}})
        s,d,e,_=request('N','pay-'+suffix+'-checkout','/api/checkout',{'inspectionId':id,'amount':199,'currency':'AED',**({'discountCode':code} if code else {})})
        if s==200 and d.get('sessionId'):
            ledger('order',d.get('orderId'),inspectionId=id,sessionId=d['sessionId'],state='retained',code=code)
            if d['sessionId'].startswith('cs_'):
                s2,d2,e2,_=request('N','pay-'+suffix+'-expire','/api/checkout/'+d['sessionId']+'/expire',{})
                check('Payments',suffix+' session expired',s2==200 and d2.get('status')=='expired',e2['label'])
                check('Payments',suffix+' real Stripe session request id',bool(d.get('stripeRequestId')),e['label'],str(d.get('stripeRequestId')))
            else:check('Payments',suffix+' session expiry',False,e['label'],'Free discount does not create a Stripe session; no session to expire',True)
        check('Payments',suffix+' checkout',s==200,e['label'])
    s,d,e,_=request('N','N-orders','/api/orders');orders=d.get('data',[])
    for suffix,expected in [('normal',199),('welcome20',159),('launch50',149),('meinspect10',179),('inspector',99),('free',0),('invalid',199)]:
        matching=[o for o in orders if o.get('inspectionId')==PREFIX+'pay-'+suffix]
        check('Payments',suffix+' actual price AED '+str(expected),len(matching)==1 and matching[0]['amount']==expected,e['label'])
    id=create('T','tester',{'tenant':{}})
    s,d,e,_=request('T','tester-checkout','/api/checkout',{'inspectionId':id,'amount':0})
    check('Payments','tester free checkout',s==200 and d.get('status')=='paid',e['label'])
    if d.get('orderId'):ledger('order',d['orderId'],inspectionId=id,provider='tester',state='retained')
    s,d,e,_=request('T','tester-paid-delete','/api/inspections/'+id,method='DELETE');check('Delete rules','paid inspection delete 409',s==409,e['label'])
    s,d,e,_=request('T','tester-repeat-checkout','/api/checkout',{'inspectionId':id,'amount':199});check('Payments','paid report never asks again',s==200 and d.get('alreadyPaid') is True,e['label'])
    ids=[create('C','credit-'+str(n),{'tenant':{}}) for n in [1,2]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda entry: request('C','credit-parallel-'+str(entry[0]),'/api/checkout',{'inspectionId':entry[1],'amount':199}),enumerate(ids,1)))
    paid=[(i,d) for i,(s,d,_,_) in enumerate(results) if s==200 and d.get('status')=='paid']
    check('Payments','last credit parallel requests exactly one unlock',len(paid)==1 and sorted(r[0] for r in results)==[200,409],'credit-parallel-1 and credit-parallel-2')
    for i,d in paid:
        ledger('order',d['orderId'],inspectionId=ids[i],provider='admin_credit',state='retained')
        s,d,e,_=request('C','credit-repeat','/api/checkout',{'inspectionId':ids[i],'amount':199});check('Payments','credit used only once',s==200 and d.get('alreadyPaid') is True,e['label'])
    # Expire an unexpected Stripe fallback if one was created by a race.
    for s,d,e,_ in results:
        if d.get('sessionId','').startswith('cs_'):request('C',e['label']+'-expire','/api/checkout/'+d['sessionId']+'/expire',{})
    s,d,e,_=request('C','credit-balance','/api/user/profile');check('Accounts','credit balance exactly zero never negative',s==200 and d['data']['freeInspections']==0,e['label'])
    s,d,e,_=request('C','credit-orders','/api/orders');check('Accounts','one credit order only',s==200 and len(d.get('data',[]))==1,e['label'])

if __name__=='__main__':
    import sys
    {'basic':basic,'payments':payments}[sys.argv[1]]()
