import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { readFileSync,writeFileSync } from 'node:fs';
import {createApp,tables} from '../backend/dist/bundle.js';
const require=createRequire(new URL('../backend/package.json',import.meta.url));const {drizzle}=require('drizzle-orm/sqlite-proxy');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('backend/src/__generated__/db_raw_schema.sql','utf8'));
const db=drizzle(async(q,p,m)=>{const s=sqlite.prepare(q);if(m==='run')return {rows:[],...s.run(...p)};s.setReturnArrays(true);const rows=s.all(...p);return {rows:m==='get'?rows[0]:rows};},{schema:tables});
const signed=[];const app=await createApp({db,auth:{user:{id:'qa-attacker',email:'qa@example.invalid'}},secret:{get:()=>null},storage:{from:()=>({createPresignedGetUrl:async path=>{signed.push(path);return {downloadUrl:'https://qa.invalid/owned'}}})},getDeployEnv:()=> 'staging'});
const cases=[['foreign','reports/qa-owner/private.pdf',403],['valid','reports/qa-attacker/report.pdf',200],['nested','reports/qa-attacker/report/final/a.pdf',200],['traversal','reports/qa-attacker/../qa-owner/private.pdf',403],['encoded','reports/qa-attacker/%2e%2e/qa-owner/private.pdf',403],['url','https://qa.invalid/private.pdf',403]];
const results=[];for(const [id,path,expected] of cases){sqlite.prepare('INSERT INTO inspections(id,user_id,pdf_url) VALUES(?,?,?)').run(id,'qa-attacker',path);const before=signed.length;const r=await app.request('/api/download/pdf/'+id);results.push({id,status:r.status,expected,signed:signed.length-before,result:r.status===expected&&(expected===200||signed.length===before)?'PASS':'FAIL'});}
writeFileSync('qa/full-2026-11-13/pdf-access-local.json',JSON.stringify({scope:'actual handlers isolated SQLite; mock signing',results},null,2));console.log(JSON.stringify(results));sqlite.close();process.exitCode=results.every(r=>r.result==='PASS')?0:1;
