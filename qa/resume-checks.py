import sys,json,time,base64,zlib,struct,subprocess
from pathlib import Path
sys.path.insert(0,'qa');q=__import__('resume-http');root=q.ROOT
stamp=str(int(time.time())); iid='qa-'+stamp+'-main'
def run(who,label,p,b=None,method=None):
 r=q.call(who,label,p,b,method); print(label,r['status'],str(r['body'])[:350],r['cfRay']);return r
# Generate tiny, valid test evidence without borrowing a customer's photographs.
def png(rgb,w=240,h=160):
 def chunk(k,d):return struct.pack('!I',len(d))+k+d+struct.pack('!I',zlib.crc32(k+d)&0xffffffff)
 rows=b''.join(b'\x00'+bytes(rgb)*w for _ in range(h))
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
photos=[]
for i,c in enumerate([(35,100,200),(40,160,80),(220,120,25)],1):
 (root/f'photo-{i}.png').write_bytes(png(c));photos.append({'id':iid+'-photo-'+str(i),'url':'','timestamp':q.datetime.datetime.now(q.datetime.timezone.utc).isoformat(),'caption':'Synthetic QA evidence '+str(i),'includeInReport':True})
sig='data:image/png;base64,'+base64.b64encode(png((20,20,20),120,30)).decode()
payload={'id':iid,'propertyType':'apartment','status':'draft','generalNotes':'N'*5000,'property':{'type':'apartment','buildingName':'QA <script>alert(1)</script>','unitNumber':'QA','city':'Dubai','area':'العربية 😀','bedrooms':2,'bathrooms':1},'tenant':{'name':'"><img src=x onerror=alert(1)>','email':'aalekh.dxb@gmail.com'},'landlord':{'name':'{"__proto__":{"x":1}}','email':'aalekh.dxb@gmail.com'},'agent':{},'tenancy':{},'rooms':[{'id':'qa-room','name':'QA العربية 😀','type':'living_room','overallCondition':'good','overallComments':'<script>alert(1)</script>','items':[{'id':'wall','name':'Wall','condition':'good','checked':True,'comments':'"><img src=x onerror=alert(1)>','photos':[photos[1]]},{'id':'floor','name':'Floor','condition':'poor','checked':True,'comments':'{"__proto__":{"x":1}}','photos':[photos[2]]}]}],'overallPhotos':[photos[0]],'propertyItems':[],'signatures':[{'role':role,'name':'QA '+role,'dataUrl':sig,'signedAt':photos[0]['timestamp']} for role in ['tenant','landlord','inspector']]}
r=run('a','main-create','/api/inspections',payload)
if r['status']!=201:raise SystemExit('create failed')
(root/'main-id.txt').write_text(iid)
for i,p in enumerate(photos,1):
 room='overall' if i==1 else 'qa-room';item='cover' if i==1 else ('wall' if i==2 else 'floor')
 r=run('a',f'photo-{i}-presign','/api/upload/photo',{'inspectionId':iid,'photoId':p['id'],'roomId':room,'itemId':item,'contentType':'image/png','metadata':{'timestamp':p['timestamp'],'caption':p['caption']}})
 if r['status']!=200:raise SystemExit('photo presign failed')
 d=r['body'];upload=subprocess.run(['curl','-sS','--max-time','60','-X','PUT','-H','Content-Type: image/png','--data-binary','@'+str(root/f'photo-{i}.png'),'-o',str(root/f'photo-{i}-upload-body.txt'),'-D',str(root/f'photo-{i}-upload.headers'),'-w','%{http_code}',d['uploadUrl']],capture_output=True,text=True)
 print('photo upload',i,upload.stdout);(root/f'photo-{i}-upload-status.txt').write_text(upload.stdout)
 if upload.stdout!='200':raise SystemExit('upload failed')
 run('a',f'photo-{i}-confirm',f'/api/inspections/{iid}/photos/{p["id"]}/confirm',{})
 p.update({'cloudPath':d['path'],'url':d['path'],'backupStatus':'backed_up'})
run('a','main-update','/api/inspections/'+iid,payload,'PUT');(root/'main-payload.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
run('a','main-read','/api/inspections/'+iid)
run('a','main-photos','/api/inspections/'+iid+'/photos')
# Register B through supported anonymous auth, isolated from A.
r=run('b','b-login','/api/_es/auth/sign-in/anonymous',{})
if r['status']==200:
 for label,p,b,m in [('b-read','/api/inspections/'+iid,None,None),('b-pdf','/api/download/pdf/'+iid,None,None),('b-photo','/api/download/photo?path='+photos[0]['cloudPath'],None,None),('b-photos','/api/inspections/'+iid+'/photos',None,None),('b-delete','/api/inspections/'+iid,None,'DELETE'),('b-delete-photo','/api/inspections/'+iid+'/photos/'+photos[0]['id'],None,'DELETE'),('b-delete-pdf','/api/download/pdf/'+iid,None,'DELETE')]:run('b',label,p,b,m)
run('a','a-set-tester','/api/admin/set-tester',{'email':'aalekh.dxb@gmail.com','isTester':False})
run('a','a-admin-prices','/api/admin/prices')
# Disposable draft deletion is independent of the evidence inspection.
draft='qa-'+stamp+'-draft';run('a','draft-create','/api/inspections',{'id':draft,'propertyType':'apartment','generalNotes':'QA disposable draft'})
run('a','draft-delete','/api/inspections/'+draft,None,'DELETE');run('a','draft-after','/api/inspections/'+draft)
# Completed-state marker tests the deletion guard, not actual PDF finalisation.
complete='qa-'+stamp+'-completed-guard';run('a','completed-create','/api/inspections',{'id':complete,'propertyType':'apartment','status':'completed','reportGenerated':True,'generalNotes':'QA completion deletion guard only; no final PDF'})
run('a','completed-delete','/api/inspections/'+complete,None,'DELETE');run('a','completed-after','/api/inspections/'+complete)
(root/'records.json').write_text(json.dumps({'main':iid,'draft':draft,'completedGuard':complete,'photos':[p['id'] for p in photos]},indent=2))
