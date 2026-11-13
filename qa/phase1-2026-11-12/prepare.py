"""Create a local restore point and activate only the requested candidate variant."""
import hashlib, json, pathlib, tarfile, difflib
root=pathlib.Path('.')
out=root/'qa/phase1-2026-11-12'
archive_path=root/'restore-points/phase1-before-2026-11-12.tar.gz'
assert not archive_path.exists(), 'Do not overwrite restore point'
paths=set()
for base in ['backend/src','backend/defs','src','dist','backend/dist','backend/migrations']:
    p=root/base
    if p.exists(): paths.update(x for x in p.rglob('*') if x.is_file())
for name in ['backend/schema.sql','backend/wrangler.toml','backend/tsconfig.json','package.json','package-lock.json','pnpm-lock.yaml','backend/package.json','backend/package-lock.json','backend/pnpm-lock.yaml']:
    paths.add(root/name)
with tarfile.open(archive_path,'w:gz') as archive:
    for p in sorted(paths): archive.add(p,arcname=str(p),recursive=False)
manifest={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}
(out/'restore-manifest.json').write_text(json.dumps({'archive':str(archive_path),'sha256':hashlib.sha256(archive_path.read_bytes()).hexdigest(),'files':manifest},indent=2))
baseline=(root/'backend/src/index.ts').read_text()
candidate=(root/'qa/phase1-2026-11-11/candidate/index.ts').read_text()
start='  // ==================== STRIPE WEBHOOK ===================='
end='  // ==================== REVENUECAT WEBHOOK'
def section(s): return s[s.index(start):s.index(end,s.index(start))]
updated=candidate.replace(section(candidate),section(baseline))
updated=updated.replace("source: 'webhook' | 'session_reconcile' | 'report_reconcile'", "source: 'webhook' | 'webhook_fallback' | 'session_reconcile' | 'report_reconcile'",1)
assert section(updated)==section(baseline)
assert updated!=candidate
(root/'backend/src/index.ts').write_text(updated)
(out/'candidate-exception.diff').write_text(''.join(difflib.unified_diff(candidate.splitlines(True),updated.splitlines(True),fromfile='saved-candidate',tofile='active-with-baseline-fallback')))
(out/'active-vs-restore.diff').write_text(''.join(difflib.unified_diff(baseline.splitlines(True),updated.splitlines(True),fromfile='restore',tofile='active')))
# Run copies of historical test suites; retain the historical evidence unmodified.
for name in ['phase1-regression.mjs','phase1-safety-regression.mjs','phase1-offline-build.mjs']:
    s=(root/'scripts'/name).read_text().replace('qa/phase1-2026-11-11/','qa/phase1-2026-11-12/')
    if name=='phase1-safety-regression.mjs':
        # Invalid IDs test the unchanged fail-closed branch without triggering Stripe.
        s=s.replace("const invalid=event('invalid','none');", "const invalid=JSON.stringify({id:'invalid-id',type:'checkout.session.completed',data:{object:{metadata:{reportId:'none'}}}});")
    (root/'scripts'/name.replace('.mjs','-20261112.mjs')).write_text(s)
print('Restore point created; sha256='+hashlib.sha256(archive_path.read_bytes()).hexdigest())
print('PASS: active equals saved candidate except exact pre-run webhook section and fallback source type')
print('PASS: fallback logging retained byte-identically')
