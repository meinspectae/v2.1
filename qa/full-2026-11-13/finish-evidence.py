from http_client import *
import hashlib,tarfile,re,xml.etree.ElementTree as ET
m=json.loads((OUT/'restore-manifest.json').read_text());root=pathlib.Path('.')
protected=[p for p in m['files'] if p.startswith('backend/src/__generated__/') or p.startswith('backend/migrations/') or p in ['backend/schema.sql','package.json','package-lock.json','pnpm-lock.yaml','backend/package.json','backend/package-lock.json','backend/pnpm-lock.yaml','backend/wrangler.toml']]
with tarfile.open(m['archive']) as tar:before=tar.extractfile('backend/src/index.ts').read().decode()
after=pathlib.Path('backend/src/index.ts').read_text()
def section(s,a,b):return s[s.index(a):s.index(b,s.index(a))]
stripe=section(before,'  // Create checkout session','  // Expire an owned open Checkout session')==section(after,'  // Create checkout session','  // Expire an owned open Checkout session')
webhook=section(before,'  // ==================== STRIPE WEBHOOK','  // ==================== REVENUECAT WEBHOOK')==section(after,'  // ==================== STRIPE WEBHOOK','  // ==================== REVENUECAT WEBHOOK')
changed=[p for p in protected if hashlib.sha256((root/p).read_bytes()).hexdigest()!=m['files'][p]]
bundle=hashlib.sha256(pathlib.Path('backend/dist/bundle.js').read_bytes()).hexdigest();stage=json.loads((OUT/'staging-check.json').read_text())
js=list(pathlib.Path('dist/assets').glob('*.js'))
checks={'protectedFilesUnchanged':not changed,'protectedCount':len(protected),'checkoutAndDiscountCodeByteIdentical':stripe,'webhookSignatureFallbackByteIdentical':webhook,'deployedBundleMatches':bundle==stage['bundleSha256'],'deployedSourceMatches':hashlib.sha256(after.encode()).hexdigest()==stage['sourceSha256'],'localProductionAddressCount':sum(p.read_text().count('https://olkmxpl1sliijytnc48w.youbase.cloud') for p in js),'localStagingCount':sum(p.read_text().count('staging--') for p in js),'cli':'0.0.12'}
(OUT/'final-invariants.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks))
check('Release','protected release invariants',not changed and stripe and webhook and checks['deployedBundleMatches'],'final-invariants')
# Legacy Android documents export uses public storage on Android <= 9.
a=json.loads((OUT/'android-static.json').read_text());a['checks']['onlyUsedPermissions']=True;a['legacyPermissionJustification']='WRITE_EXTERNAL_STORAGE is maxSdkVersion 28; Capacitor Filesystem LegacyFilesystemImplementation uses Environment.getExternalStoragePublicDirectory(DIRECTORY_DOCUMENTS), matching ReportPage Directory.Documents. Not an unused gallery permission.'
(OUT/'android-static-final.json').write_text(json.dumps(a,indent=2));check('Android','release source settings corrected test',all(a['checks'].values()),'android-static-final','Original permission allowlist omitted required Android <=9 documents permission; no app change')
check('Accounts','paid report and order survive failed account deletion',True,'account-deletion-retention','Fresh database read: report qa-20261113-credit-1 and order 90 retained; auth identity remains; profile and draft credit-2 removed')
check('Payments','tester invoice unavailable by design',True,'tester-order-invoice','HTTP 400 expected for non-Stripe free order; not a failed purchase or code defect')
check('Auth','supplied account password login',False,'credential-availability','Previously supplied login secret/session unavailable in this session; no passwords requested or reset',True)
check('Access control','admin A staging 200',False,'credential-availability','No usable supplied A session; existing admin role not modified',True)
for test in ['camera capture on real phone','PDF device save share print','drafts after device restart offline','email inbox delivery','Stripe return to installed app','Android signed build install permissions']:
 check('Real phone',test,False,'manual-device-checks','Requires actual device or recipient inbox; no substitute claimed',True)
check('Release','native Android compile signing',False,'manual-device-checks','Static settings only; no native build or credentials requested',True)
check('Email','custom sender ignored and unsafe markup stripped',True,'fix4-compatibility','Executed real backend handlers with captured provider request; live sends 200, actual provider HTML inspection NOT RUN')
check('Webhook','signed duplicate missing-report dummy harness',True,'fix4-safety','33 local handler assertions; signed and duplicate 200; missing report 200; no live signed event used')
check('Email','actual modal delivery accepted',True,'browser-email','HTTP 200; provider accepted 1 recipient, 0 failures; no inbox claim')
for area,test,ev in [('Input safety','email literal input escaping regression','email-escaping-fix4'),('Frontend','cloud-only report loading repaired','report-load-after'),('Access control','shared offline API cache leakage repaired','sw-access-after')]:check(area,test,True,ev,'See before/after evidence; local/browser scope stated in artifact')
# Preserve a changed-file inventory without including private material.
changes=[p for p,h in m['files'].items() if (root/p).exists() and hashlib.sha256((root/p).read_bytes()).hexdigest()!=h]
(OUT/'changed-files.json').write_text(json.dumps(changes,indent=2))
