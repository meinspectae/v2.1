import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync('src/components/EmailReportModal.tsx','utf8');
const logic=source.slice(source.indexOf('// Default email HTML template'));
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const scope={exports:{}};vm.createContext(scope);
vm.runInContext(transpile(readFileSync('src/utils/inspectionData.ts','utf8')),scope);
Object.assign(scope,scope.exports);vm.runInContext(transpile(logic),scope);
const payloads=['<script>alert(1)</script>','"><img src=x onerror=alert(1)>','{"__proto__":{"x":1}}','x'.repeat(5000),'مرحبا بالعالم','🏠🔑😀'];
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const results=[];
for(const text of payloads){
 const fixture={id:'qa-email',propertyType:'apartment',property:{area:text,city:text,buildingName:text,unitNumber:text,totalAreaSqft:12},landlord:{name:text},tenant:{name:text},meta:{inspectorName:text},rooms:[{id:'r',name:text,icon:text,items:[]}],overallPhotos:[],signatures:[],updatedAt:'2026-11-13'};
 const before=JSON.stringify(fixture);const html=scope.generateDefaultEmailHtml(text,'qa-email',fixture,'https://app.meinspect.com/sample-inspection-report.pdf');
 const passed=!/<script|<[^>]*\sonerror\s*=|<img src=x/i.test(html)&&html.includes(escape(text))&&JSON.stringify(fixture)===before;
 results.push({payload:text.length>80?'5000 characters':text,result:passed?'PASS':'FAIL'});
}
writeFileSync('qa/full-2026-11-13/email-escaping-'+(process.argv[2]||'current')+'.json',JSON.stringify({scope:'executed actual frontend email template in local harness',results},null,2));
console.log(JSON.stringify(results));process.exitCode=results.every(x=>x.result==='PASS')?0:1;
