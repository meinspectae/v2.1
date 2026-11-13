import subprocess,json,time,pathlib
from http_client import OUT,check
server=subprocess.Popen(['pnpm','exec','vite','--config','qa/full-2026-11-13/vite.qa.config.ts'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def b(*args,input=None):
 r=subprocess.run(['agent-browser','--session','full-qa',*args],input=input,text=True,capture_output=True,timeout=40)
 if r.returncode:raise RuntimeError(r.stderr[:160])
 return r.stdout
try:
 time.sleep(2)
 b('open','http://localhost:5177');b('wait','1200')
 b('eval','--stdin',input="""window.__qaAlerts=[];window.alert=x=>window.__qaAlerts.push(String(x));window.__qaErrors=[];window.addEventListener('error',e=>window.__qaErrors.push(e.message));'monitored'""")
 for route,expected in [('/history','Inspection History'),('/settings','Settings'),('/new','New Inspection')]:
  b('eval',"history.pushState({},'',"+json.dumps(route)+");window.dispatchEvent(new PopStateEvent('popstate'))")
  b('wait','1200');text=b('get','text','body');label='browser-'+route.strip('/');(OUT/(label+'.txt')).write_text(text)
  check('Frontend',route+' opens',expected in text,label)
 b('eval',"history.pushState({},'','/history');window.dispatchEvent(new PopStateEvent('popstate'))")
 b('wait','800')
 evidence=json.loads(b('eval',"({literalScriptVisible:document.body.innerText.includes('<script>alert(1)</script>'),literalImageVisible:document.body.innerText.includes('onerror=alert(1)'),executableNodes:document.querySelectorAll('[onerror],script:not([src]):not([type=module])').length,alerts:window.__qaAlerts})"))
 (OUT/'browser-input-safety.json').write_text(json.dumps(evidence,indent=2));check('Input safety','stored malicious names rendered as text',evidence['literalScriptVisible'] and evidence['literalImageVisible'] and not evidence['alerts'],'browser-input-safety')
 # Missing report must leave the loading state, including React StrictMode.
 b('open','http://localhost:5177/report/qa-20261113-does-not-exist');b('wait','2000');text=b('get','text','body');(OUT/'browser-missing-report.txt').write_text(text)
 check('Frontend','unknown report does not spin forever','Inspection not found' in text,'browser-missing-report')
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill()
