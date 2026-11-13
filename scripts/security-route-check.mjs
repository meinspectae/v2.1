import assert from 'node:assert/strict';
import { createApp, tables } from '../backend/dist/bundle.js';

const tableNames = new Map([
  [tables.inspections, 'inspections'],
  [tables.emailSendEvents, 'emailSendEvents'],
  [tables.users, 'users'],
  [tables.orders, 'orders'],
]);

function makeEdgespark({
  userId = 'tester-user',
  userEmail = 'tester@example.com',
  adminIds = 'admin-user',
  inspection = null,
  events = [],
} = {}) {
  const state = {
    events: [...events],
    deleted: [],
    inserted: [],
    updated: [],
    resendRequests: [],
  };

  const rowsFor = (table) => {
    switch (tableNames.get(table)) {
      case 'inspections': return inspection?.userId === userId ? [inspection] : [];
      case 'emailSendEvents': return state.events;
      case 'users': return [{ id: userId, email: userEmail, name: 'Test User', isTester: 1, freeInspections: 0 }];
      case 'orders': return [];
      default: return [];
    }
  };

  const db = {
    select() {
      return {
        from(table) {
          const result = () => Promise.resolve(rowsFor(table));
          return {
            where: result,
            then(resolve, reject) { return result().then(resolve, reject); },
          };
        },
      };
    },
    insert(table) {
      return {
        values(value) {
          const tableName = tableNames.get(table);
          if (tableName === 'emailSendEvents') state.events.push(value);
          state.inserted.push({ table: tableName, value });
          const row = tableName === 'orders' ? { id: 1, ...value } : value;
          const promise = Promise.resolve([row]);
          return {
            returning() { return promise; },
            then(resolve, reject) { return promise.then(resolve, reject); },
          };
        },
      };
    },
    delete(table) {
      return {
        where() {
          state.deleted.push(tableNames.get(table));
          return Promise.resolve();
        },
      };
    },
    update(table) {
      return {
        set(value) {
          return {
            where() {
              state.updated.push({ table: tableNames.get(table), value });
              return Promise.resolve([]);
            },
          };
        },
      };
    },
  };

  return {
    edgespark: {
      db,
      auth: { user: { id: userId, email: userEmail, name: 'Test User' } },
      secret: {
        get(name) {
          if (name === 'ADMIN_USER_IDS') return adminIds;
          if (name === 'RESEND_API_KEY') return 'test-key';
          if (name === 'FROM_EMAIL') return 'MeInspect <hello@meinspect.com>';
          return null;
        },
      },
      storage: { from() { throw new Error('Storage was not expected in this test'); } },
      getDeployEnv() { return 'staging'; },
    },
    state,
  };
}

async function request(config, path, init) {
  const fixture = makeEdgespark(config);
  const app = await createApp(fixture.edgespark);
  const response = await app.request(`http://test.local${path}`, init);
  return { fixture, response, body: await response.json() };
}

const baseInspection = {
  id: 'inspection-1',
  userId: 'tester-user',
  status: 'draft',
  paymentData: '{}',
  reportGenerated: 0,
  completedAt: null,
  tenantData: '{}',
  landlordData: '{}',
  agentData: '{}',
  propertyData: '{}',
  extraData: '{}',
};

{
  const denied = await request({}, '/api/admin/access');
  assert.equal(denied.response.status, 403);
  assert.equal(denied.body.error, 'Admin access required');

  const testerCannotPromote = await request({}, '/api/admin/set-tester', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'another@example.com', isTester: true }),
  });
  assert.equal(testerCannotPromote.response.status, 403);

  const allowed = await request({ userId: 'admin-user' }, '/api/admin/access');
  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.body.isAdmin, true);

  const testerCheckout = await request({ inspection: baseInspection }, '/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionId: 'inspection-1', amount: 199, currency: 'AED' }),
  });
  assert.equal(testerCheckout.response.status, 200);
  assert.equal(testerCheckout.body.status, 'paid');
  assert.match(testerCheckout.body.sessionId, /^tester_/);
  assert.equal(testerCheckout.fixture.state.inserted.find(entry => entry.table === 'orders')?.value.provider, 'tester');
  assert.equal(JSON.parse(testerCheckout.fixture.state.updated.find(entry => entry.table === 'inspections')?.value.paymentData).paid, true);
  console.log('PASS admin: non-admin tester 403, tester promotion 403, configured admin 200, tester free checkout 200');
}

{
  const draft = await request({ inspection: baseInspection }, '/api/inspections/inspection-1', { method: 'DELETE' });
  assert.equal(draft.response.status, 200);
  assert.deepEqual(draft.fixture.state.deleted, ['inspections']);

  const paid = await request({ inspection: { ...baseInspection, paymentData: JSON.stringify({ paid: true }) } }, '/api/inspections/inspection-1', { method: 'DELETE' });
  assert.equal(paid.response.status, 409);
  assert.match(paid.body.error, /Paid or finalised inspections cannot be deleted/);

  const finalised = await request({ inspection: { ...baseInspection, status: 'finalised' } }, '/api/inspections/inspection-1', { method: 'DELETE' });
  assert.equal(finalised.response.status, 409);
  assert.match(finalised.body.error, /Paid or finalised inspections cannot be deleted/);
  console.log('PASS delete: draft 200, paid 409, finalised 409');
}

{
  const customPayload = await request({ inspection: baseInspection }, '/api/send-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionId: 'inspection-1', to: 'attacker@example.com', html: '<b>attack</b>' }),
  });
  assert.equal(customPayload.response.status, 400);

  const unowned = await request({ inspection: { ...baseInspection, userId: 'someone-else' } }, '/api/send-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionId: 'inspection-1' }),
  });
  assert.equal(unowned.response.status, 404);

  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), payload: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ id: `email-${sent.length}` }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const ownedInspection = {
      ...baseInspection,
      propertyData: JSON.stringify({ buildingName: '<script>alert(1)</script>', city: 'Dubai & UAE' }),
      tenantData: JSON.stringify({ name: 'Tenant', email: 'tenant@example.com' }),
      landlordData: JSON.stringify({ name: 'Landlord', email: 'landlord@example.com' }),
      agentData: JSON.stringify({ name: 'Agent', email: 'agent@example.com' }),
    };
    const sentResult = await request({ inspection: ownedInspection }, '/api/send-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'inspection-1' }),
    });
    assert.equal(sentResult.response.status, 200);
    assert.equal(sentResult.body.sentCount, 4);
    assert.deepEqual(sent.flatMap(entry => entry.payload.to).sort(), [
      'agent@example.com',
      'landlord@example.com',
      'tenant@example.com',
      'tester@example.com',
    ]);
    for (const entry of sent) {
      assert.equal(entry.payload.from, 'MeInspect <hello@meinspect.com>');
      assert.equal(entry.payload.subject, 'MeInspect report RPT-INSPECTI');
      assert.match(entry.payload.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
      assert.doesNotMatch(entry.payload.html, /<script>alert\(1\)<\/script>/);
      assert.match(entry.payload.html, /Dubai &amp; UAE/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  const now = Math.floor(Date.now() / 1000);
  const limited = await request({
    inspection: baseInspection,
    events: [{ id: 'previous', userId: 'tester-user', inspectionId: 'inspection-0', recipientCount: 30, sentAt: now }],
  }, '/api/send-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionId: 'inspection-1' }),
  });
  assert.equal(limited.response.status, 429);
  assert.match(limited.body.error, /at most 30 emails per hour/);
  console.log('PASS email: custom fields 400, unowned 404, fixed recipients/template 200, escaped text, 30-recipient limit 429');
}
