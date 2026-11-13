"""Authorized MeInspect QA calls; retain cookies privately, record sanitized evidence only."""
import argparse, datetime, json, os, pathlib, subprocess, tempfile
ROOT = pathlib.Path('qa/phase1-2026-11-10')
ROOT.mkdir(parents=True, exist_ok=True)
p = argparse.ArgumentParser()
p.add_argument('label')
p.add_argument('path')
p.add_argument('--staging', action='store_true')
p.add_argument('--who', default='qa')
p.add_argument('--method')
p.add_argument('--body')
p.add_argument('--login', action='store_true')
p.add_argument('--signature')
a = p.parse_args()
base = 'https://' + ('staging--' if a.staging else '') + 'olkmxpl1sliijytnc48w.youbase.cloud'
private = ROOT / '.private'
private.mkdir(mode=0o700, exist_ok=True)
cookie = private / (a.who + ('-staging' if a.staging else '-production') + '.cookies')
body = json.loads(pathlib.Path(a.body).read_text()) if a.body else None
if a.login:
    body = {'email': os.environ['QA_EMAIL'], 'password': os.environ['QA_PASSWORD']}
with tempfile.TemporaryDirectory(dir=private) as tmp:
    headers, dest = pathlib.Path(tmp)/'headers', pathlib.Path(tmp)/'body'
    args = ['curl', '-sS', '--max-time', '60', '-b', str(cookie), '-c', str(cookie), '-D', str(headers), '-o', str(dest), '-w', '%{http_code}', '-H', 'Content-Type: application/json', '-H', 'Origin: '+base, '-X', a.method or ('POST' if body is not None else 'GET')]
    if body is not None: args += ['--data-binary', '@-']
    if a.signature: args += ['-H', 'stripe-signature: '+a.signature]
    args += [base+a.path]
    r = subprocess.run(args, input=json.dumps(body) if body is not None else None, text=True, capture_output=True)
    raw = dest.read_text() if dest.exists() else r.stderr
    try: data = json.loads(raw)
    except ValueError: data = raw[:1000]
    h = {}
    for line in headers.read_text().splitlines() if headers.exists() else []:
        if ':' in line:
            k,v = line.split(':',1); h[k.lower()] = v.strip()
    if '/_es/auth/' in a.path and isinstance(data,dict):
        user = data.get('user')
        data = {k:v for k,v in data.items() if k not in ('token','session','user')}
        if user: data['user'] = {k:user.get(k) for k in ('id','email','name')}
    evidence = {'status': int(r.stdout or 0), 'time': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'environment': 'staging' if a.staging else 'production', 'method': a.method or ('POST' if body is not None else 'GET'), 'path': a.path, 'cfRay': h.get('cf-ray'), 'requestId': h.get('x-request-id') or h.get('request-id'), 'body': data}
    (ROOT/(a.label+'.json')).write_text(json.dumps(evidence, indent=2))
    if cookie.exists(): cookie.chmod(0o600)
    if isinstance(data,dict) and isinstance(data.get('data'),list):
        evidence['body'] = {'count': len(data['data']), 'rows': [{k:item.get(k) for k in ('id','status','reportGenerated','isTester')} for item in data['data'][:8]]}
    print(json.dumps(evidence, indent=2))
