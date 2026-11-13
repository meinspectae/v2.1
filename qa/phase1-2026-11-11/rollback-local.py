"""Restore only the two application artifacts changed on 2026-11-11. No network."""
import hashlib
import pathlib
import tarfile

root = pathlib.Path(__file__).resolve().parents[2]
archive = root / 'restore-points/phase1-before-2026-11-11-0515.tar.gz'
expected = 'd9f6809029e25bc0950468872db02e5fb82e4c3587d4f534b6429b1e3cb654ff'
if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
    raise SystemExit('STOP: restore archive checksum does not match')
paths = ['backend/src/index.ts', 'backend/dist/bundle.js']
with tarfile.open(archive) as tar:
    originals = {name: tar.extractfile(name).read() for name in paths}
for name, data in originals.items():
    destination = root / name
    destination.write_bytes(data)
    assert destination.read_bytes() == data
    print('Restored local artifact:', name)
print('Local rollback complete. Staging, production, database, secrets and QA evidence untouched.')
