"""Restore only the four app changes from the checksum-verified pre-QA archive.
No deployment, database, package install, or secret operation is performed.
WARNING: restores the original cross-account PDF/cache vulnerabilities.
"""
import pathlib,hashlib,json,tarfile,argparse
p=argparse.ArgumentParser();p.add_argument('--confirm-local-rollback',action='store_true');a=p.parse_args()
if not a.confirm_local_rollback:raise SystemExit('Not run. Requires --confirm-local-rollback; original security defects would return.')
root=pathlib.Path.cwd();m=json.loads((root/'qa/full-2026-11-13/restore-manifest.json').read_text());archive=root/m['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest()==m['sha256']
paths=['src/components/EmailReportModal.tsx','src/pages/ReportPage.tsx','public/sw.js','backend/src/index.ts','backend/dist/bundle.js']
with tarfile.open(archive) as t:
 for name in paths:
  data=t.extractfile(name).read();assert hashlib.sha256(data).hexdigest()==m['files'][name];(root/name).write_bytes(data)
print('Starting local app files restored. Nothing deployed; database and financial records untouched.')
