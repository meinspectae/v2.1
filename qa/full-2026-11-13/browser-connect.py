import http.cookiejar,json,subprocess,pathlib
from http_client import PRIVATE,OUT
jar=http.cookiejar.MozillaCookieJar(str(PRIVATE/'N.cookies'));jar.load(ignore_discard=True,ignore_expires=True)
# Set QA cookies via the existing browser's CDP connection without printing values.
r=subprocess.run(['agent-browser','--session','full-qa','get','cdp-url'],capture_output=True,text=True)
url=r.stdout.strip()
if not url.startswith('ws'):raise RuntimeError('Browser CDP unavailable')
# Browser CLI state loading requires a restart; use browser fetch token URL through script stdin instead.
# A private Netscape cookie jar is imported as Playwright-format browser state.
cookies=[{'name':c.name,'value':c.value,'domain':c.domain,'path':c.path,'expires':c.expires or -1,'httpOnly':True,'secure':c.secure,'sameSite':'None'} for c in jar]
state=PRIVATE/'browser-state.json';state.write_text(json.dumps({'cookies':cookies,'origins':[]}));state.chmod(0o600)
r=subprocess.run(['agent-browser','--session','full-qa','state','load',str(state)],capture_output=True,text=True)
print('QA browser cookie import exit',r.returncode)
print(r.stdout if 'token' not in r.stdout.lower() else '[state imported]')
