"""Fresh HTTP evidence only; never persist auth/cookie headers or response bodies."""
import datetime, json, pathlib, subprocess, sys, tempfile
BASE = 'https://olkmxpl1sliijytnc48w.youbase.cloud'
OUT = pathlib.Path('qa/readiness-2026-11-06')

def call(label, path, method='GET', payload=None, extra_headers=None, base=BASE):
    with tempfile.TemporaryDirectory(dir=OUT) as tmp:
        headers = pathlib.Path(tmp) / 'headers'
        body = pathlib.Path(tmp) / 'body'
        args = ['curl', '-sS', '--max-time', '45', '-D', str(headers), '-o', str(body), '-w', '%{http_code}', '-X', method,
                '-H', 'Content-Type: application/json', '-H', 'Origin: ' + base]
        for header in extra_headers or []:
            args.extend(['-H', header])
        if payload is not None:
            args.extend(['--data-binary', '@-'])
        args.append(base + path)
        p = subprocess.run(args, input=json.dumps(payload) if payload is not None else None, text=True, capture_output=True)
        h = {}
        for line in headers.read_text().splitlines() if headers.exists() else []:
            if ':' in line:
                k, v = line.split(':', 1)
                if k.lower() in ('date', 'cf-ray', 'x-request-id', 'content-type'):
                    h[k.lower()] = v.strip()
        raw = body.read_text() if body.exists() else ''
        try:
            data = json.loads(raw)
            summary = {k: data[k] for k in ('error', 'message', 'code', 'success', 'received') if k in data} if isinstance(data, dict) else {'sessionPresent': data is not None}
        except ValueError:
            summary = {'bodyBytes': len(raw)}
        record = {'label': label, 'environment': 'production' if base in (BASE, 'https://app.meinspect.com') else 'preview', 'method': method, 'path': path,
                  'timeUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': int(p.stdout or 0),
                  'headers': h, 'responseSummary': summary}
        (OUT / (label + '.json')).write_text(json.dumps(record, indent=2))
        print(json.dumps(record))
        return record

if __name__ == '__main__':
    step = sys.argv[1]
    if step == 'admin':
        call('01-admin-prices-unauthenticated', '/api/admin/prices')
        call('01-admin-set-tester-unauthenticated', '/api/admin/set-tester', 'POST', {})
    elif step == 'delete':
        call('02-delete-unauthenticated', '/api/inspections/qa-readiness-nonexistent-20261106', 'DELETE')
    elif step == 'email':
        call('03-email-unauthenticated', '/api/send-email', 'POST', {'inspectionId': 'qa-readiness-nonexistent-20261106'})
    elif step == 'credits':
        call('05-credit-unauthenticated', '/api/checkout', 'POST', {'inspectionId': 'qa-readiness-nonexistent-20261106'})
    elif step == 'final':
        call('07-webhook-no-signature', '/api/webhooks/stripe', 'POST', {})
        call('07-webhook-wrong-signature', '/api/webhooks/stripe', 'POST', {}, ['Stripe-Signature: t=1793946301,v1=not-a-valid-signature'])
        call('07-session-without-credentials', '/api/_es/auth/get-session')
        call('07-production-signin-page', '/login', base='https://app.meinspect.com')
