"""Final scoped-release and schema-byte checks; no network and no application edits."""
import hashlib,json,pathlib,tarfile
root=pathlib.Path('.');out=root/'qa/phase1-2026-11-12';m=json.loads((out/'restore-manifest.json').read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
protected={p:h for p,h in m['files'].items() if not p.startswith(('dist/','backend/dist/')) and p!='backend/src/index.ts'}
changed=[p for p,h in protected.items() if not (root/p).is_file() or digest(root/p)!=h]
assert not changed,changed
schema={p:h for p,h in m['files'].items() if p.startswith(('backend/src/__generated__/','backend/migrations/')) or p=='backend/schema.sql'}
current=set(str(p) for base in ['backend/src/__generated__','backend/migrations'] for p in pathlib.Path(base).rglob('*') if p.is_file())|{'backend/schema.sql'}
assert current==set(schema),'Schema file set changed'
with tarfile.open('restore-points/phase1-before-2026-11-11-0515.tar.gz') as t:
    earlier={x.name:t.extractfile(x).read() for x in t.getmembers() if x.isfile() and x.name in schema}
assert all((root/p).read_bytes()==b for p,b in earlier.items())
with tarfile.open(m['archive']) as t:baseline=t.extractfile('backend/src/index.ts').read().decode()
active=(root/'backend/src/index.ts').read_text();candidate=(root/'qa/phase1-2026-11-11/candidate/index.ts').read_text()
start='  // ==================== STRIPE WEBHOOK ====================';end='  // ==================== REVENUECAT WEBHOOK'
def section(s):return s[s.index(start):s.index(end,s.index(start))]
expected=candidate.replace(section(candidate),section(baseline)).replace("source: 'webhook' | 'session_reconcile' | 'report_reconcile'","source: 'webhook' | 'webhook_fallback' | 'session_reconcile' | 'report_reconcile'",1)
assert active==expected
staged=json.loads((out/'staging-check.json').read_text());assert staged['sourceSha256']==digest(root/'backend/src/index.ts');assert staged['bundleSha256']==digest(root/'backend/dist/bundle.js')
private=out/'.private'
removed=[]
for name in ['staging.cookies','production.cookies','legacy-request.json']:
    p=private/name
    if p.exists():p.unlink();removed.append(name)
result={'protectedFilesByteIdentical':True,'protectedFileCount':len(protected),'schemaFilesByteIdentical':True,'schemaFileCount':len(schema),'alsoIdenticalToNovember11Restore':True,'candidateExceptionOnly':True,'baselineWebhookExactIncludingLogs':True,'sourceAndBundleStillMatchStaged':True,'privateQAArtifactsRemoved':removed,'sourceSha256':digest(root/'backend/src/index.ts'),'bundleSha256':digest(root/'backend/dist/bundle.js'),'frontendArtifacts':[{'file':str(p),'sha256':digest(p)} for p in sorted(pathlib.Path('dist').rglob('*')) if p.is_file()]}
(out/'final-check.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='frontendArtifacts'},indent=2))
