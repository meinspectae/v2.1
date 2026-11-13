"""Fresh staging-only probes. No credentials, session creation or data mutations."""
import datetime, json, pathlib, subprocess, tempfile
root = pathlib.Path('qa/phase1-2026-11-11')
base = 'https://staging--olkmxpl1sliijytnc48w.youbase.cloud'
probes = [
    ('session', 'GET', '/api/_es/auth/get-session', None, None),
    ('admin-unauthenticated', 'GET', '/api/admin/access', None, None),
    ('old-inspection-unauthenticated', 'GET', '/api/inspections/mvuxjr15recovery1', None, None),
    ('webhook-unconfigured', 'POST', '/api/webhooks/stripe', {}, None),
    ('webhook-unconfigured-wrong-signature', 'POST', '/api/webhooks/stripe', {}, 't=1,v1=dummy'),
]
results = []
for label, method, path, body, signature in probes:
    with tempfile.TemporaryDirectory(dir=root) as tmp:
        headers = pathlib.Path(tmp)/'headers'
        output = pathlib.Path(tmp)/'response'
        args = ['curl','-sS','--max-time','40','-D',str(headers),'-o',str(output),'-w','%{http_code}',
                '-X',method,'-H','Content-Type: application/json','-H','Origin: '+base]
        if body is not None: args += ['--data-binary','@-']
        if signature: args += ['-H','stripe-signature: '+signature]
        args += [base+path]
        response = subprocess.run(args,input=json.dumps(body) if body is not None else None,text=True,capture_output=True)
        h = {}
        for line in headers.read_text().splitlines() if headers.exists() else []:
            if ':' in line:
                k,v=line.split(':',1);h[k.lower()]=v.strip()
        try: data=json.loads(output.read_text())
        except Exception: data={'error':'Non-JSON or unavailable response'}
        if path.startswith('/api/_es/auth'):
            data={'authenticated': bool(isinstance(data,dict) and data.get('user'))}
        item={'label':label,'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':'staging (unchanged deployment)',
              'method':method,'path':path,'status':int(response.stdout or 0),'requestId':h.get('x-request-id') or h.get('request-id'),
              'cfRay':h.get('cf-ray'),'body':data}
        results.append(item)
        print(json.dumps(item))
(root/'staging-readonly-probes.json').write_text(json.dumps(results,indent=2))
