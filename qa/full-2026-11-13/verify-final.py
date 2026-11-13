from http_client import *
from live import ledger,PREFIX
import hashlib
b=json.loads((OUT/'browser-finalise.json').read_text());call=next(c for c in b['calls'] if c['path'].endswith('/finalise'));reg=call['result'];id=PREFIX+'final'
ledger('report verification',reg['reportId'],inspectionId=id,path=reg['path'],state='retained')
ledger('storage final PDF',reg['path'],inspectionId=id,state='retained')
check('Finalisation','actual browser PDF generated uploaded finalised',call['status']==200,'browser-finalise','Real app renderer, not synthetic PDF; '+reg['pdfHash'])
for label,hash in [('unknown','0'*64),('registered-pdf',reg['pdfHash']),('registered-content',reg['contentHash'])]:
 s,d,e,_=request('B','verify-'+label,'/api/public/verify/'+reg['reportId'],{'kind':'content' if label.endswith('content') else 'pdf','hash':hash})
 check('Verification',label,s==200 and d.get('verified')==(label!='unknown'),e['label'])
s,d,e,_=request('N','final-pdf-url','/api/download/pdf/'+id)
if s==200:
 s,d,e,raw=request('N','final-pdf-download','',url=d['downloadUrl']);(OUT/'QA-Test-final.pdf').write_bytes(raw)
 check('PDF','registered PDF downloaded hash matches',s==200 and hashlib.sha256(raw).hexdigest()==reg['pdfHash'],e['label'])
s,d,e,_=request('B','B-final-pdf-denied','/api/download/pdf/'+id);check('Access control','second account actual final PDF denied',s==404,e['label'])
s,d,e,_=request('N','final-delete','/api/inspections/'+id,method='DELETE');check('Delete rules','finalised inspection returns 409',s==409,e['label'])
