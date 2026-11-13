# Phase 1 — 11 November 2026

## Decision: NOT READY FOR UPDATE

### Final safety action — active backend restored

Because the platform will not finalize an active backend edit without deployment, and deployment would repeat the forbidden schema pull, I preserved the tested repair candidate separately in `qa/phase1-2026-11-11/candidate/` (entry, bundle, patch), then **restored the active backend entry and bundle to the checksum-verified starting restore point**. This was a local-only restoration, not a deployment or database operation. Consequently, the fixes described/tested below are **candidate-only and are NOT active in the current backend source or staging**. All candidate test results remain valid for the preserved candidate, not the restored baseline. The exact local rollback described below has now been completed and byte-verified; the helper itself was not executed.

The release manifest's backend bundle hash identifies the preserved candidate bundle; the active backend bundle now matches the starting restore point. The current frontend was not changed. Do not click Update expecting these candidate fixes.

Local repairs and checks are complete, but this is **not a staged or published release**. No production request, production deployment, staging deployment, secret change, shared-data mutation, or package update was performed. Authenticated acceptance checks are NOT RUN because the previous QA credentials/cookies are no longer available. Nothing is waiting for you to supply a password or secret. Phase 2 was not started and remains gated on your exact `PUBLISHED` message.

**Important exception to the no-sync instruction:** the first pinned CLI `deploy --dry-run` automatically pulled database/storage schema metadata before validation. It reported `Schema up to date (no changes)`. This was not anticipated and should have been inspected before execution. No database DDL/migration was issued, and the generated schema files remain byte-identical to the restore point. The no-schema-sync procedure itself is marked **FAIL**, not concealed as compliance. No subsequent schema-pull command was run.

The inspected 0.0.12 CLI always performs that pull and has no skip-schema option. A new staging deployment therefore cannot be completed through the supported command while honoring the explicit no-sync rule. I did not patch the installed CLI, bypass platform deployment checks, change packages, or promote an old staging deployment as a substitute. Staging remains as it was before this run.

## Restore point

ID: **phase1-before-2026-11-11-0515**

Archive: `restore-points/phase1-before-2026-11-11-0515.tar.gz`

SHA-256: `d9f6809029e25bc0950468872db02e5fb82e4c3587d4f534b6429b1e3cb654ff`

Created before any application edits. It contains starting frontend/backend source, package manifests/lockfiles, generated backend definitions, configuration and built artifacts. It is a local source/artifact restore point, **not a database backup or an identified prior production release**. This workspace has no Git repository; no Git commit ID is fabricated.

## Results table

PASS means the stated check actually ran. Local tests are explicitly identified; they do not stand in for deployed acceptance. Fresh staging responses did not expose an application `x-request-id`/`request-id`; the CF-Ray references below are edge request IDs, not invented application IDs.

| Item | Result | Evidence |
|---|---|---|
| Restore point created before edits | PASS | Archive and SHA-256 above; restored-file comparison performed |
| 1 — CLI pinned in root and backend manifests | PASS | Both already `0.0.12`; retained unchanged |
| 1 — Both npm and pnpm lockfiles / installed version | PASS | Root/backend npm lock and installed package each `0.0.12`; both frozen pnpm installs succeeded; all four lockfiles byte-identical to restore |
| 1 — Initial pinned CLI release validation | PASS | `initial-validation.txt`: Type check passed; Build completed; Bundle valid 1.20 MB; Routes valid 50; Dry run complete |
| 1 — No schema-sync procedure | FAIL | Initial CLI dry-run automatically pulled schema metadata; `Schema up to date (no changes)`; no repeat |
| 1 — Frontend production build | PASS | Fresh final build exit 0; `frontend-build.txt` |
| 1 — Update executes this exact CLI version | NOT RUN | Local invocation verified; platform Update implementation/version is not available to inspect or execute without publication |
| 1 — Exact production-to-candidate replacement diff | NOT RUN | No previous production deployment ID/bundle available; candidate artifact hashes recorded, not misrepresented as production diff |
| 2 — Admin wildcard guard, normal/tester | PASS | Actual bundled handler + isolated SQLite: both identities 403 on access, prices, set-tester, audit-stripe-unlocks and future prefix route |
| 2 — Tester cannot make another tester | PASS | Local POST set-tester 403; target is_tester remains 0 |
| 2 — ADMIN_USER_IDS OR is_admin | PASS | Local allowlisted user 200; separate existing-flag user 200; normal/tester 403 |
| 2 — Existing admin email, read-only | PASS | Live DB SELECT: only `aalekh.dxb@gmail.com`, ID `8k5LgKUmGw7faQY8hcsk19iMV9lwepcv`, is_admin=1, is_tester=0 |
| 2 — Owner coverage after change | PASS | That live row qualifies for the local guard's tested is_admin=1 branch; no email hardcoding and no role edit |
| 2 — Owner authenticated live admin access | NOT RUN | No retained credentials/session; candidate not staged |
| 3 — Paid/finalised deletion protection | PASS | Local 409 for paid, completed, finalised, reportGenerated, completedAt, registry-only, paid order, linked payment; clear messages; retained previous correct implementation |
| 3 — Draft deletion and financial retention | PASS | Local draft DELETE 200; orders/payments unchanged, including account-deletion protection |
| 4 — Legacy email and inspectionId contracts | PASS | 36-case compatibility suite executed against actual bundle / real local SQLite / mocked provider; captured legacy request accepted; response keys and failure HTTP behavior preserved; new format accepted |
| 4 — Server sender and HTML protections | PASS | Local hostile from ignored; scripts, iframe, event attributes, encoded javascript URL and unsafe CSS removed; captured ordinary tables/styles/PDF link retained |
| 4 — 30 recipients per user per rolling hour | PASS | Existing email_send_events local SQL: preseed 29; parallel requests 200/429; exactly 30 counted; rejected retries do not extend quota; expiry accepted |
| 4 — Recipient restriction justified by current client | PASS | Only send-email caller is EmailReportModal; ReportPage supplies tenant/landlord/inspector contacts; checkbox selection only; no arbitrary recipient input. Existing restriction retained |
| 4 — Live email sends / installed Play Store v9 | NOT RUN | No QA session/device; no messages sent this run. Contract compatibility is not a device or inbox-delivery test |
| 5 — Atomic last-credit logic | PASS | Actual bundle + Drizzle D1 adapter with isolated SQLite atomic batches: conditional decrement, paid order only after changes()=1, unlock in same batch |
| 5 — Two parallel requests, 1 credit, different reports | PASS | Local temporary user: 200/409; balance 0; exactly one paid order and one paid report; temporary user deleted |
| 5 — Two parallel requests, same report | PASS | Local 1-credit case: 200/200 (one alreadyPaid), balance 0, one paid order/unlock; 2-credit case also consumes only one; temporary users deleted |
| 5 — Order-insert failure | PASS | Local injected failure: 500; debit rolled back, balance 1, no paid order |
| 5 — Shared staging/live QA-user concurrency | NOT RUN | Existing QA credentials unavailable; no auth bypass/new account provisioning or shared-data mutation attempted |
| 6a — Production signing-secret name stored | PASS | Read-only secret metadata: `StripeSigningSecret: true`; values never retrieved/printed |
| 6b — Exact STRIPE_WEBHOOK_SECRET is not read | PASS | Source selects StripeSigningSecret for production / SANDBOX_STRIPE_WEBHOOK_SECRET for staging; no exact legacy-name read. Dummy harness observes production reads and excludes legacy name |
| 6c — Correctly signed checkout.session.completed | PASS | Actual handler, dummy HMAC: 200; report paid after DB write |
| 6c — Unsigned / incorrectly signed event | PASS | Dummy harness: 400/400; zero DB queries and zero external calls; removed old event-retrieval fallback |
| 6c — Same event twice unlocks once | PASS | Local paid and no_payment_required each 200/200; duplicate does not issue a second report unlock; concurrent duplicate scenario also tested |
| 6c — paid and no_payment_required | PASS | Both statuses unlock in actual bundled handler |
| 6c — Report no longer exists | PASS | Signed local event: warning action=missing_report_acknowledged, 200, no data resurrection or financial deletion |
| 6c — Acknowledgement waits for database | PASS | Local DB unlock deliberately paused: response unresolved; release write -> 200 with paid=true. Injected write failure -> 500 |
| 6d — Missing sandbox signing secret | PASS | Read-only secret list: `SANDBOX_STRIPE_WEBHOOK_SECRET: false`; unchanged staging POST 500 `Webhook not configured`; CF-Ray `a58aede92ea4f3b4-PDX` |
| 6d — Wrong signature with staging unconfigured | PASS | Expected unchanged 500 `Webhook not configured`; CF-Ray `a58aedea1d5b96ba-PDX` (not a staging signature-validation pass) |
| 6d — Staging webhook cannot use live signing secret | PASS | Actual handler dummy test gives staging only a live signing secret: still 500; read tracing shows no StripeSigningSecret read |
| 7 — Identify old report/account/time | PASS | Live read-only DB: mvuxjr15recovery1, owner aalekh.dxb@gmail.com, stored created_at 2026-10-30T12:09:56.633Z; source mvuxjr15sp5jlpzt |
| 7 — Predates today's changes | PASS | Stored timestamp before 2026-11-11; prior 2026-11-10 evidence already records the 106-photo warning |
| 7 — Actual photo files present/absent in storage | NOT RUN | No authenticated storage read/list/head capability or QA session available; ready=1 manifest rows do not prove object existence now |
| 7 — Count inspections missing storage files / real customers | NOT RUN | Cannot honestly infer from metadata or warning count; unknown, not zero |
| 7 — Restore-code correction | NOT RUN | No verified restoration-code cause. No photo/data edits or speculative repair |
| 8 — Final frontend/backend type checks | PASS | Both exit 0 after all application changes |
| 8 — Final offline bundle contract / route analysis | PASS | Build uses installed CLI's esbuild settings, verifies named exports / size / 50 routes; no schema/network operation |
| 8 — Final full pinned CLI validation | NOT RUN | Initial baseline passed; final CLI dry-run would repeat forbidden schema pull. Offline validation is explicitly not the full CLI run |
| 8 — Deploy candidate to STAGING | NOT RUN | Supported 0.0.12 deployment unconditionally pulls schema; no skip flag; staging left unchanged |
| 8 — Normal user admin 403 | NOT RUN | No normal-user session; unauthenticated 401 CF-Ray `a58aede73ae3ff01-PDX` is not this test |
| 8 — Tester admin 403 | NOT RUN | No tester session; roles not changed |
| 8 — Paid inspection delete 409 | NOT RUN | No QA session; no shared row deletion attempted |
| 8 — Draft delete 200 | NOT RUN | No QA session; no draft created |
| 8 — Old email to owner 200 | NOT RUN | No QA session; no email sent |
| 8 — inspectionId email 200 | NOT RUN | No QA session; no email sent |
| 8 — Sign-in | NOT RUN | Credentials unavailable; get-session returned 200 unauthenticated, CF-Ray `a58aede5ec879314-PDX`, not successful sign-in |
| 8 — Old inspection opens | NOT RUN | Unauthenticated GET returns 401, CF-Ray `a58aede82eae5012-PDX`; no authenticated browser claim |
| Phase 2 — Production verification | NOT RUN | Not authorized until PUBLISHED; no production HTTP checks or publication performed |

## What changed / what stayed intact

Only backend application changes this run: admin authorization includes existing is_admin; credit redemption is atomic; webhook invalid signatures fail immediately and signed missing-report events are logged/acknowledged. No new application routes. The existing delete guards, dual email format, sanitization, sender selection and rate counter already met the requested implementation and were retained/tested.

The credit debit is one `UPDATE users SET free_inspections = free_inspections - 1` gated by current positive balance, owned unpaid inspection, and no paid order. It executes in an atomic D1 batch with a conditional order INSERT (`changes() = 1` from the debit) and report unlock. This also prevents a second debit for the same report when the user has multiple credits and rolls back the debit if order insertion fails. The local harness exercises the actual bundled code through the existing Drizzle D1 adapter, not a separate reimplementation of its SQL.

Frozen-lockfile installs restored existing dependencies without changing package selections. Root/backend manifests, all four lockfiles, generated schema definitions, backend configuration, frontend source, existing email sanitizer and installed Stripe checkout creation/discount logic match the restore point. No schema DDL, migration, constraint/index change, schema-file edit, financial deletion, account role change, customer-data change or secret change was performed. The initial metadata pull exception is disclosed above.

## Signing-secret clarification

Stored metadata flags (names and booleans only):

```json
{
  "StripeSigningSecret": true,
  "STRIPE_WEBHOOK_SECRET": false,
  "SANDBOX_STRIPE_WEBHOOK_SECRET": false
}
```

“Stored” is based on the platform's configured-secret listing, not exposing or directly reading its value. The app's production selector reads `StripeSigningSecret`. The exact name `STRIPE_WEBHOOK_SECRET` has no active read; matching it merely as a substring of the sandbox name would be a false positive.

The staging **webhook signing-secret** isolation is confirmed. A broader claim that staging cannot read *any* live secret would be false: existing `getStripeKey()` contains a staging fallback to live `STRIPE_SECRET_KEY` for checkout. It was left byte-for-byte unchanged because you explicitly prohibited changing Stripe checkout creation. The unconfigured staging webhook returns before reaching that helper. No live Stripe request was made in this run.

For unrelated valid signed event types or a missing report, no unlock write is necessary. For a handled paid checkout with an existing report, 200 is only returned after the required writes finish; a database failure returns 500. The missing-report 200 is the deliberate exception you requested.

## Old report: read-only findings

The warning concerns **RPT-MVUXJR15**, recovery inspection `mvuxjr15recovery1`, belonging to **owner** `aalekh.dxb@gmail.com` (also used for prior QA, but this is the owner's actual recovery report, not a newly created disposable QA report). Its stored creation timestamp is **2026-10-30T12:09:56.633Z**. The recovery row copied that timestamp, so it does not independently establish the exact recovery INSERT time. Its status is completed and its sourceInspectionId is `mvuxjr15sp5jlpzt`; the source remains a draft.

The live database has 107 ready photo manifests for the source and none directly on the recovery row, as expected for an alias. The two rows each reference 103 room-photo IDs/cloud paths matching those source manifests. The existing endpoint checks ownership of both recovery/source rows before resolving that alias. There were **114 inspections**, **338 photo manifests**, all 338 marked ready, across 11 direct manifest inspection IDs / 12 inspection rows when counting the recovery alias. These are inventory counts, **not missing-file counts**.

The historical warning of 106 missing restores was already recorded on November 10, so it did not originate in today's admin/credit/webhook edits. Neither a historical warning nor ready=1 proves the current file bytes exist or are absent. This environment's storage CLI only exposes bucket creation, not object inventory/head; no retained user session was available for the app's photo endpoint. Counts of inspections with absent files and affected real customers therefore remain **unknown / NOT RUN**. No photos, reports or metadata were repaired or rewritten.

## What Update will do — and what cannot be certified

Update is a publication action, not a route-specific patch. Platform documentation says it publishes the current frontend and promotes the staged backend. That replaces the frontend web assets and the backend serving all routes, not just admin/credit/webhook. Existing native clients then reach the promoted backend; it does not install new Play Store/iOS binaries or replace assets already installed on devices.

**This run did not stage its candidate.** Do not assume Update would pick up today's backend source; under the documented promotion model it would promote the currently staged, earlier backend. I cannot inspect whether this project's platform Update additionally rebuilds a backend or which CLI it invokes. The local pin governs local/project package-manager CLI invocations; it is not proof of an unobserved platform execution path.

The candidate's exact artifact hashes are in `qa/phase1-2026-11-11/release-manifest.json`. This identifies the local frontend build and backend bundle only. There is no available exact previous production deployment ID, complete previous production bundle or platform release diff; an exhaustive claim of what Update would replace relative to production is **NOT RUN**, not guessed. No queued database migration or secret update was created. Do not click Update on the strength of local checks alone.

## Rollback steps

### Exact local undo of this run

Neither production nor staging was deployed, so neither needs a deployment rollback. Shared database rows and secrets were not changed and must not be rolled back.

1. Verify the archive SHA-256 equals the value above.
2. Restore **only** `backend/src/index.ts` and `backend/dist/bundle.js` from the archive, replacing their current local counterparts. These are the only pre-existing application/artifact files changed by this run; leave the QA evidence/report and current documentation intact.
3. Confirm both restored files byte-match those archive members. Leave the CLI at 0.0.12 (it was already pinned at the restore point).
4. Do **not** run deploy, schema sync, migrations, secret edits, database restore, or Update as part of this local rollback.

The helper `qa/phase1-2026-11-11/rollback-local.py` performs those hash checks and restores only the two specified local files. It has not been executed because that would undo the completed repairs. It makes no network or database calls.

### Production rollback if Update is clicked later

An exact executable production rollback cannot be certified without the last published frontend/backend revision identifiers and the platform's confirmed backend-restore behavior; these are not available in this session. **NOT RUN**. The general platform route is History -> restore the release published immediately before that Update -> restore its matching frontend/backend -> Update to republish that pair, then recheck live behavior. This is not claimed as a tested one-click rollback or an identified release ID. Do not restore the shared database, delete orders/payments, rotate staging secrets, or use CLI promote as a workaround. Restoring an older production release can also reintroduce its earlier security defects.

## QA record ledger

**Shared database / staging / production:** created **0**, edited **0**, deleted **0**. No QA account, auth session, inspection, order, payment, photo, email event or tester role was created/changed through live APIs/SQL. No emails were sent; no card/Stripe request occurred. Prior runs' QA records remain untouched.

**Isolated local test database:** the compatibility suite uses disposable in-memory fixtures; it is not the shared project database. The safety suite records every explicit fixture and credit order in `local-safety-results.json`; the companion `local-qa-ledger.md` lists them. Temporary credit user rows were explicitly deleted after the concurrency assertions. Orders/payments were never deleted by SQL; the isolated database is closed/discarded after testing. These local fixtures are not represented as real authenticated staging tests.

## Evidence locations

Fresh evidence: `qa/phase1-2026-11-11/`. Initial full CLI output: `initial-validation.txt`. Final no-sync build/route check: `offline-release.txt`, `offline-routes.json`. Typechecks: `backend-typecheck.txt`, `frontend-typecheck.txt`. Production frontend build: `frontend-build.txt`. Compatibility suite: `compatibility-tests.txt` (36 assertions). Safety suite: `local-safety-tests.txt` and `local-safety-results.json` (27 assertions). Live unchanged-staging probes: `staging-readonly-probes.json`. Protected-area comparison: `invariants.txt`. Candidate artifact hashes: `release-manifest.json`.

**Stop here. Phase 1 is locally repaired but not staged/accepted or ready to publish. Phase 2 has not run.**
