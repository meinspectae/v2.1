# Production readiness report — 6 November 2026

## Verdict

**NOT SAFE TO CERTIFY OR LEAVE AS A VERIFIED PRODUCTION RELEASE.** The previously reported backend security defects have not been repaired in production during this session. Production was not deployed, promoted, or modified. No production rollback was needed or attempted because no production changes were made. This is not an all-pass release.

The platform restricts production backend promotion to its Publish flow. No workaround was attempted. The backend's release validation also fails on the unchanged baseline. No existing QA, tester, or owner credentials or retained sessions were available in the documented locations, and no input was requested. No session was forged, no additional account was registered, and no real customer account was used.

Evidence below is from this session, not copied from earlier QA. A 401 without a session does **not** prove a normal user or tester receives 403. A 200 login page or a null session does **not** prove successful sign-in. Local/browser checks do not prove production behavior.

## Requested problem matrix

| Problem | Result | Evidence: status codes, request IDs, test output |
|---|---|---|
| 1. Admin repair release gate | **FAIL** | Attempted a wildcard ADMIN_USER_IDS guard; frontend typecheck, backend typecheck and frontend build exited 0. Backend compilation completed, but release validation exited 1: `Missing required export: default`. Reverted only this candidate. Unchanged baseline has the identical failure. Existing named `createApp(edgespark)` contract was preserved rather than silently replaced. |
| 1. Normal user denied admin prices and set-tester | **NOT RUN** | No normal QA session. Unauthenticated production controls returned 401: prices `a562153d69d8c654-PDX`; set-tester `a56215408c848864-PDX`. These do not validate the requested 403. |
| 1. Tester denied admin prices and set-tester | **NOT RUN** | No tester QA session. No tester flag was changed. |
| 1. Owner retains admin access | **NOT RUN** | No owner session available; no claim that production ADMIN_USER_IDS contains the owner's ID. |
| 2. Paid/finalised delete blocked and draft delete preserved | **NOT RUN** | No authenticated disposable QA rows available to test. Production unauthenticated DELETE of a deliberately nonexistent QA ID returned 401, `a56217536f73debd-PDX`. No inspection, order, or payment was deleted. No candidate retained while backend release gate is blocked. |
| 3. Legacy email recipient authorization, sanitizer, server sender, temporary compatibility | **NOT RUN** | No authenticated QA session and no backend release possible. Current source remains inspectionId-only, so it does not meet the requested legacy compatibility. No email sent. |
| 3. New inspectionId-only email and in-memory 30-recipient/hour cap | **NOT RUN** | Production unauthenticated new-format control returned 401, `a5621754aacdff0a-PDX`. Current source still uses the existing database counter, not the requested in-memory counter. No rate-limit acceptance claimed. |
| 4. Safe returnTo validation in preview | **PASS** | Real preview browser loaded and executed the exact helper imported by LoginPage: **26/26 passed**. It rejects double slashes, backslashes, schemes, controls, encoded separators and dot-segment host tricks; preserves normal report paths/query/hash. HTTP 200 for helper, Chrome request IDs `875.100` and `875.108`; LoginPage 200 `875.95`. Frontend typecheck and build exited 0. |
| 4. Redirect after successful QA sign-in | **NOT RUN** | No QA credentials. Preview helper execution is not represented as a successful authenticated login/navigation flow. |
| 5. Conditional single-row credit deduction | **NOT RUN** | Existing source is unchanged; read-then-write behavior remains. Production unauthenticated checkout control 401, `a5621a379f0cfdb1-PDX`. No order or credit mutation performed. |
| 5. Two parallel requests on exactly one live QA credit | **NOT RUN** | No authenticated eligible one-credit QA account was available. No balance was reset, drained, or seeded. No simulated race labeled as a live race. |
| 6. Android permissions, release metadata, backups and signing references | **PASS** | Executed XML/source checks: READ_MEDIA_IMAGES and POST_NOTIFICATIONS absent; versionCode **10**, versionName **3.5**; no cache domain in either backup file; both signing passwords read from environment with no literal defaults; reviewed signing references in build files and project documents. All four existing keystore/certificate/private-key files match pre-check hashes. |
| 6. Web build, Android sync and copied bundle | **PASS** | Frontend typecheck/build and `cap sync android` exited **0**. Checked **36 copied JavaScript files**: production API base address occurs **1** time; `staging--` occurs **0** times; copied JavaScript matches build output byte-for-byte. Real browser served the copied bundle: login document 200 `2DE5F3C916143BDEA020D59AF2451609`, main JavaScript 200 `875.128`, login JavaScript 200 `875.197`. |
| 6. Signed Android artifact / installation / Play Store update | **NOT RUN** | Web build and sync do not compile, sign, install or upload an Android release. Signing credentials were not available. |
| 7. Production Stripe webhook, no signature | **PASS** | Real POST returned **400**, error `Invalid Stripe signature`; Cloudflare request ID **`a5621d030fbaef6f-PDX`**, 06:41:35 UTC. |
| 7. Production Stripe webhook, wrong signature | **PASS** | Real POST returned **400**, error `Invalid Stripe signature`; Cloudflare request ID **`a5621d044d1dc62a-PDX`**, 06:41:35 UTC. |
| 7. Production sign-in | **NOT RUN** | GET session endpoint returned 200 with no session, `a5621d055dc55ecc-PDX`; public login page returned 200, `a5621d081fb13d1b-PDX`. Neither is a successful sign-in. |
| 7. Old inspection opens | **NOT RUN** | No authenticated QA session; no unrelated customer inspection accessed. |
| 7. Tester free checkout | **NOT RUN** | No tester QA session; no payment or order created. |
| Production deployment / final authenticated acceptance / rollback | **NOT RUN** | No production deployment allowed by platform workflow; backend release validation blocked; no QA sessions. Production unchanged. |

Production IDs are the server-provided Cloudflare `cf-ray` values. Preview IDs are Chrome DevTools request IDs, not invented server IDs; the preview server does not issue `x-request-id` headers.

## Final requested production acceptance checklist

| Real-call requirement | Result | Evidence / limitation |
|---|---|---|
| Normal user → admin route 403 | NOT RUN | No authenticated normal QA session |
| Normal user → set-tester 403 | NOT RUN | No authenticated normal QA session |
| Tester → admin route 403 | NOT RUN | No authenticated tester QA session |
| Tester → set-tester 403 | NOT RUN | No authenticated tester QA session |
| Paid QA inspection DELETE 409 | NOT RUN | No authenticated paid QA fixture |
| Draft QA inspection DELETE 200 | NOT RUN | No authenticated disposable QA fixture |
| Old email format → stranger refused | NOT RUN | No authenticated QA session; no stranger email sent |
| Old email format → own address accepted | NOT RUN | No authenticated QA session; no email sent |
| inspectionId-only email accepted | NOT RUN | No authenticated QA session; unauthenticated 401 is not acceptance |
| Sign-in works | NOT RUN | Public page 200 and null session are not login proof |
| Old inspection opens | NOT RUN | No authenticated QA session |
| Tester free checkout works | NOT RUN | No authenticated tester QA session |
| Unsigned Stripe webhook 400 | PASS | 400, `a5621d030fbaef6f-PDX` |
| Wrong-signature Stripe webhook 400 | PASS | 400, `a5621d044d1dc62a-PDX` |

## Changes retained and awaiting release

**Web frontend awaiting Publish:** stricter login return-path validation, applied both to sign-in completion and already-signed-in navigation. No backend repair is included. Do not interpret publishing the frontend as approval to promote the currently unverified backend: the existing inspectionId-only email source would not preserve the legacy contract requested for the live web and Play Store version 9.

**Android awaiting a separate signed store release:** removed the two unnecessary permissions; synchronized the current web bundle; retained version 3.5/code 10 and existing signing identity; updated the release guide to require secure environment passwords and remove outdated version/default-password examples. Publishing the website will not update installed Android apps.

## What was created or changed in production

**Nothing.** Created zero QA accounts, zero inspections, zero orders, zero payments, zero emails, zero credit changes and zero tester grants. The HTTP probes were unauthenticated and performed no successful mutation. No keys, passwords, cookies or tokens were printed.

Locally created: return-path helper, repeatable readiness-check scripts, sanitized HTTP/browser evidence, this report, refreshed web output and copied Android web assets. The backend candidate was reverted exactly; backend source matches its pre-session restore copy byte-for-byte.

## Evidence files

- `qa/readiness-2026-11-06/01-admin-*-typecheck.txt`, `01-admin-frontend-build.txt`, `01-admin-backend-build.txt`: candidate validation.
- `qa/readiness-2026-11-06/baseline-*.txt`: same release-validator failure on restored baseline.
- `qa/readiness-2026-11-06/04-preview-redirect.json`: all 26 browser cases.
- `qa/readiness-2026-11-06/04-preview-network.json`: sanitized actual preview request IDs.
- `qa/readiness-2026-11-06/06-android-checks.json`: all executed Android source/bundle checks.
- `qa/readiness-2026-11-06/06-android-sync.txt`: successful sync output.
- `qa/readiness-2026-11-06/06-copied-preview-network.json`: copied-bundle request evidence.
- Numbered HTTP JSON files in the same directory: timestamp, HTTP status, server request ID and safe response summary only.
