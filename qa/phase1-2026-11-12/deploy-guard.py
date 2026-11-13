"""Run the unmodified pinned CLI and stop immediately on schema changes."""
import hashlib,json,pathlib,re,subprocess,sys,os,selectors,time
root=pathlib.Path.cwd();out=root/'qa/phase1-2026-11-12'
mode=sys.argv[1];assert mode in ['dry-run','staging']
restore=json.loads((out/'restore-manifest.json').read_text())
protected={p:h for p,h in restore['files'].items() if p.startswith('backend/src/__generated__/') or p.startswith('backend/migrations/') or p=='backend/schema.sql'}
def identical():
    return all((root/p).is_file() and hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in protected.items())
assert identical(),'STOP: schema differs from restore point before command'
assert json.loads((root/'backend/node_modules/@edgespark/cli/package.json').read_text())['version']=='0.0.12'
if mode=='staging':
    prior=json.loads((out/'dry-run-check.json').read_text());assert prior['exitCode']==0 and prior['noSchemaChangesReported'] and prior['schemaByteIdentical']
cmd=['node','node_modules/@edgespark/cli/dist/cli.js','deploy']+(['--dry-run'] if mode=='dry-run' else [])
process=subprocess.Popen(cmd,cwd=root/'backend',stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
lines=[];stop=False
# Only sanitized output is retained. Never expose URLs with tokens or credentials.
def sanitize(line):
    line=re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',line)
    line=re.sub(r'https?://[^\s]+','[deployment URL omitted]',line)
    line=re.sub(r'(?i)\b(sk_(?:live|test)_|whsec_)[A-Za-z0-9_-]+','[redacted]',line)
    return line
for line in process.stdout:
    clean=sanitize(line);lines.append(clean);print(clean,end='',flush=True)
    if not identical() or (re.search(r'schema.*(updated|changed|generated|changes detected)|(?:applying|applied).*migration',clean,re.I) and 'no changes' not in clean.lower()):
        process.terminate();stop=True;print('STOP: schema change detected; terminating CLI',flush=True);break
try:code=process.wait(timeout=15)
except subprocess.TimeoutExpired:process.kill();code=process.wait()
text=''.join(lines);(out/(mode+'-output.txt')).write_text(text)
check={'cliVersion':'0.0.12','exitCode':code,'noSchemaChangesReported':'Schema up to date (no changes)' in text,'schemaByteIdentical':identical(),'schemaFilesChecked':len(protected),'stoppedForChange':stop,'sourceSha256':hashlib.sha256((root/'backend/src/index.ts').read_bytes()).hexdigest(),'bundleSha256':hashlib.sha256((root/'backend/dist/bundle.js').read_bytes()).hexdigest()}
(out/(mode+'-check.json')).write_text(json.dumps(check,indent=2));print(json.dumps(check,indent=2))
if stop or code!=0 or not check['noSchemaChangesReported'] or not check['schemaByteIdentical']:sys.exit(1)
