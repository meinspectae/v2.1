import subprocess,json,time,pathlib,urllib.request
from http_client import OUT,check
server=subprocess.Popen(['pnpm','exec','vite','--config','qa/full-2026-11-13/vite.qa.config.ts'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def browser(*args,input=None):
 r=subprocess.run(['agent-browser','--session','full-qa',*args],input=input,text=True,capture_output=True,timeout=45)
 if r.returncode:raise RuntimeError(r.stderr[:200])
 return r.stdout
try:
 time.sleep(2)
 browser('open','http://localhost:5177/v/qa-20261113-final-0ea7f42773d3c245');browser('wait','1500')
 for label,value,expected in [('negative','0'*64,'No matching registered report'),('positive','0ea7f42773d3c24569cfc4e52439e0ef5f158a69519150ac8266332fdb371c82','This content hash matches')]:
  browser('fill','input[placeholder="64-character SHA-256 hash"]',value)
  browser('eval','document.querySelector("form").requestSubmit()')
  browser('wait','1800')
  text=browser('get','text','body');(OUT/('verify-browser-'+label+'-final.txt')).write_text(text)
  check('Verification','browser '+label+' completed',expected in text,'verify-browser-'+label+'-final')
 browser('upload','input[type="file"]',str((OUT/'QA-Test-final.pdf').resolve()));browser('wait','2000')
 text=browser('get','text','body');(OUT/'verify-browser-pdf-final.txt').write_text(text);check('Verification','browser PDF verification completed','The PDF exactly matches' in text,'verify-browser-pdf-final')
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill()
