from http_client import *
from live import ledger,PREFIX
# Keep proof artifacts and financial records. Only these two disposable drafts are removed.
for suffix in ['email','pdf-access-probe']:
 s,d,e,_=request('B','cleanup-'+suffix,'/api/inspections/'+PREFIX+suffix,method='DELETE')
 check('Cleanup','delete own QA '+suffix+' draft',s==200,e['label']);ledger('inspection',PREFIX+suffix,state='deleted' if s==200 else 'retained')
# Confirm tester role restoration using a separate explicit SQL operation before sign-out.
for actor in ['N','B','T','C']:
 s,d,e,_=request(actor,actor+'-final-profile','/api/user/profile')
 if isinstance(d,dict) and d.get('data'):check('Accounts',actor+' final nonnegative balance',d['data']['freeInspections']>=0,e['label'])
 s,d,e,_=request(actor,actor+'-final-orders','/api/orders')
 if isinstance(d,dict):
  for row in d.get('data',[]):
   if row.get('inspectionId','').startswith(PREFIX):ledger('order',row['id'],inspectionId=row['inspectionId'],state='retained',status=row['status'])
 s,d,e,_=request(actor,actor+'-signout','/api/_es/auth/sign-out',{})
 check('Auth',actor+' sign out',s==200,e['label'])
 s,d,e,_=request(actor,actor+'-session-after-signout','/api/_es/auth/get-session')
 check('Auth',actor+' session cleared',s==200 and not d,e['label'])
 s,d,e,_=request(actor,actor+'-profile-after-signout','/api/user/profile')
 check('Auth',actor+' protected route after logout',s==401,e['label'])
