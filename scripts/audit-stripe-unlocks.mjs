#!/usr/bin/env node
/**
 * Read-only audit for successful Stripe Checkout payments whose MeInspect
 * report is not marked paid. It never writes to Stripe or the database.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY   Live Stripe restricted/secret key (read access)
 *   MEINSPECT_AUDIT_URL Production admin audit endpoint approved by the owner
 *   ADMIN_SECRET        MeInspect admin secret
 *
 * Usage after the production read-only audit endpoint is approved/deployed:
 *   node scripts/audit-stripe-unlocks.mjs
 */

const key = process.env.STRIPE_SECRET_KEY;
const auditUrl = process.env.MEINSPECT_AUDIT_URL;
const adminSecret = process.env.ADMIN_SECRET;
if (!key || !auditUrl || !adminSecret) {
  console.error('Set STRIPE_SECRET_KEY, MEINSPECT_AUDIT_URL, and ADMIN_SECRET.');
  process.exit(1);
}

const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
let startingAfter = '';
const succeeded = [];

do {
  const params = new URLSearchParams({ limit: '100', 'created[gte]': String(since) });
  if (startingAfter) params.set('starting_after', startingAfter);
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Stripe read failed (${response.status})`);
  const page = await response.json();
  for (const session of page.data || []) {
    if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
      const reportId = session.metadata?.reportId || session.metadata?.inspectionId;
      if (reportId) succeeded.push({
        reportId,
        sessionId: session.id,
        amount: (session.amount_total || 0) / 100,
        currency: String(session.currency || '').toUpperCase(),
        created: session.created,
      });
    }
  }
  startingAfter = page.has_more ? page.data.at(-1)?.id || '' : '';
} while (startingAfter);

const auditResponse = await fetch(auditUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
  body: JSON.stringify({ payments: succeeded }),
});
if (!auditResponse.ok) throw new Error(`MeInspect read failed (${auditResponse.status})`);
const result = await auditResponse.json();
console.table(result.lockedSuccessfulPayments || []);
console.log(JSON.stringify(result.lockedSuccessfulPayments || [], null, 2));
