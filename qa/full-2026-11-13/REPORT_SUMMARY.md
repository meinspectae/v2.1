# Full-app QA report — 13 November 2026

## Verdict: NOT READY FOR UPDATE

Four confirmed code defects were fixed. The backend fix is deployed to **STAGING only**; frontend fixes are prepared but not published. Account deletion and staging webhook configuration still fail; admin A verification was not run because the previously supplied credentials/session were unavailable.

The full evidence table contains 213 entries plus 50 individual route probes. Historical failed attempts are retained, with repaired defects and test-harness mistakes clearly distinguished. **PASS is limited to the scope actually exercised.**

## Results — unresolved failures first

Application request IDs were not supplied by the server. The IDs below are real **CF-Ray** correlation IDs, not invented application request IDs. Stripe request IDs are listed separately. Local tests have no external status/request ID.

| Area | Test | Result | Evidence |
|---|---|---|---|
| Webhook | No signature / wrong signature must return 400 | **FAIL** | Both returned 500, `Webhook not configured`; fresh deployed probe CF-Ray `a59bd93f79f18e12-PDX` |
| Accounts | Delete disposable account | **FAIL** | 500, `a59bdc4438558969-PDX`; profile and unpaid draft removed, auth identity remains |
| Payments | Staging test-mode isolation | **FAIL** | Checkout returned live-mode sessions through existing fallback; all six expired, no charge |
| Auth / admin | Supplied A login and staging admin 200 | **NOT RUN** | No usable supplied credential/session; no admin substitute or bypass created |
| Phone | Camera, native PDF, device drafts, inbox, Stripe return, Android install | **NOT RUN** | Physical device/inbox/signing not available; no credentials requested |
| Access control | B uses editable PDF path to read N’s PDF | **PASS after fix** | Before: 200 with matching victim PDF hash. After: 403 `a59bd880d87a4b48-PDX`; owner still 200 `a59bd8858f840eda-PDX` |
| Input safety | Malicious names in email HTML | **PASS after fix** | Actual template: 3/6 literal-string cases failed before; 6/6 pass after; stored input unchanged |
| Reports | Paid cloud-only report stuck loading | **PASS after fix** | Real staging returned 200 while old screen stayed loading; repaired browser opens report, generates PDF; unknown ID exits loading |
| Access control | Shared offline API cache crosses accounts | **PASS after fix** | Actual service-worker harness reproduced leak; repaired version does not cache authenticated API or cross-origin storage responses |
| Auth | Anonymous registration, persistent session, sign-out | **PASS** | Four QA Test accounts: signup 200; persisted sessions 200; sign-out 200; subsequent protected requests 401 |
| Auth | Wrong password | **PASS, limited scope** | 401 `a59bbf48e96dd74d-PDX`; disposable anonymous identity, not A’s password account |
| Inspections | Create, rooms, ratings, notes, edit, open, list | **PASS** | Create 201 `a59bbf4bbb20efde-PDX`; open 200 `a59bbf4dcbfb9bf9-PDX`; edit/list 200 |
| Fields | Keys, meters, move-in, empty values, three signatures | **PASS** | Saved values read back exactly; empty fields 200; real reference-PDF upload and retrieval 200 |
| Photos | Three uploads through app route, confirm, download/hash | **PASS** | All three upload/confirm/download sequences 200; all SHA-256 hashes match; B receives 403 |
| Finalisation | Actual app PDF, finalise, download, verification | **PASS** | Real browser-rendered 1.09 MB PDF; finalise 200 `a59bcf5ed9789314-PDX`; byte hash matches; registered hash verified, unknown hash rejected in API/browser |
| Email | Legacy and inspectionId bodies | **PASS** | 200 `a59bca89787f1a0b-PDX` / `a59bca8e5d3c23a3-PDX`; provider accepted sends; actual modal send 200 `a59bd5087ae49935-PDX` |
| Email | Sender override ignored / unsafe markup removed | **PASS locally; remote content NOT RUN** | Actual backend handler/provider-capture regressions pass. Live requests returned 200, but provider-stored HTML/inbox not inspected |
| Email | 31st recipient in rolling hour | **PASS** | 429 `a59bcb598d6fefa4-PDX`; prior reservations total 30 |
| Delete rules | Draft 200; paid/finalised 409; retain orders | **PASS** | Draft 200 `a59bbf576c4796ba-PDX`; paid 409 `a59bbf779d9ccb90-PDX`; finalised 409 `a59bd06b2f7c148b-PDX`; all orders 83–92 retained |
| Access control | B cannot read/edit/delete/download N; normal/tester admin denied | **PASS for executed routes** | Inspection/PDF 404, photo 403; both normal and tester received 403 on all eight admin routes |
| Credits | Tester free; one credit used once; parallel last credit | **PASS** | Parallel 200 `a59bbf7e1a10ff01-PDX` and 409 `a59bbf7e1c6f5135-PDX`; one order, balance 0; repeat alreadyPaid |
| Webhook | Signed dummy-secret event, duplicate, missing report | **PASS locally** | Actual handlers with isolated SQLite: 200/200, one unlock; missing report 200; injected write failure 500; signature/fallback unchanged |
| Input safety | Script, image handler, prototype text, 5,000 chars, Arabic, emoji | **PASS for storage/render/template checks** | Literal API round trips, browser text rendering without execution, six escaped email-template cases |
| Accounts | Paid report/order survive attempted deletion | **PASS** | Fresh read retains paid credit-1 report and order 90; complete account deletion still FAIL |
| Release | Live frontend address counts | **PASS** | Fetched 36 live JavaScript chunks: production API address once, `staging--` zero |
| Android | Code 10/name 3.5; backup domains; permissions; password defaults | **PASS source-only** | No cache domain or password defaults. Legacy storage permission is required on Android ≤9 for Documents export, not unused |
| Release | Type checks/build after each fix; CLI 0.0.12; 50 routes | **PASS within scope** | Every repair passed both checks/build/related tests; staging deploy `39aec344...`; schema unchanged. All 50 gates called; gate tests are not all-route positive acceptance |

## Actual checkout prices and expiry

| Code | AED | Stripe creation request ID | Expiry |
|---|---:|---|---|
| No code | 199 | See detailed checkout evidence; normal request `req_mg2IWxaSA7fc1f` | 200 / expired |
| WELCOME20 | 159 | `req_R4TDiQx3w8HAyI` | 200 / expired |
| LAUNCH50 | 149 | `req_DkL0E5il35lErG` | 200 / expired |
| MEINSPECT10 | 179 | `req_LpDAv4yVV447NW` | 200 / expired |
| INSPECTOR | 99 | `req_rrUmihZ1tO4Xfg` | 200 / expired |
| FREE_REPORT | 0 | No Stripe session by design; discount order 87 | Not applicable |
| Invalid code | 199 | `req_nNKCvevSju0pis` | 200 / expired |

No payment was made. Expired Stripe orders remain pending in app history; the actual Stripe expiry responses prove expiry. The supplied A account’s balance was not touched.

## What was fixed

1. PDF download now checks storage ownership before issuing access, preventing a second account from using a forged PDF path.
2. Email report text is escaped rather than interpreted as HTML, preserving literal malicious-looking names.
3. Loading a cloud-only report no longer cancels its own request and spins forever.
4. Shared browser caches no longer retain authenticated API responses or signed storage responses across accounts; old caches are invalidated.

After each fix, both type checks, production build and related tests passed. Current regression suites: 36 compatibility assertions, 33 safety assertions, six PDF authorization cases, six email text cases, and offline-cache isolation. Frontend changes are not published or installed on phones.

## Still broken and exact follow-up steps

**Staging webhook configuration:** in Stripe test mode, configure the staging webhook for checkout completion and asynchronous payment success. In YouBase staging, set the matching `SANDBOX_STRIPE_WEBHOOK_SECRET` and verify `SANDBOX_STRIPE_SECRET_KEY` so staging no longer falls back to live mode. Re-run unsigned/wrong-signature 400 tests and signed test events. No secret or protected webhook logic was changed here.

**Account deletion:** inspect worker logs for CF-Ray `a59bdc4438558969-PDX`, focusing on auth identity removal after app-profile cleanup. The exact underlying platform error could not be proven; system introspection was blocked. Use YouBase → Users to inspect/remove only disposable C after confirming report/order retention, and resolve the supported auth deletion mechanism with support@youware.com. Do not retry deletion on a real customer until atomic behavior is verified. No destructive-command bypass was attempted.

**Admin and production rollback identity:** verify the already-held A account on staging and record the current production revision before considering Update. No new admin was provisioned. A was not verified in this run.

**Device acceptance:** test camera permission/capture/GPS; native PDF download/share/print and Arabic layout; offline drafts across app restart/account switch; actual inbox; paid/cancelled Stripe return to installed app; signed Android 3.5/code 10 install/update and legacy Documents permission. Desktop-browser PDF success does not prove these.

## Update and rollback

**Do not treat this as Update approval.** Update would promote the currently staged backend and prepared frontend, including prior staged admin/credit behavior as well as these repairs. It does not update native installed apps or missing secrets. The complete diff against the unknown previous production revision is not certified.

Restore point created first: `full-before-2026-11-13`, SHA-256 `0afbf7206976c4bc37c917e3e0ec5f7f1aca466b3159f8054e25d76dfc106022`. A checksum-guarded local rollback helper is included with the detailed report. Restoring it reintroduces the original security defects; it is not a safe production recommendation. Any staging rollback must use CLI 0.0.12 and stop on schema changes. A production rollback requires selecting and verifying the previous deployment revision in History, which was unavailable here. Never roll back or delete orders/payments.

## QA record inventory

- Four anonymous accounts named **QA Test**: N `DHlXy1QGQ9N4bNUz84yyUNRWbKCetxry`; B `I9x4jTX29wRiTIum0mYmjbSEzLfXQZX2`; T `ngpPitm0v8x6HZJEtcCNiCz9BqBD7ZcS`; C `auHg2A9v5OQElcJJkvIy6gjLTmlTqiQB`. All sessions signed out. T’s temporary tester flag restored. C’s profile was removed by the failed deletion, but auth identity remains.
- Fifteen inspections, all prefixed `qa-20261113-`: **retained** main, pay-normal, pay-welcome20, pay-launch50, pay-meinspect10, pay-inspector, pay-free, pay-invalid, tester, credit-1, final; **deleted QA drafts only** empty, credit-2, email, pdf-access-probe.
- Orders **83–92 all retained**. No orders or payments deleted; no payment-table rows intentionally created.
- Photo backups/objects photo1, photo2, photo3 under N’s main report: retained.
- One generated PDF upload, one immutable final PDF, one reference PDF: retained. Verification `qa-20261113-final-0ea7f42773d3c245` retained. Final PDF hash `da61a14eb25390d26ca09a0c874a1309f1bd7872cf2976abe6861b4acc24b20f`. Temporary upload object UUID was not retained; owner/report prefix and count are known, exact path NOT KNOWN.
- Thirty email quota rows retained, reserving 31 recipients across B and N. Every row ID is listed in the detailed report and email-event ledger. Explicit delivery target was the provider’s simulator, not a real invented recipient.
- Local-only SQLite fixtures, test logs, PDF, restore archive and regression helpers are separately inventoried. Private cookie/state artifacts were removed. No secret values were printed.

Detailed report: `qa/FULL_APP_QA_2026-11-13.md`. Evidence and complete row-by-row IDs: `qa/full-2026-11-13/`.

Final staging receipt: the identical tested bundle was re-deployed as `a8a177e4...` because platform completion did not recognize the guarded deployment. CLI 0.0.12 again reported Schema up to date (no changes); all 11 protected schema files and the tested bundle remained byte-identical. No publication occurred.
