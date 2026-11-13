"""Check Android release inputs without disclosing signing material."""
import hashlib, json, pathlib, re, xml.etree.ElementTree as ET
ROOT = pathlib.Path('.')
OUT = ROOT / 'qa/readiness-2026-11-06'
manifest = ET.parse(ROOT/'android/app/src/main/AndroidManifest.xml').getroot()
permissions = {n.get('{http://schemas.android.com/apk/res/android}name') for n in manifest.findall('uses-permission')}
gradle = (ROOT/'android/app/build.gradle').read_text()
backup_files = [ROOT/'android/app/src/main/res/xml/backup_rules.xml', ROOT/'android/app/src/main/res/xml/data_extraction_rules.xml']
backup_ok = all(not any(e.get('domain') == 'cache' for e in ET.parse(p).iter()) for p in backup_files)
js_files = sorted((ROOT/'android/app/src/main/assets/public/assets').glob('*.js'))
production = 'https://olkmxpl1sliijytnc48w.youbase.cloud'
production_count = sum(p.read_text().count(production) for p in js_files)
staging_count = sum(p.read_text().count('staging--') for p in js_files)
before = json.loads((OUT/'06-keystore-before.json').read_text())
after = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'keystore').glob('*') if p.is_file()}
# Report only locations of potential literal credentials, never their contents.
findings=[]
paths = set(ROOT.glob('*.md')) | set((ROOT/'docs').rglob('*.md')) | set((ROOT/'android').rglob('*.gradle')) | set((ROOT/'android').rglob('*.properties')) | set((ROOT/'playstore-assets').glob('*.md'))
for p in sorted(paths):
    for n,line in enumerate(p.read_text().splitlines(),1):
        if re.search(r'(?:storePassword|keyPassword|KEYSTORE_PASSWORD|KEY_PASSWORD|storepass|keypass)',line,re.I):
            safe = 'System.getenv' in line and not re.search(r'(?:\?:|\|\|)\s*[\'\"]',line)
            safe = safe or bool(re.search(r'\$\{?(?:KEYSTORE_PASSWORD|KEY_PASSWORD)',line))
            safe = safe or bool(re.search(r'environment|secure|no defaults|not |never|unset|unavailable',line,re.I))
            suspicious = bool(re.search(r'(?:PASSWORD\s*=\s*[\'\"]|Password\s+[\'\"]|-(?:storepass|keypass)\s+[^$\s])',line,re.I))
            if suspicious and not safe: findings.append({'file':str(p),'line':n})
checks = {
 'removedMediaPermission': 'android.permission.READ_MEDIA_IMAGES' not in permissions,
 'removedNotificationPermission': 'android.permission.POST_NOTIFICATIONS' not in permissions,
 'versionCode10': bool(re.search(r'versionCode\s+10\b',gradle)),
 'versionName35': bool(re.search(r'versionName\s+"3\.5"',gradle)),
 'noCacheBackupDomain': backup_ok,
 'passwordsFromEnvironmentOnly': 'storePassword System.getenv("KEYSTORE_PASSWORD")' in gradle and 'keyPassword System.getenv("KEY_PASSWORD")' in gradle,
 'noLiteralPasswordFindings': not findings,
 'productionAddressOnceInCopiedJS': production_count == 1,
 'noStagingInCopiedJS': staging_count == 0,
 'keystoreFilesUnchanged': before == after,
 'copiedBundleMatchesBuild': all((ROOT/'dist/assets'/p.name).exists() and p.read_bytes() == (ROOT/'dist/assets'/p.name).read_bytes() for p in js_files),
}
record={'checks':checks,'allPassed':all(checks.values()),'productionAddressOccurrences':production_count,'stagingOccurrences':staging_count,'copiedJavaScriptFiles':len(js_files),'keystoreFilesPreserved':len(after),'potentialCredentialLocations':findings,'nativeCompileAndSigning':'NOT RUN; not implied by sync'}
(OUT/'06-android-checks.json').write_text(json.dumps(record,indent=2))
print(json.dumps(record,indent=2))
raise SystemExit(0 if record['allPassed'] else 1)
