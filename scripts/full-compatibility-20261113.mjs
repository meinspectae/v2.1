import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createApp, tables } from '../backend/dist/bundle.js';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { drizzle } = require('drizzle-orm/sqlite-proxy');
const connection = new DatabaseSync(':memory:');
connection.exec(readFileSync(new URL('../backend/src/__generated__/db_raw_schema.sql', import.meta.url), 'utf8'));
const localOperations = [];
const db = drizzle(async (query, params, method) => {
  if (/^\s*(insert|delete|update)\b/i.test(query)) localOperations.push({ query, params });
  const stmt = connection.prepare(query);
  if (method === 'run') return { rows: [], ...stmt.run(...params) };
  stmt.setReturnArrays(true);
  const rows = stmt.all(...params);
  return { rows: method === 'get' ? rows[0] : rows };
}, { schema: tables });
const sent = [];
let providerFailure = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.equal(url, 'https://api.resend.com/emails');
  sent.push(JSON.parse(init.body));
  return Response.json(providerFailure ? { message: 'Provider unavailable' } : { id: 'mock-send-' + sent.length }, { status: providerFailure ? 422 : 200 });
};
let assertions = 0;
function ok(condition, description) { assert.ok(condition, description); console.log('PASS (local SQLite/provider mock):', description); assertions++; }
const appFor = async (id='qa', admin='owner') => createApp({
  db, auth: { user: { id, email: 'aalekh.dxb@gmail.com', name: 'QA' } },
  secret: { get: name => ({ ADMIN_USER_IDS: admin, RESEND_API_KEY: 'mock-key', FROM_EMAIL: 'MeInspect <hello@meinspect.com>' }[name]) },
  storage: {}, getDeployEnv: () => 'staging',
});
const app = await appFor();
const call = (app,path,body,method) => app.request(path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type':'application/json' }, ...(body && method !== 'GET' ? {body:JSON.stringify(body)} : {}) });
const insert = (id, changes={}) => db.insert(tables.inspections).values({id,userId:'qa',createdAt:'2026-11-10',updatedAt:'2026-11-10',...changes});
try {
  for (const path of ['/api/admin/prices','/api/admin/set-tester','/api/admin/audit-stripe-unlocks','/api/admin/not-yet-defined']) {
    const res=await call(app,path,{},path.endsWith('prices')?'GET':'POST');ok(res.status===403, 'normal/tester admin prefix blocked '+path);
  }
  const owner=await appFor('owner');ok((await call(owner,'/api/admin/access')).status===200,'allowlisted owner retains access');
  ok((await call(await appFor('owner',''),'/api/admin/access')).status===403,'empty allowlist fails closed');
  for (const [id,changes] of [['paid',{paymentData:'{"paid":true}'}],['completed',{status:'completed'}],['finalised',{status:'finalised'}],['report',{reportGenerated:1}],['timestamp',{completedAt:'2026-11-10'}]]) {
    await insert(id,changes);ok((await call(app,'/api/inspections/'+id,null,'DELETE')).status===409,id+' deletion protected');
  }
  await insert('registered');await db.insert(tables.reportVerifications).values({id:'reg',inspectionId:'registered',userId:'qa',contentHash:'hash',pdfHash:'hash',pdfPath:'qa.pdf',createdAt:'2026-11-10'});
  ok((await call(app,'/api/inspections/registered',null,'DELETE')).status===409,'registered PDF protected even when row says draft');
  await insert('payment');await db.insert(tables.payments).values({inspectionId:'payment',paid:0});
  ok((await call(app,'/api/inspections/payment',null,'DELETE')).status===409,'unpaid payments cannot cascade-delete');
  ok(connection.prepare('SELECT COUNT(*) AS n FROM payments').get().n===1,'payment record retained');
  await insert('order');await db.insert(tables.orders).values({inspectionId:'order',userId:'qa',amount:0,status:'paid'});
  ok((await call(app,'/api/inspections/order',null,'DELETE')).status===409,'paid order authoritative even when row says unpaid');
  await insert('draft');ok((await call(app,'/api/inspections/draft',null,'DELETE')).status===200,'unpaid unfinalised draft deletes');
  const captured=JSON.parse(readFileSync(new URL('../qa/phase1-2026-11-10/legacy-real-request.json',import.meta.url),'utf8'));
  let res=await call(app,'/api/send-email',captured), data=await res.json();
  ok(res.status===200 && data.success && data.sentCount===1,'captured real legacy request remains accepted');
  ok(JSON.stringify(Object.keys(data).sort())===JSON.stringify(['success','results','sentCount','failedCount'].sort()),'legacy success response shape unchanged');
  const clean=sent.at(-1).html;
  ok(clean.includes('<table')&&clean.includes('padding:')&&clean.includes('linear-gradient')&&clean.includes('Download PDF Report'), 'real email table styles gradient and signed PDF download preserved');
  const hostile='<p style="color:red;padding:12px" onclick="alert(1)">Arabic عربي 😀</p><script>alert(1)</script><iframe src="https://evil.invalid">bad</iframe><a href="java&#x73;cript:alert(1)">bad</a><a href="https://app.meinspect.com/report/test?x=1&amp;y=2">good</a><img src="https://app.meinspect.com/meinspect-logo.png" onerror="alert(1)"><table><tr><td colspan="2">ok</td></tr></table><img src="data:image/svg+xml;base64,abc"><p style="background-image:url(javascript:alert(1));color:blue">css</p>';
  res=await call(app,'/api/send-email',{to:'aalekh.dxb@gmail.com',subject:'QA',html:hostile,from:'attacker@evil.invalid'});
  ok(res.status===200,'legacy string recipient and ignored from accepted');
  const mail=sent.at(-1);ok(mail.from==='MeInspect <hello@meinspect.com>','client sender ignored');
  ok(!/<script|<iframe|\son\w+=|javascript:|data:image\/svg|url\(/i.test(mail.html),'scripts frames handlers encoded javascript SVG and executable CSS removed');
  ok(mail.html.includes('color:red')&&mail.html.includes('<table>')&&mail.html.includes('colspan="2"')&&mail.html.includes('<img src="https:')&&mail.html.includes('عربي 😀'),'normal styles tables images and multilingual text preserved');
  await insert('owned',{tenantData:'{"email":"party@example.com"}'});
  res=await call(app,'/api/send-email',{to:['party@example.com'],subject:'QA',html:'<p>Hi</p>'});ok(res.status===200,'owned inspection party accepted by legacy contract');
  res=await call(app,'/api/send-email',{to:['unrelated@example.com'],subject:'QA',html:'<p>Hi</p>'});ok(res.status===403,'unrelated recipient denied');
  res=await call(app,'/api/send-email',{inspectionId:'owned'});data=await res.json();ok(res.status===200&&data.sentCount===2,'new inspectionId format sends own email plus contact');
  res=await call(app,'/api/send-email',{inspectionId:'other-owner'});ok(res.status===404,'new format enforces ownership');
  providerFailure=true;res=await call(app,'/api/send-email',captured);data=await res.json();ok(res.status===200&&!data.success&&data.failedCount===1&&data.error==='Provider unavailable','legacy provider failure HTTP and response preserved');providerFailure=false;
  const deletedEmailEvents = connection.prepare('SELECT id FROM email_send_events').all().map(row => row.id);
  localOperations.push({ directFixtureOperation: 'DELETE email_send_events', deletedIds: deletedEmailEvents });
  connection.exec('DELETE FROM email_send_events');
  const now=Math.floor(Date.now()/1000);connection.prepare('INSERT INTO email_send_events VALUES (?,?,?,?,?)').run('boundary','qa','',29,now);
  const before=sent.length;
  const responses=await Promise.all([call(app,'/api/send-email',captured),call(app,'/api/send-email',captured)]);
  ok(responses.map(x=>x.status).sort().join(',')==='200,429','two concurrent sends with one slot allow exactly one');
  ok(sent.length===before+1&&connection.prepare('SELECT SUM(recipient_count) AS n FROM email_send_events').get().n===30,'atomic reservation and recipient count capped at 30');
  const count=connection.prepare('SELECT COUNT(*) AS n FROM email_send_events').get().n;
  res=await call(app,'/api/send-email',captured);ok(res.status===429&&connection.prepare('SELECT COUNT(*) AS n FROM email_send_events').get().n===count,'rejected retries do not extend quota');
  connection.prepare('UPDATE email_send_events SET sent_at=?').run(now-3601);
  ok((await call(app,'/api/send-email',captured)).status===200,'rolling hour expires');
  await insert('account-draft');
  const orderCount=connection.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  const paymentCount=connection.prepare('SELECT COUNT(*) AS n FROM payments').get().n;
  res=await call(app,'/api/user/account',null,'DELETE');
  ok(res.status===200,'account deletion still succeeds locally');
  ok(!connection.prepare('SELECT id FROM inspections WHERE id=?').get('account-draft'),'account deletion removes disposable drafts');
  ok(connection.prepare('SELECT id FROM inspections WHERE id=?').get('payment')&&connection.prepare('SELECT id FROM inspections WHERE id=?').get('registered'),'account deletion retains financial and finalised inspection evidence');
  ok(connection.prepare('SELECT COUNT(*) AS n FROM orders').get().n===orderCount&&connection.prepare('SELECT COUNT(*) AS n FROM payments').get().n===paymentCount,'account deletion never cascades orders or payments');
  console.log(JSON.stringify({result:'PASS',assertions,scope:'local actual SQLite, mocked email provider; not live acceptance'}));
} finally {
  globalThis.fetch=originalFetch;
  const remainingEmailEvents = connection.prepare('SELECT id FROM email_send_events').all().map(row => row.id);
  writeFileSync('qa/full-2026-11-13/local-compatibility-operations.json', JSON.stringify({scope:'isolated local SQLite only',operations:localOperations,remainingEmailEvents}, null, 2));
  connection.close();
}
