# MeInspect QA Report — 2026-11-03

## Verdict

**NOT SAFE TO PUBLISH.** Part A2 passed, and the production Stripe webhook rejection checks passed without changing payment state. However, the required real Email Report send was not runnable because no verified QA test account/session credentials were available, browser automation could not start in this Linux sandbox, and the local preview cannot establish the production HTTPS auth cookie. Most authenticated end-to-end scenarios therefore remain unrun. The frontend dependency audit also reports 3 critical, 21 high, 9 moderate, and 2 low findings. No production publication was performed.

## Scope and safeguards

- No database schema change was made.
- No package was updated and no new secret was requested or added.
- No Stripe checkout or webhook code was changed.
- No real card charge was attempted.
- Nothing was published to production.
- The only application behavior change was the explicitly authorized email recipient cap, from 10 to 30 recipients per user per rolling hour.
- That backend change was deployed to **staging only** so the new endpoint contract could be validated. Production was not changed.
- Part B did not change or delete findings or application behavior.
- Test accounts created during auth probing were named **QA Test**. They could not be verified because the supplied test domain cannot receive verification mail.

## Part A

### A1 — Email

**Result: FAIL (contract and limit pass; required real preview send NOT RUN).**

Exact request emitted by **Email Report**:

```http
POST /api/send-email
Content-Type: application/json

{"inspectionId":"<reportId>"}
```

Exact client-controlled fields: **`inspectionId` only**. Recipients, subject, HTML, and links are not accepted from the client.

Server agreement:

- Requires a non-empty string `inspectionId`.
- Requires that it be the only body field; extra fields return 400.
- Requires ownership; an unowned ID returns 404.
- Server derives valid recipients from tenant, landlord, agent, inspection metadata/inspector, and the signed-in user.
- Recipient addresses are deduplicated case-insensitively.
- Response shape: `success`, `sentCount`, `failedCount`, `results[{email,success,id?,error?}]`, and optional `error`.
- Staging typecheck, build, bundle validation, and 50-route analysis passed.
- The cap is now **30 recipients per user per rolling hour**. The focused route check confirmed the 31st reserved recipient causes 429.

Other email features and their relationship to `/api/send-email`:

| Feature | Current route/path | Uses `/api/send-email`? | Executed now | Result |
|---|---|---:|---:|---|
| Welcome email | `/api/public/notifications/welcome` | No | No real inbox test | NOT RUN |
| Password-changed email | `/api/public/notifications/password-changed` | No | No real inbox test | NOT RUN |
| Payment/unlock email | Server-side after authoritative unlock; IAP/legacy helper calls `/api/notifications/payment-success` | No | No checkout performed | NOT RUN |
| Report-complete notification | `/api/notifications/report-complete`; route exists but no current frontend caller was found | No | No | NOT RUN |
| Stripe receipt/invoice | `/api/orders/:id/invoice`, returning Stripe invoice URL | No | No paid QA order | NOT RUN |
| PDF attachment email | No attachment path exists; Email Report sends an authenticated report link | No | No | NOT RUN / NOT IMPLEMENTED |

The required real send to `aalekh.dxb@gmail.com` was **not performed**. There was no verified QA login/session available, the preview cannot use production HTTPS session cookies, and the sandbox browser failed to launch. Sending through another route or directly through Resend would not test the app's real Email Report path, so no substitute was claimed.

Evidence:

- `qa/a1-email-contract.txt`
- `qa/security-route-check.txt` (focused in-process contract regression only; not counted as the required real call)
- `qa/backend-typecheck.txt`
- `qa/backend-dry-run.txt`
- `qa/a1-staging-deploy.txt`
- `qa/credential-availability.txt`
- `qa/auth-api-probes.txt`
- `qa/staging-auth-attempt.txt`

### A2 — Android web bundle and sync

**Result: PASS.**

The previous output and Vite cache were removed, the production web build completed from current source, and Android sync completed. In Android's copied JavaScript web bundle:

- production API address occurrences: **1**
- `staging--` occurrences: **0**

Across every copied web asset there is one additional expected production URL in `mobile-auth.html`; the compiled JavaScript bundle itself contains the API base exactly once as requested.

Evidence:

- `qa/a2-frontend-build.txt`
- `qa/a2-cap-sync-android.txt`
- `qa/a2-android-js-bundle-url-counts.txt`
- `qa/a2-android-bundle-url-counts.txt`

## Final result table

Failures and unrun items are listed first. “Production read-only” means HTTP GET/invalid-signature safety calls or database SELECT only; no production record was intentionally created, updated, or deleted.

| Area | Test | Where it ran | Result | Evidence |
|---|---|---|---|---|
| A1 Email | Real Email Report send to `aalekh.dxb@gmail.com` | Preview | **NOT RUN** | No verified QA session; browser unavailable; local preview auth-cookie limitation. No send ID exists and delivery is not claimed. |
| Accounts | Full sign up, sign in/out, wrong password, reload persistence, password change | Production auth endpoint and staging auth endpoint | **FAIL** | Sign-up returned 200 but token absent; sign-in returned 403 `EMAIL_NOT_VERIFIED` (request `a5494efe8ff07b78-PDX`); wrong password returned 401 `INVALID_EMAIL_OR_PASSWORD` (`a5494b5649bc3e6d-PDX`). Sign-out/reload/password change could not continue. `qa/auth-api-probes.txt`, `qa/staging-auth-attempt.txt`. |
| Inspection | Create; rooms/ratings/notes; delete item/room; verify report | Preview | **NOT RUN** | Authenticated UI unavailable. The existing synthetic fixture check is not accepted as the requested real E2E. |
| Photos | Capture 1, 10, 30 portrait/landscape; size/padding/compression/cover order | Real device / preview | **NOT TESTED ON DEVICE** | No camera device. Existing synthetic PDF has 34 independent JPEGs, but these were not captured through the app path in this run. |
| Optional sections | Keys, utility meters, move-in section, filled and empty | Preview | **NOT RUN** | No authenticated inspection session. |
| Signatures | Three signed; one party missing | Preview / device | **NOT RUN** | No authenticated inspection session and no touch device. |
| Finalise/PDF | Generate real QA PDF and inspect every page, exact photo count, no unavailable photo, Arabic/fonts/page numbering/no blanks/file size/30-photo timing | Preview | **NOT RUN** | No authenticated QA inspection. Synthetic fixture validation passed 13 pages, 3,283,294 bytes, 34 photos, embedded fonts, Arabic, sequential pages, and no blank pages, but no 30-photo creation timing and not a real E2E. `qa/synthetic-pdf-validation.txt`, 13 pictures in `qa/synthetic-pdf-pages/`. |
| Verification | QR link; exact PDF Verified; changed copy Not verified | Production read-only | **NOT RUN** | Negative API calls for an unknown QA report returned 200/`verified:false`, request IDs `a54950d8fff73741-PDX` and `a54950da8d218636-PDX`; no registered QA PDF existed for the positive case. `qa/verification-negative-real-calls.txt`. |
| Email | Send report; open email link signed in and out | Preview and inbox | **NOT RUN** | Required real send could not be authenticated. |
| Payments | Normal-user checkout + Stripe request ID + expire; tester free checkout; credit once; persistence; paid/draft delete behavior | Staging / production | **NOT RUN** | No verified normal/tester QA sessions. No Stripe session was created and no card was charged. Focused in-process route assertions are not counted as real E2E. |
| Discount codes | Five existing codes and invalid code as normal user | Production read-only database inspection | **NOT RUN** | Existing active codes were read only: WELCOME20 → computed AED 159, LAUNCH50 → AED 149, MEINSPECT10 → AED 179, INSPECTOR → AED 99, FREE_REPORT → AED 0; invalid route logic leaves AED 199. No checkout request was made, so these are not marked PASS. `qa/discount-code-readonly-summary.txt`. |
| Access control | Two-account cross-user inspection/photo/report IDOR; admin 403/403/200 | Production | **NOT RUN** | Two verified QA sessions unavailable. Signed-out real requests returned 401 for inspection, PDF, photo, admin and email routes with request IDs recorded in `qa/unauth-route-statuses.txt`; this does not satisfy the two-account test. |
| Input safety | All payloads in every field, app/PDF/public page/email | Preview | **NOT RUN** | No authenticated QA workflow or inbox. Focused server-template escaping assertion is not a full E2E. |
| Drafts | Reload/resume midway; discard | Preview | **NOT RUN** | No authenticated browser session. |
| Credits | Two parallel requests for final credit | Staging | **NOT RUN** | No approved QA account with exactly one credit; no requests sent. |
| Dependencies | Dependency audit | Local build environment | **FAIL** | npm audit: frontend 35 total (3 critical, 21 high, 9 moderate, 2 low); backend 4 moderate. `qa/npm-audit-root-npm.json`, `qa/npm-audit-backend-npm.json`. No packages changed. |
| Android compile | Native compile | Local Linux | **NOT TESTED ON DEVICE** | Build could not start because Java/JAVA_HOME is unavailable. `qa/android-assemble-debug.txt`. |
| Browser pictures | Production page pictures for UI E2E | Local Linux browser automation | **NOT RUN** | Chromium failed before DevTools startup due sandbox/namespace restrictions; no fake screenshot was substituted. |
| Stripe webhook | Staging unsigned/wrong-signature | Staging | **FAIL** | Staging returned 500 `Webhook not configured`, showing the Stripe webhook signing secret is absent there. `qa/stripe-webhook-unsigned.txt`, `qa/stripe-webhook-wrong-signature.txt`. |
| A1 Contract | Client/server body agreement | Local source + staging build | **PASS** | Exact single field `inspectionId`; extra fields 400, unowned 404 in focused regression; staging has 50 valid routes. |
| A1 Rate limit | 30 recipients/user/hour | Local focused route check + staging deployment | **PASS** | Focused check reserves 30 then rejects next recipient with 429; staging deployment succeeded. `qa/security-route-check.txt`, `qa/a1-staging-deploy.txt`. |
| A2 Android bundle | Clean web rebuild, Android sync, URL counts | Local build | **PASS** | Compiled copied JS: production API = 1; `staging--` = 0. `qa/a2-android-js-bundle-url-counts.txt`. |
| Build quality | Frontend build/typecheck, backend typecheck/dry-run | Local build | **PASS** | Frontend build and typecheck passed; backend typecheck, bundle validation, and 50-route analysis passed. |
| Stripe webhook | Production unsigned POST | Production read-only safety call | **PASS** | 400 `Invalid Stripe signature`, request `a549511f3e67fc83-PDX`. |
| Stripe webhook | Production wrong-signature POST | Production read-only safety call | **PASS** | 400 `Invalid Stripe signature`, request `a54951204cd0aee3-PDX`. |
| Stripe webhook | Production state unchanged | Production read-only database counts | **PASS** | Before/after: orders 62→62, paid inspections 32→32, email events 0→0. `qa/webhook-state-before.txt`, `qa/stripe-webhook-repeat.txt`. |
| Public verification | Unknown/changed hash rejection | Production read-only | **PASS** | PDF/content unknown-hash calls both returned 200 with `verified:false`; request IDs in `qa/verification-negative-real-calls.txt`. This is only the negative half of the requested verification test. |
| Android files | version, backup rules, permissions | Local static inspection | **PASS** | versionCode 10; versionName 3.5; backup enabled with shared preferences/databases/external exclusions; declared permissions listed in `qa/android-static-summary.txt`. |
| Synthetic report regression | Existing parser validation and page pictures | Local fixture only | **PASS** | 13 pages, 3,283,294 bytes, 34 independent JPEG photos, 19 clauses/language, embedded fonts, Arabic searchable, no blank body pages, sequential 1–13. Not counted as real E2E. |

## Stripe webhook route-check detail

Production real calls:

- Unsigned POST: 400, request ID `a549511f3e67fc83-PDX`.
- Wrong-signature POST: 400, request ID `a54951204cd0aee3-PDX`.
- Database counts unchanged: orders 62, paid inspections 32, email send events 0.

Staging real calls:

- Unsigned and wrong-signature POST both returned 500 `Webhook not configured`, because the staging signing secret is absent. This is a staging test failure, not a production mutation.

The existing focused route-check script was also rerun after the A1 limit change. It passed its admin, delete, email payload, ownership, template escaping, and 30-recipient assertions, but it uses an in-process test double and is therefore supporting regression evidence only, not a substitute for the user's required real calls.

## Android file detail

- `versionCode`: 10
- `versionName`: 3.5
- `allowBackup`: true
- Android 11-and-below backup rules exclude all shared preferences, databases, and external storage.
- Android 12+ cloud backup and device transfer exclude all shared preferences and databases.
- Permissions: Internet, camera, fine/coarse location, network state, legacy write external storage only through API 28, read media images, and post notifications.
- Features: camera and autofocus are optional.
- Native compile was not possible because Java is unavailable; this is not a device/build PASS.

## Top 10 risks ranked by customer harm

1. **Required authenticated E2E coverage is absent.** Account, inspection, report, payment, email, ownership, draft, and concurrency behavior could contain release-blocking defects that this run could not observe.
2. **Real Email Report delivery was not proven.** Customers may pay/finalise but fail to receive or open the report link.
3. **Frontend dependency audit has 3 critical and 21 high findings.** Exploitability was not triaged here because package changes were forbidden, but the count is release-blocking until assessed.
4. **Staging Stripe webhook secret is missing.** Staging returns 500 rather than exercising signature rejection, so payment integration cannot be safely rehearsed end to end before production.
5. **No real normal-user Stripe checkout was created and expired.** Session correlation, request IDs, expiry, and no-charge behavior remain unproven.
6. **Two-account ownership isolation was not tested.** A latent IDOR could expose another customer's inspection photos or report.
7. **30-photo real capture/finalisation was not timed or device-tested.** Memory pressure, orientation, padding, cover ordering, and upload recovery remain unknown on customer hardware.
8. **Credit use is not proven atomic.** Two parallel uses of the final credit could potentially unlock two reports or create inconsistent balances.
9. **Input-safety coverage is incomplete.** Full-field script/image/prototype payloads, 5,000-character notes, Arabic and emoji were not exercised through app, PDF, public page, and email together.
10. **Android release compile/device validation is absent.** Runtime permissions, camera framing, share behavior, deep links, and backup behavior could differ from static configuration.

## Tests requiring the owner's real Android phone

Use only accounts and inspections named **QA Test**. Use no real card. Capture screenshots after every numbered checkpoint.

### 1. Install and launch

1. Install the QA build without clearing an existing production app unless the QA build has a separate application ID.
2. Record Android model, Android version, WebView/Chrome version, app version 3.5 and versionCode 10.
3. Launch on Wi-Fi, then with airplane mode, then restore Wi-Fi.
4. Confirm no white screen, crash, mixed-content warning, or stale production account appears.

### 2. Account/session

1. Create a new inbox-backed account whose profile name is **QA Test**.
2. Verify email, sign in, take a dashboard screenshot.
3. Force-stop the app, reopen, and confirm the session survives.
4. Sign out and confirm protected pages return to sign-in.
5. Try one wrong password and capture the message.
6. Complete password reset/change through the received OTP, then sign in with the new password and confirm the old password fails.

### 3. Camera/photo path

1. Create an inspection named **QA Test**.
2. Capture one portrait and one landscape image containing a checkerboard or full-frame grid touching all four edges.
3. Confirm there is no grey padding, no rotation, no edge crop, and acceptable sharpness.
4. Capture 10 photos, then 30 total through the same in-app camera action.
5. Record upload indicators, saved dimensions/file sizes if exposed, and force-stop/reopen after uploads finish.
6. Confirm all 30 return and the report cover is the first photo captured.

### 4. Draft/recovery

1. Mid-inspection, force-stop the app and reload.
2. Confirm property, rooms, ratings, notes, uploaded photos, and exact position resume.
3. Create a second **QA Test** draft and discard it; confirm it disappears without affecting the first draft.
4. Repeat once while offline; note the explicit warning and verify recovery after reconnecting.

### 5. Optional details and signatures

1. Fill keys/access cards, all utility meter fields/photos, and move-in comparison; generate a report.
2. Create another report with all optional sections empty and confirm they do not print.
3. Sign tenant, landlord and inspector using touch; verify all three on PDF.
4. Create another report with one party missing and confirm the unsigned wording is correct.

### 6. PDF and sharing

1. Finalise the 30-photo report and time from tapping Generate/Download until the share sheet or saved file is ready.
2. Save the exact PDF without editing it.
3. Photograph or screenshot every PDF page.
4. Verify page 1 title/text/logo/header/cover, every captured photo exactly once as intended, no `Photo unavailable`, Arabic shaping, emoji, sequential Page 1 of N through N of N, and no blank pages.
5. Record PDF byte size and generation time.
6. Test Android share to Files and one email app; cancel before sending if it is not the approved recipient.

### 7. Deep links and Email Report

1. From Email Report, send only to `aalekh.dxb@gmail.com` using the approved QA inspection.
2. Record the API status/request ID if visible in remote logs and the message timestamp.
3. Open the email link while signed in; confirm the exact report opens without payment.
4. Sign out, open the link again, confirm sign-in is required, sign in, and confirm return to the same report.
5. Tap a production `/report/<QA id>` app link from Gmail/Chrome and verify Android opens MeInspect correctly.

### 8. Payment handoff without charge

1. Use the approved normal QA account and create checkout.
2. Do not enter a real card or complete payment.
3. Record the Stripe request ID and session ID from server logs, then use the app's approved expiry test route to expire it.
4. Confirm the session is expired and report remains locked.
5. Perform tester and credit scenarios only after the owner provisions the QA accounts in the dashboard; never provision or alter production users from the phone test.

## Final publication decision

**Do not publish.** Re-run the authenticated matrix with inbox-backed verified QA accounts, a configured staging Stripe webhook secret, an approved Stripe no-charge/test procedure, and a real Android device. Publication can be reconsidered only after the real Email Report send, normal/tester/credit payment paths, two-account access control, 30-photo PDF, positive-and-negative verification, drafts, input safety, and credit concurrency have evidence-backed PASS results.
