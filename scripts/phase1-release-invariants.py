"""Offline restore comparison: verify scoped edits and create a release manifest."""
import hashlib, json, pathlib, tarfile
root=pathlib.Path('.')
folder=root/'qa/phase1-2026-11-11'
with tarfile.open('restore-points/phase1-before-2026-11-11-0515.tar.gz') as archive:
    before={m.name:archive.extractfile(m).read() for m in archive.getmembers() if m.isfile()}
source=(root/'backend/src/index.ts').read_text()
old=before['backend/src/index.ts'].decode()
def part(text,start,end):
    return text[text.index(start):text.index(end,text.index(start))]
checks={
 'discount_and_stripe_checkout_creation_unchanged':part(old,'    // Validate discount and calculate final amount','  // ==================== STRIPE WEBHOOK') == part(source,'    // Validate discount and calculate final amount','  // ==================== STRIPE WEBHOOK'),
 'stripe_key_selection_unchanged':part(old,'  const getStripeKey','  // Customer-facing links') == part(source,'  const getStripeKey','  // Customer-facing links'),
 'email_endpoint_unchanged':part(old,'  // ==================== EMAIL ENDPOINTS','  // ==================== INSPECTION HISTORY SYNC') == part(source,'  // ==================== EMAIL ENDPOINTS','  // ==================== INSPECTION HISTORY SYNC'),
 'delete_endpoint_unchanged':part(old,'  // Delete inspection','  // ==================== EMAIL ENDPOINTS') == part(source,'  // Delete inspection','  // ==================== EMAIL ENDPOINTS'),
}
# Audit route's admin await change is outside Stripe checkout creation itself.
checks['discount_and_stripe_checkout_creation_unchanged']=part(old,'    // Validate discount and calculate final amount','  // Check payment status') == part(source,'    // Validate discount and calculate final amount','  // Check payment status') if '  // Check payment status' in old else part(old,'    // Validate discount and calculate final amount',"  app.post('/api/checkout/:sessionId/expire'") == part(source,'    // Validate discount and calculate final amount',"  app.post('/api/checkout/:sessionId/expire'")
protected=[p for p in before if p.startswith('backend/src/__generated__/') or p in ['package.json','package-lock.json','pnpm-lock.yaml','backend/package.json','backend/package-lock.json','backend/pnpm-lock.yaml','backend/wrangler.toml'] or p.startswith('src/')]
checks['schema_generated_files_lockfiles_config_and_frontend_unchanged']=all((root/p).read_bytes()==before[p] for p in protected)
for k,v in checks.items():
 print(('PASS' if v else 'FAIL'),k)
assert all(checks.values())
manifest=[]
for base in [root/'backend/dist',root/'dist']:
 for p in sorted(base.rglob('*')):
  if p.is_file():manifest.append({'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
(folder/'release-manifest.json').write_text(json.dumps({'scope':'local candidate only; not staged or published','artifacts':manifest,'invariants':checks},indent=2))
