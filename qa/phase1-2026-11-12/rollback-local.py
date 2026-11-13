"""Explicit local rollback only. Does not deploy, publish, modify schema, or touch data."""
import hashlib,json,pathlib,tarfile
root=pathlib.Path('.');folder=root/'qa/phase1-2026-11-12'
manifest=json.loads((folder/'restore-manifest.json').read_text());archive=root/manifest['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest()==manifest['sha256'],'Restore archive checksum mismatch'
with tarfile.open(archive) as handle:
    for name in ['backend/src/index.ts','backend/dist/bundle.js']:
        content=handle.extractfile(name).read()
        assert hashlib.sha256(content).hexdigest()==manifest['files'][name]
        (root/name).write_bytes(content)
        assert (root/name).read_bytes()==content
print('Starting backend source/bundle restored byte-for-byte locally. Staging and production are NOT changed.')
print('Staging rollback needs a separately authorized pinned CLI dry-run/deploy with schema no-change checks. Do not publish automatically.')
