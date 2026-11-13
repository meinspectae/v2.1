# Payment and report-unlock remediation — 2026-10-28

## Test status — failures and unrun device cases first

| Status | Test / symptom | Evidence and result |
|---|---|---|
| **FAIL** | Existing live payment, example `mvqbv6a56f6uas9l` | Read-only database query found four live Stripe Checkout orders, all still `pending`; the report exists, is `in_progress`, has `completed_at = null`, and `payment_data = {"paid":false}`. No data was changed or refunded. |
| **FAIL** | Previous webhook contract | Code inspection proved a validly signed event always returned 200 even when it was not `checkout.session.completed`; it did not handle `checkout.session.async_payment_succeeded`, verify `payment_status`, verify that the order/report updates changed exactly one row, or fail when the report was absent. This explains how Stripe could show green delivery while no unlock occurred. |
| **FAIL** | Previous return/session behavior | Stripe returned to `https://app.meinspect.com/report/<id>`, but Android only registered an App Link for `/mobile-auth-callback.html`. A system-browser return therefore stayed in a separate browser cookie context. The protected route redirected to login and lost the return destination. |
| **FAIL** | Previous Android Pay launch | The checkout request ran before navigation and there was no launch-timeout/fallback or device diagnostics. A failure left only a generic failed state. The code did use `window.location.href`, not `window.open`; therefore the suggested delayed-popup cause was **not** present in this revision. |
| **FAIL** | Previous unlock trust boundary | The server webhook did write `paymentData`, but the return page also called the client store's `recordPayment()` and immediately set `isPaid`. Tester/free paths also created paid orders without consistently writing the report paid state. Unlock behavior was split instead of strictly server-authoritative. |
| **FAIL** | Previous inspection completion coupling | The review action was disabled until payment and `handleComplete` returned early when unpaid, leaving paid users with incomplete inspections and making completion depend on payment. |
| **NOT RUN** | Stripe test-mode checkout | Staging contains no `SANDBOX_STRIPE_SECRET_KEY` or `SANDBOX_STRIPE_WEBHOOK_SECRET`; only live Stripe secret names are configured. Live keys were not used for testing. |
| **NOT TESTED ON DEVICE** | Android 10 normal payment | No Android emulator/ADB is installed in this environment. |
| **NOT TESTED ON DEVICE** | Android 12 app closed during payment | No Android emulator/ADB is installed in this environment. |
| **NOT TESTED ON DEVICE** | Android 13 switching apps / cancel / decline | No Android emulator/ADB is installed in this environment. |
| **NOT TESTED ON DEVICE** | Android 14 slow network / double tap / airplane mode | No Android emulator/ADB is installed in this environment. |
| **NOT TESTED ON DEVICE** | Android 15 + Don't keep activities | No Android emulator/ADB is installed in this environment. |
| **NOT RUN** | Phone models reported by customer | No model list or connected device was available. Runtime diagnostics are now captured for future failures. |
| **NOT RUN** | Android native compilation | Capacitor sync passed; Gradle compilation could not run because Java/JAVA_HOME is unavailable. |
| **PASS** | Frontend production build | `pnpm run build` completed successfully after the final changes. |
| **PASS** | Backend TypeScript and dry-run validation | Backend TypeScript, bundle validation, and analysis of all 48 routes completed successfully. |
| **PASS** | Backend staging deployment | The corrected worker deployed successfully to staging. |
| **PASS** | Webhook signature rejection smoke test | An invalid signature returned HTTP 400. |
| **PASS** | Public confirmation input validation smoke test | Missing session/report input returned HTTP 400. |
| **PASS** | Android web asset sync | Production web assets and native plugins synced into the Android project. |

## Provider and original flow

- **Provider:** Stripe Checkout on web/Android. iOS continues to use the existing RevenueCat in-app purchase path.
- **Payment starts:** `PaymentModal` calls authenticated `POST /api/checkout`; the inspection wizard and report details are the two Stripe entry points.
- **Success URL:** `https://app.meinspect.com/report/<reportId>?payment=success&session_id={CHECKOUT_SESSION_ID}`.
- **Cancel URL:** `https://app.meinspect.com/report/<reportId>?payment=cancel`.
- **Webhook:** `POST /api/webhooks/stripe`, with Stripe signature verification.
- **Paid storage:** authoritative access is `inspections.payment_data.paid`; `orders` stores the pending/paid Checkout record, session id, payment id, amount, currency, and paid time.
- **Original unlock:** webhook and authenticated Stripe reconciliation updated the server, while the returning frontend also set local paid state. That split has been removed from the Stripe success callback.
- **Login/draft storage:** authentication is held by EdgeSpark plus persisted user state; inspection position and metadata are persisted in local storage and the full draft is cloud-saved. The payment return may use a separate browser cookie jar, which was the logout appearance—not an explicit payment-triggered sign-out call.

## One-line causes

- **Pay button:** checkout launch had no durable pending marker, launch fallback, double-tap guard, timeout-aware error path, or runtime telemetry; delayed `window.open` was not the cause because this code used same-page assignment.
- **Green webhook but locked report:** the handler acknowledged correctly signed event types it did not process and never verified successful database updates before returning 200.
- **Logged out on return:** the production report URL was not registered as an Android App Link and a browser without the app's auth cookie was routed to login without preserving the report return path.
- **Incomplete inspection:** completion was explicitly disabled until payment.
- **Lost return unlock:** the previous experience depended on authenticated return reconciliation/local state even though the webhook also attempted an unlock.

## Implemented remediation

- Checkout now requires an owned server report, refuses to charge an already-paid report, creates the Stripe session with report metadata, and stores the pending order/session before returning the URL.
- One idempotent server routine now handles both `checkout.session.completed` and `checkout.session.async_payment_succeeded`, accepts only `paid` or `no_payment_required`, validates order/report/owner correlation, saves session/payment id/amount/currency/time, verifies both database updates, and throws on any failure so Stripe retries.
- Authenticated reconciliation by session or report asks Stripe directly and uses the same server routine. A public return safety net uses the unguessable session id plus matching report metadata and exposes no report data.
- Pending payment survives app closure. App resume/foreground polls for up to 60 seconds and shows `Confirming payment...`; expired auth preserves the report destination through sign-in.
- Pay is guarded synchronously against double taps, shows loading/error/Retry, and offers `Open payment page in browser`. Android native opens Capacitor Browser; web uses same-tab navigation. Sanitized runtime failures include model, Android version, and WebView/Chrome version, with no personal data.
- `I already paid, check payment` exists on the pay modal and report details.
- Server sends the receipt only after authoritative unlock, with report ID and a production-domain report link; email failure never rolls back access and can retry on a duplicate confirmation.
- Report completion/saving no longer depends on payment. Viewing, PDF download, and email remain paywalled. Draft data and inspection position are not cleared by payment.
- Android handles `https://app.meinspect.com/report/*` and `meinspect://report/*`; the Digital Asset Links file is included for package `com.meinspect.app` and SHA-256 fingerprint `2F:73:A7:C1:78:E1:D4:B2:2A:58:F5:0B:86:37:F5:AB:4A:DD:52:BE:CC:5E:C9:2E:46:6E:7A:35:67:6F:B0:B1`.
- A read-only 30-day audit script and protected comparison endpoint were added. They do not alter or refund payments.

## Read-only 30-day findings

The database-only candidate query found eight live Stripe sessions that are still pending/unlocked:

- Report `mvqbv6a56f6uas9l`: four sessions on 2026-10-27; report exists and is not paid.
- Report `mvqb1jpfcaqv7g7x`: four sessions on 2026-10-27; the referenced report row is absent.

These are **candidates, not confirmed successful charges**, because the database cannot prove Stripe's live payment status. The supplied read-only audit script asks Stripe and lists only sessions Stripe confirms as paid. It was not run with the live key and changed nothing.

## Files changed

- Payment server/webhook/reconciliation/email/diagnostics/audit: `backend/src/index.ts`
- Checkout UX and retry/fallback/check-paid actions: `src/components/PaymentModal.tsx`
- Pending recovery and Android payment deep links: `src/utils/paymentRecovery.ts`, `src/main.tsx`, `src/App.tsx`
- Return-to-report login handling: `src/pages/LoginPage.tsx`
- Server-authoritative unlock UI and report-details check button: `src/pages/ReportPage.tsx`
- Inspection completion decoupled from payment: `src/pages/InspectionForm.tsx`
- Android App Links: `android/app/src/main/AndroidManifest.xml`, `public/.well-known/assetlinks.json`
- Read-only audit: `scripts/audit-stripe-unlocks.mjs`

## Restore / undo

The pre-change restore point is `restore-points/payment-unlock-before-2026-10-28-0439.tar.gz` with SHA-256 `68152566a43970cc8a61a16931bf6f26b5a5db7cb49b770a1d9cd1b086b626e0`. Restoring that archive reverts the changed payment/unlock source and native configuration. The staging worker has already been updated; production remains unchanged until Publish.
