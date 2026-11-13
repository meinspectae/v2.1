from http_client import *
from live import PREFIX,create,ledger,PAYLOADS
import html,time
id=create('B','email',{'tenant':{'name':PAYLOADS[0],'email':'delivered@resend.dev'},'property':{'buildingName':PAYLOADS[1],'city':'Dubai'},'generalNotes':'\n'.join(PAYLOADS)})
# Recipient is the provider's documented delivery simulator, never a real third party.
s,d,e,_=request('B','email-legacy','/api/send-email',{'to':['delivered@resend.dev'],'subject':'QA Test literal input','html':'<p>'+html.escape('\n'.join(PAYLOADS))+'</p>','from':'ignored@example.invalid'})
check('Email','legacy format real provider 200',s==200 and d.get('success') is True,e['label'])
s,d,e,_=request('B','email-new','/api/send-email',{'inspectionId':id,'from':'ignored@example.invalid'})
check('Email','inspectionId format real provider 200',s==200 and d.get('sentCount',0)>0,e['label'],'Anonymous auth email may be nondeliverable; inbox not claimed')
s,d,e,_=request('B','email-unsafe-html','/api/send-email',{'to':'delivered@resend.dev','subject':'QA Test unsafe HTML','html':'<p>QA Test</p><script>alert(1)</script><img src=x onerror=alert(1)>'})
check('Email','unsafe HTML request accepted after sanitizer',s==200 and d.get('success') is True,e['label'],'Actual outgoing HTML validated separately by executed provider harness; remote inbox content NOT RUN')
# Existing events for this new QA user only; 1 legacy + 2 new + 1 unsafe = 4 recipients.
sent=4
statuses=[]
for n in range(sent+1,31):
 s,d,e,_=request('B','email-recipient-'+str(n),'/api/send-email',{'to':'delivered@resend.dev','subject':'QA Test quota '+str(n),'html':'<p>QA Test delivery simulator</p>'})
 statuses.append(s)
 time.sleep(0.65)
 if s!=200:break
s,d,e,_=request('B','email-recipient-31','/api/send-email',{'to':'delivered@resend.dev','subject':'QA Test quota limit','html':'<p>QA Test must not send</p>'})
check('Email','31st recipient in hour returns 429',len(statuses)==26 and all(x==200 for x in statuses) and s==429,e['label'])
