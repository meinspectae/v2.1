"""Create QA-only request fixtures, never copy auth payloads or signed asset URLs."""
import json,pathlib,hashlib,re
out=pathlib.Path('qa/phase1-2026-11-12')
for env in ['staging','production']:
    for kind in ['draft','paid']:
        data={'id':f'qa-20261112-{env}-{kind}','propertyType':'apartment','status':'draft','generalNotes':'Disposable QA verification 2026-11-12; no real payment','property':{'buildingName':f'QA 12 Nov {env} {kind}'},'tenant':{'name':'QA','email':'aalekh.dxb@gmail.com'}}
        (out/f'{env}-{kind}-request.json').write_text(json.dumps(data))
    (out/f'{env}-new-email-request.json').write_text(json.dumps({'inspectionId':f'qa-20261112-{env}-paid'}))
(out/'set-tester-request.json').write_text(json.dumps({'email':'qa-no-account-20261112@example.invalid','isTester':False}))
(out/'empty-request.json').write_text('{}')
(out/'webhook-request.json').write_text(json.dumps({'id':'qa-invalid-event-id-20261112','type':'checkout.session.completed','data':{'object':{}}}))
# Preserve old-format captured request verbatim privately; do not display its HTML/URLs.
# Replaying a historical signed PDF URL is not a fresh live-modal capture.
p=pathlib.Path('qa/phase1-2026-11-10/legacy-real-request.json');data=json.loads(p.read_text())
assert data['to']==['aalekh.dxb@gmail.com']
(out/'.private/legacy-request.json').write_text(json.dumps(data))
(out/'.private/legacy-request.json').chmod(0o600)
(out/'legacy-replay-provenance.json').write_text(json.dumps({'source':'Nov 10 live Email Report request capture','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'format':list(data.keys()),'recipientCount':1,'note':'Historical captured request replay; not fresh browser/device acceptance. Signed PDF link may have expired.'},indent=2))
print('Prepared only QA fixtures and exact historical old-format request replay')
