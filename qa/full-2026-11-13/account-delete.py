from http_client import *
from live import ledger
s,d,e,_=request('C','delete-account-orders-before','/api/orders');orders=d.get('data',[])
s,d,e,_=request('C','delete-account','/api/user/account',method='DELETE');check('Accounts','disposable account deletion',s==200,e['label']);ledger('anonymous account',load_private('C')['id'],actor='C',state='deleted' if s==200 else 'retained')
s,d,e,_=request('C','deleted-account-session','/api/_es/auth/get-session');check('Accounts','deleted account session invalid',s==200 and not d,e['label'])
(OUT/'account-deletion-before.json').write_text(json.dumps({'id':load_private('C')['id'],'orders':orders},indent=2))
