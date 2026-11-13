#!/usr/bin/env python3
"""Generate the public synthetic sample with the same renderer and legal config as the app.
Requires the local Vite preview requested for this report test. Does not access user records.
"""
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
origin = os.environ.get('REPORT_TEST_ORIGIN', 'http://localhost:5174')
session = 'report-sample'
def browser(*args):
    return subprocess.run(['agent-browser', '--session', session, *args], cwd=root, check=True, text=True, capture_output=True).stdout
try:
    print(browser('--args', '--no-sandbox', 'open', origin + '/scripts/sample-report.html'))
    print(browser('eval', 'window.generateFixture().then(r=>window.result=r).catch(e=>window.failure=e.stack); "started"'))
    print(browser('wait', '--fn', 'window.result || window.failure'))
    print(browser('eval', 'if(window.failure) throw Error(window.failure); window.result'))
    print(browser('download', '#download-report', str(root / 'public/sample-inspection-report.pdf')))
finally:
    browser('close')
