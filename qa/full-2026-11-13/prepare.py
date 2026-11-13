import pathlib,tarfile,hashlib,json,os
root=pathlib.Path.cwd();out=root/'qa/full-2026-11-13'
archive=root/'restore-points/full-before-2026-11-13.tar.gz'
with tarfile.open(archive) as tar:
    files={m.name:hashlib.sha256(tar.extractfile(m).read()).hexdigest() for m in tar.getmembers() if m.isfile()}
(out/'restore-manifest.json').write_text(json.dumps({'archive':str(archive.relative_to(root)),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':files},indent=2))
for old,new in [('scripts/phase1-regression-20261112.mjs','scripts/full-compatibility-20261113.mjs'),('scripts/phase1-safety-regression-20261112.mjs','scripts/full-safety-20261113.mjs'),('qa/phase1-2026-11-12/deploy-guard.py','qa/full-2026-11-13/deploy-guard.py')]:
    (root/new).write_text((root/old).read_text().replace('qa/phase1-2026-11-12','qa/full-2026-11-13'))
print(json.dumps({'restoreCreated':archive.exists(),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'protectedFiles':len(files),'suppliedEmailAvailable':bool(os.environ.get('QA_EMAIL')),'suppliedPasswordAvailable':bool(os.environ.get('QA_PASSWORD')),'stripeTestCredentialAvailable':bool(os.environ.get('SANDBOX_STRIPE_SECRET_KEY')),'stripeCredentialAvailable':bool(os.environ.get('STRIPE_SECRET_KEY'))}))
