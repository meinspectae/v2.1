from http_client import *
import hashlib,re,xml.etree.ElementTree as ET,urllib.parse
base='https://app.meinspect.com'
s,d,e,raw=request('public','live-frontend-html','/',url=base)
html=raw.decode();(OUT/'live-frontend.html').write_text(html)
queue=[urllib.parse.urljoin(base,u) for u in re.findall(r'<script[^>]+src="([^"]+\.js)"',html) if urllib.parse.urljoin(base,u).startswith(base+'/assets/')];seen=set();counts=[]
while queue:
 url=queue.pop(0)
 if url in seen:continue
 seen.add(url)
 assert url.startswith(base+'/assets/')
 s,d,e,raw=request('public','live-js-'+str(len(seen)),'',url=url)
 text=raw.decode(errors='replace');name=url.rsplit('/',1)[-1]
 counts.append({'name':name,'status':s,'cfRay':e['cfRay'],'sha256':hashlib.sha256(raw).hexdigest(),'production':text.count('https://olkmxpl1sliijytnc48w.youbase.cloud'),'staging':text.count('staging--')})
 for match in re.findall(r'["\']((?:\./|/assets/|assets/)?[A-Za-z0-9_.-]+\.js)["\']',text):
  nexturl=urllib.parse.urljoin(base+'/' if match.startswith('assets/') else url,match)
  if nexturl.startswith(base+'/assets/') and nexturl not in seen:queue.append(nexturl)
(OUT/'live-bundle-counts.json').write_text(json.dumps({'files':counts,'productionOccurrences':sum(x['production'] for x in counts),'stagingOccurrences':sum(x['staging'] for x in counts)},indent=2))
check('Release','live frontend production address once no staging',sum(x['production'] for x in counts)==1 and sum(x['staging'] for x in counts)==0 and all(x['status']==200 for x in counts),'live-bundle-counts',str(len(counts))+' actual live JS chunks')
manifest=ET.parse('android/app/src/main/AndroidManifest.xml').getroot();perms={e.get('{http://schemas.android.com/apk/res/android}name') for e in manifest.findall('uses-permission')}
gradle=pathlib.Path('android/app/build.gradle').read_text();backup=all(not any(e.get('domain')=='cache' for e in ET.parse(p).iter()) for p in ['android/app/src/main/res/xml/backup_rules.xml','android/app/src/main/res/xml/data_extraction_rules.xml'])
allowed={'android.permission.INTERNET','android.permission.CAMERA','android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_NETWORK_STATE'}
checks={'versionCode10':bool(re.search(r'versionCode\s+10\b',gradle)),'versionName35':bool(re.search(r'versionName\s+"3\.5"',gradle)),'noCacheDomain':backup,'onlyUsedPermissions':perms<=allowed,'noPasswordDefaults':'storePassword System.getenv("KEYSTORE_PASSWORD")' in gradle and 'keyPassword System.getenv("KEY_PASSWORD")' in gradle and not re.search(r'(?:storePassword|keyPassword).*?(?:\?:|\|\|)',gradle)}
(OUT/'android-static.json').write_text(json.dumps({'checks':checks,'permissions':sorted(perms),'scope':'source files only; no native build signing install'},indent=2));check('Android','release source settings',all(checks.values()),'android-static')
