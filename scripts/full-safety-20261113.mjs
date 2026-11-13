// Executes actual bundled handlers with the actual Drizzle D1 adapter and isolated
// SQLite backing its D1 binding. No network, real credentials, or shared DB writes.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createApp, tables } from '../backend/dist/bundle.js';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { drizzle } = require('drizzle-orm/d1');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../backend/src/__generated__/db_raw_schema.sql', import.meta.url), 'utf8'));
const evidence = [];
const created = [];
const deleted = [];
const queries = [];
let failurePattern = null;
let gatePattern = null;
let releaseGate;
let gateReached;
let gatePromise;
const waitForGate = () => new Promise(resolve => { gateReached = resolve; });
class Statement {
  constructor(query, params = []) { this.query = query; this.params = params; }
  bind(...params) { return new Statement(this.query, params); }
  execute(arrayMode = false) {
    queries.push(this.query);
    if (failurePattern && failurePattern.test(this.query)) throw new Error('Injected QA write failure');
    const stmt = sqlite.prepare(this.query);
    if (arrayMode) stmt.setReturnArrays(true);
    if (/^\s*select\b|\breturning\b/i.test(this.query)) return stmt.all(...this.params);
    stmt.run(...this.params);
    return [];
  }
  async raw() {
    if (gatePattern && gatePattern.test(this.query)) {
      gatePattern = null;
      gateReached();
      await gatePromise;
    }
    return this.execute(true);
  }
  async all() { return { success: true, results: this.execute() }; }
  async run() { return { success: true, results: this.execute() }; }
}
const binding = {
  prepare: query => new Statement(query),
  batch: async statements => {
    sqlite.exec('BEGIN');
    try {
      const result = statements.map(stmt => ({ success: true, results: stmt.execute() }));
      sqlite.exec('COMMIT');
      return result;
    } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};
const db = drizzle(binding, { schema: tables });
const dummy = 'whsec_local_dummy_not_a_real_secret';
let sent = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { sent++; throw new Error('Network is prohibited in this harness'); };
const appFor = async (id, opts = {}) => {
  const reads = opts.reads || [];
  return createApp({
    db, auth: { user: id ? { id, email: 'qa@example.invalid', name: 'Local QA' } : null },
    secret: { get: name => {
      reads.push(name);
      return ({ ADMIN_USER_IDS: 'qa-allowlisted', STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_PRICE_ID: 'price_dummy', ...(opts.noSigning ? {} : { StripeSigningSecret: dummy }) })[name] || null;
    } },
    storage: {}, getDeployEnv: () => opts.env || 'production',
  });
};
const call = (app, path, body, method) => app.request(path, {
  method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
function pass(item, details) { evidence.push({ item, result: 'PASS', evidence: details }); console.log('PASS local:', item, JSON.stringify(details)); }
function user(id, credits = 0, admin = 0, tester = 0) {
  sqlite.prepare('INSERT INTO users (id,email,name,free_inspections,is_admin,is_tester) VALUES (?,?,?,?,?,?)').run(id, id+'@example.invalid', 'Local QA', credits, admin, tester);
  created.push({table:'users',id});
}
function report(id, owner, payment = '{}') {
  sqlite.prepare('INSERT INTO inspections (id,user_id,created_at,updated_at,payment_data) VALUES (?,?,?,?,?)').run(id, owner, '2026-11-11', '2026-11-11',payment);
  created.push({table:'inspections',id});
}
function order(sessionId, reportId, userId) {
  const row = sqlite.prepare("INSERT INTO orders (environment,user_id,inspection_id,amount,status,provider,provider_session_id) VALUES ('production',?,?,199,'pending','stripe',?) RETURNING id").get(userId,reportId,sessionId);
  created.push({table:'orders',id:row.id});
}
function event(id, inspectionId, paymentStatus = 'paid') {
  return JSON.stringify({ id: 'evt_'+id.replaceAll('-',''), object:'event', type:'checkout.session.completed', data: {object: { id:'cs_'+id, object:'checkout.session', metadata:{reportId:inspectionId}, payment_status:paymentStatus, amount_total:19900, currency:'aed', payment_intent:'pi_dummy' }}});
}
function webhook(app, body, signing = dummy) {
  const timestamp = Math.floor(Date.now()/1000);
  const signature = signing === null ? null : `t=${timestamp},v1=${createHmac('sha256', signing).update(timestamp+'.'+body).digest('hex')}`;
  return app.request('/api/webhooks/stripe', {method:'POST',headers:{'Content-Type':'application/json',...(signature ? {'stripe-signature':signature} : {})},body});
}
try {
  user('qa-normal'); user('qa-tester',0,0,1); user('qa-flag-admin',0,1); user('qa-allowlisted');
  for (const id of ['qa-normal','qa-tester']) {
    const app = await appFor(id);
    for (const [path,method] of [['/api/admin/access','GET'],['/api/admin/prices','GET'],['/api/admin/set-tester','POST'],['/api/admin/audit-stripe-unlocks','POST'],['/api/admin/future-route','GET']]) {
      const r = await call(app,path,method==='POST'?{email:'qa-normal@example.invalid',isTester:true}:null,method);
      assert.equal(r.status,403); pass(id+' denied '+path,{status:r.status});
    }
  }
  assert.equal(sqlite.prepare('SELECT is_tester FROM users WHERE id=?').get('qa-normal').is_tester,0);
  pass('tester cannot create another tester',{targetTesterFlag:0});
  for (const id of ['qa-flag-admin','qa-allowlisted']) {
    const r = await call(await appFor(id),'/api/admin/access'); assert.equal(r.status,200); pass(id+' granted admin',{status:r.status});
  }

  for (const mode of ['different-reports','same-report','same-report-two-credits']) {
    const id='qa-credit-'+mode;
    user(id,mode==='same-report-two-credits'?2:1);
    report(id+'-a',id); report(id+'-b',id);
    const app=await appFor(id);
    const start=queries.length;
    const responses=await Promise.all([
      call(app,'/api/checkout',{inspectionId:id+'-a',amount:199}),
      call(app,'/api/checkout',{inspectionId:id+(mode==='different-reports'?'-b':'-a'),amount:199}),
    ]);
    const balance=sqlite.prepare('SELECT free_inspections FROM users WHERE id=?').get(id).free_inspections;
    const orders=sqlite.prepare('SELECT id FROM orders WHERE user_id=?').all(id);
    const paid=sqlite.prepare("SELECT COUNT(*) n FROM inspections WHERE user_id=? AND json_extract(payment_data,'$.paid')=1").get(id).n;
    assert.equal(balance,mode==='same-report-two-credits'?1:0);
    assert.equal(orders.length,1); assert.equal(paid,1);
    assert.deepEqual(responses.map(r=>r.status).sort(),mode==='different-reports'?[200,409]:[200,200]);
    const debitQueries=queries.slice(start).filter(q=>q.startsWith('update "users"'));
    assert.ok(debitQueries.every(q=>q.includes('free_inspections') && q.includes('EXISTS') && q.includes(' > 0')));
    pass('parallel credits '+mode,{statuses:responses.map(r=>r.status),balance,paidOrders:orders.length,unlocks:paid});
    for (const row of orders) created.push({table:'orders',id:row.id});
    // Data-only cleanup: orders are intentionally never deleted. No FK to users.
    sqlite.prepare('DELETE FROM users WHERE id=?').run(id); deleted.push({table:'users',id});
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM users WHERE id=?').get(id).n,0);
  }
  user('qa-credit-rollback',1);report('qa-credit-rollback-report','qa-credit-rollback');
  failurePattern=/^insert into "orders"/i;
  const failed=await call(await appFor('qa-credit-rollback'),'/api/checkout',{inspectionId:'qa-credit-rollback-report',amount:199});
  failurePattern=null;
  assert.equal(failed.status,500);
  assert.equal(sqlite.prepare('SELECT free_inspections FROM users WHERE id=?').get('qa-credit-rollback').free_inspections,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders WHERE user_id=?').get('qa-credit-rollback').n,0);
  pass('credit order failure rolls debit back',{status:500,balance:1,orders:0});

  const reads=[];
  const app=await appFor(null,{reads});
  const invalid=JSON.stringify({id:'invalid-id',type:'checkout.session.completed',data:{object:{metadata:{reportId:'none'}}}});
  for(const [label,key] of [['unsigned',null],['wrong-signature','dummy_wrong']]) {
    const count=queries.length;const r=await webhook(app,invalid,key);assert.equal(r.status,400);assert.equal(queries.length,count);
    pass('webhook '+label,{status:r.status,databaseQueries:0});
  }
  // No user email row for webhook QA IDs: prevents even mocked notification sends.
  for(const status of ['paid','no_payment_required']) {
    const id='webhook-'+status;report(id,'qa-webhook');order('cs_'+id,id,'qa-webhook');
    const body=event(id,id,status);const r=await webhook(app,body);assert.equal(r.status,200);
    assert.equal(JSON.parse(sqlite.prepare('SELECT payment_data FROM inspections WHERE id=?').get(id).payment_data).paid,true);
    const before=queries.filter(q=>q.startsWith('update "inspections"')).length;
    const duplicate=await webhook(app,body);assert.equal(duplicate.status,200);
    assert.equal(queries.filter(q=>q.startsWith('update "inspections"')).length,before);
    pass('signed '+status+' and duplicate',{statuses:[200,200],unlockTransitions:1});
  }
  report('webhook-parallel','qa-webhook');order('cs_parallel','webhook-parallel','qa-webhook');
  const parallelBody=event('parallel','webhook-parallel');
  const parallel=await Promise.all([webhook(app,parallelBody),webhook(app,parallelBody)]);
  assert.deepEqual(parallel.map(r=>r.status),[200,200]);
  pass('concurrent duplicate signed event',{statuses:[200,200],paidOrders:sqlite.prepare("SELECT COUNT(*) n FROM orders WHERE provider_session_id='cs_parallel' AND status='paid'").get().n});
  const missing=await webhook(app,event('missing','report-no-longer-exists'));assert.equal(missing.status,200);
  pass('missing report acknowledged and logged',{status:200,writeRequired:false});

  report('webhook-delayed','qa-webhook');order('cs_delayed','webhook-delayed','qa-webhook');
  gatePromise=new Promise(resolve=>{releaseGate=resolve;});const reached=waitForGate();gatePattern=/^update "inspections"/i;
  let responded=false;const delayed=webhook(app,event('delayed','webhook-delayed')).then(r=>{responded=true;return r;});
  await reached; await new Promise(resolve=>setTimeout(resolve,25));assert.equal(responded,false);
  assert.equal(JSON.parse(sqlite.prepare('SELECT payment_data FROM inspections WHERE id=?').get('webhook-delayed').payment_data).paid,undefined);
  releaseGate();const done=await delayed;assert.equal(done.status,200);
  assert.equal(JSON.parse(sqlite.prepare('SELECT payment_data FROM inspections WHERE id=?').get('webhook-delayed').payment_data).paid,true);
  pass('200 waits for database unlock write',{respondedBeforeWrite:false,statusAfterWrite:200});
  report('webhook-failed','qa-webhook');order('cs_failed','webhook-failed','qa-webhook');failurePattern=/^update "inspections"/i;
  const writeFail=await webhook(app,event('failed','webhook-failed'));failurePattern=null;assert.equal(writeFail.status,500);
  pass('failed database write not acknowledged',{status:500});
  const stagingReads=[];const staging=await appFor(null,{env:'staging',reads:stagingReads,noSigning:true});
  const stagingResponse=await webhook(staging,event('stage','none'));
  assert.equal(stagingResponse.status,500);assert.equal((await stagingResponse.json()).error,'Webhook not configured');
  assert.ok(stagingReads.includes('SANDBOX_STRIPE_WEBHOOK_SECRET'));assert.ok(!stagingReads.includes('StripeSigningSecret'));
  assert.ok(reads.includes('StripeSigningSecret'));assert.ok(!reads.includes('STRIPE_WEBHOOK_SECRET'));
  pass('staging webhook never reads live signing secret',{status:500,SANDBOX_STRIPE_WEBHOOK_SECRET:true,StripeSigningSecret:false});
  assert.equal(sent,0);pass('harness made no external calls',{networkCalls:sent});

  const fallbackLogs=[]; const originalWarn=console.warn;
  console.warn=(...args)=>{fallbackLogs.push(args.join(' '));originalWarn(...args);};
  let retrievals=0; let returnedEvent=null; let retrievalFails=false;
  globalThis.fetch=async (url, init)=>{
    const target=String(url instanceof Request ? url.url : url);
    assert.match(target,/^https:\/\/api\.stripe\.com\/v1\/events\/evt_[A-Za-z0-9]+$/);
    retrievals++;
    return Response.json(retrievalFails ? {error:{type:'invalid_request_error',message:'No such event',code:'resource_missing'}} : returnedEvent,
      {status:retrievalFails?404:200,headers:{'request-id':'req_local_mock'}});
  };
  try {
    for(const badId of ['evt_bad/path','evt_bad?x=1','evt_bad_underscore','evt_','../evt_bad']) {
      const before=retrievals; const r=await webhook(app,JSON.stringify({id:badId}),null);
      assert.equal(r.status,400);assert.equal(retrievals,before);
    }
    pass('fallback rejects malformed event IDs without lookup',{cases:5,status:400});
    report('fallback-authoritative','qa-webhook');order('cs_authoritative','fallback-authoritative','qa-webhook');
    returnedEvent=JSON.parse(event('authoritative','fallback-authoritative'));
    const untrustedBody=event('claimed','untrusted-report');
    gatePromise=new Promise(resolve=>{releaseGate=resolve;});const reachedFallback=waitForGate();gatePattern=/^update "inspections"/i;
    let fallbackResponded=false;
    const pendingFallback=webhook(app,untrustedBody,'dummy_wrong').then(r=>{fallbackResponded=true;return r;});
    await reachedFallback;await new Promise(resolve=>setTimeout(resolve,25));assert.equal(fallbackResponded,false);
    releaseGate();const fallbackResponse=await pendingFallback;assert.equal(fallbackResponse.status,200);
    const paidFallback=JSON.parse(sqlite.prepare('SELECT payment_data FROM inspections WHERE id=?').get('fallback-authoritative').payment_data);
    assert.equal(paidFallback.paid,true);assert.equal(paidFallback.confirmedBy,'webhook_fallback');
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM inspections WHERE id=?').get('untrusted-report').n,0);
    pass('fallback uses only Stripe-returned event and waits for write',{status:200,respondedBeforeWrite:false,untrustedReportCreated:false});
    const repeated=await webhook(app,untrustedBody,null);assert.equal(repeated.status,200);
    pass('unsigned valid event ID uses retrieval and duplicate is idempotent',{status:200});
    report('fallback-write-fail','qa-webhook');order('cs_fallbackfail','fallback-write-fail','qa-webhook');
    returnedEvent=JSON.parse(event('fallbackfail','fallback-write-fail'));failurePattern=/^update "inspections"/i;
    const fallbackFailure=await webhook(app,untrustedBody,'dummy_wrong');failurePattern=null;assert.equal(fallbackFailure.status,500);
    pass('fallback write failure is not acknowledged',{status:500});
    retrievalFails=true;const rejected=await webhook(app,untrustedBody,null);assert.equal(rejected.status,400);
    pass('fallback Stripe retrieval rejection',{status:400});
    assert.equal(fallbackLogs.filter(s=>s.includes('signature verification failed; retrieving')).length,retrievals);
    pass('every fallback lookup is logged',{mockRetrievals:retrievals,attemptLogs:retrievals,realExternalCalls:0});
  } finally {console.warn=originalWarn;failurePattern=null;}

  console.log(JSON.stringify({result:'PASS',assertions:evidence.length,scope:'actual bundled handlers, real SQLite via D1 adapter, dummy signing secret; NOT live staging acceptance'}));
} finally {
  globalThis.fetch=originalFetch;
  writeFileSync('qa/full-2026-11-13/local-safety-results.json',JSON.stringify({evidence,created,deleted,scope:'isolated in-memory SQLite; no shared QA records created or changed; orders/payments never deleted'},null,2));
  sqlite.close();
}
