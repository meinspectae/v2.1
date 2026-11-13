# Phase 1 release report — 10 November 2026

## Decision: NOT READY TO PUBLISH

Staging is deployed and backward-compatible email works in real calls. Production has NOT been updated. Production still fails the requested admin separation, paid deletion, and inspectionId email checks. Owner allowlist access is not verified. Do not click Update on the basis of this run.

All PASS rows below identify what actually ran. Local tests are explicitly separated from live acceptance. CF-Ray values are edge request references: the API did not return an x-request-id, so no application request ID has been invented. Retained HTTP evidence is in `qa/phase1-2026-11-10/`.

## 1. Release regression: isolated repair

Before application edits, the unchanged `backend/src/index.ts` failed under the explicitly invoked local @edgespark/cli 0.0.23. The same entry passed with 0.0.12: typecheck, bundle validation (830.13 KB), and route analysis (50 routes). Logs: `baseline-pinned-validation.txt`, `baseline-cli012-validation.txt`, `release-only-validation.txt`.

Historical 3 November `qa/a1-staging-deploy.txt` also reports 830.13 KB / 50 routes and successful staging deployment. Its log does not record the actual CLI executable version. The October restore point and starting root package both declared 0.0.23, but backend/package.json had no CLI dependency; the historical npm lock mentioned 0.0.22. It is NOT established that the historically executed executable was actually 0.0.23. There is no git history or complete November deployed source snapshot in this workspace. Do not mistake a manifest declaration for proof of the executing tool.

Direct inspection of the installed/registry tool artifacts establishes the incompatibility: 0.0.22 and 0.0.23 require a default app and @defs; 0.0.12 validates createApp/tables/buckets/drizzleSchema with @generated. The current source and project runtime use the latter contract. No default export was added, no SDK type pull/migration performed, and wrangler.toml remains unchanged. Restoring the compatible tool is the release-only repair; admin/delete/email changes were done separately afterward.

Release-only diff:

```diff
--- package.json
+++ package.json
-    "@edgespark/cli": "0.0.23",
+    "@edgespark/cli": "0.0.12",
--- backend/package.json
+++ backend/package.json
   "devDependencies": {
+    "@edgespark/cli": "0.0.12",
```

Both package managers' lockfiles are aligned to the chosen CLI. The backend pin prevents accidental fallback to the root or global incompatible CLI. Subsequent email-safety work adds sanitize-html 2.17.0 and @types/sanitize-html 2.16.0; those are NOT part of the release-only fix. `release-only.diff` isolates the pin; `backend-safety.diff` records application changes. Full verification was rerun after all changes.

## 2. Real acceptance matrix

| Item | Result | Evidence |
|---|---|---|
| Unchanged baseline with installed CLI 0.0.23 | FAIL, reproduced | Missing required export: default; baseline-pinned-validation.txt |
| Unchanged baseline with pinned CLI 0.0.12 | PASS, actually run | Type check passed; Bundle valid 830.13 KB; Routes valid 50 |
| Final backend type check/release/route analysis | PASS, actually run | backend-typecheck.txt exit 0; backend-validation.txt: Bundle valid 1.20 MB; 50 routes: 40 protected, 8 public, 2 webhooks |
| Final frontend typecheck/build | PASS, actually run | frontend-typecheck.txt and frontend-build.txt, exits 0 |
| Staging deployment | PASS, actually deployed | staging-deploy.txt: deployment prepared, bundle uploaded, deployed successfully to staging |
| Production sign-in with supplied credentials/cookie | PASS | 200; a582f2b358cdc654-PDX; production-signin.json |
| Staging sign-in with supplied credentials/cookie | PASS | 200; a582f31a4c2696ba-PDX; staging-signin.json |
| Production normal account admin prices | FAIL: 200, expected 403 | a582f2b8f908d82e-PDX; still 200 a5830e2f6f600c31-PDX at final check |
| Production normal account set-tester | FAIL: 200, expected 403 | a582fb10dc9e0055-PDX; requested the existing false value, no privilege change from that call |
| Staging normal account admin prices | PASS: 403 | a582fd240acdf896-PDX; repeated a58308d25ce66c17-PDX |
| Staging normal account set-tester | PASS: 403 | a582fd2869a5a096-PDX; final a5830e366e8b8639-PDX |
| Production tester admin prices | FAIL: 200, expected 403 | a583033aaa4470b9-PDX; isTester=1 confirmed by profile 200 a5830337fc0b816e-PDX |
| Staging tester admin prices | PASS: 403 | a583033d0ffdf820-PDX |
| Staging tester set-tester | PASS: 403 | a583033f5af8ac0d-PDX |
| Owner retains actual allowlisted admin access | NOT VERIFIED / BLOCKER | Supplied ID 8k5LgKUmGw7faQY8hcsk19iMV9lwepcv has legacy users.is_admin=1 but gets staging 403 both before and after edits; final /api/admin/access 403 a5830e333a4558c2-PDX. ADMIN_USER_IDS exists but secret values are not readable. No separate allowlisted owner credentials were supplied. Never added an email/is_admin bypass or changed the secret. |
| Production draft delete | PASS: 200; disposable QA only | a583015a0d3d8b90-PDX |
| Staging draft delete | PASS: 200 then GET 404 | final deployment: a58309a2cf7bf820-PDX; GET a58309a5a8038e12-PDX |
| Production tester free checkout | PASS: 200, no charge | a58303415cf4eedd-PDX; order 81; tester_1794292270379_m5tu2jw709 |
| Staging tester free checkout | PASS: 200, no charge | a5830345a9afcb5f-PDX; order 82; tester_1794292271098_6erz37k42c3 |
| Production paid QA delete | FAIL: 200, expected 409 | a58303e758c2ef6f-PDX; subsequent GET 404 a5830e3cb87ede1d-PDX. Only newly created disposable QA inspection removed; order 81 survives. |
| Staging paid QA delete | PASS: 409 | a58303ea5e6bef4b-PDX; repeat a58308d45e35c654-PDX; row remains 200 a5830e3aaefd4598-PDX |
| Staging completed/finalised marker delete | PASS: 409 | a58303ef2ec20eda-PDX; final a5830e38aedeacc8-PDX |
| Staging existing paid/registered QA report delete | PASS: 409 | a58303f178fc054d-PDX; qa-phase1-email-20261109 retained. This has both paid and finalised flags, so isolated registry-only branch is a local test, not claimed separately live. |
| Real live web Email Report capture | PASS: 200, provider accepted | Actual modal, not fabricated HTML; two one-recipient requests to own email. Provider IDs 01a1c41f-afde-779b-8d8d-58d7ecf68d24 and 01a1c41f-b0f2-7ec2-9e72-eec9d76641e8. Browser does not expose CF-Ray through CORS. |
| Production OLD captured request replay, cookie session | PASS: 200, success true | a582fb14ff628e69-PDX; provider ID 01a1c422-2978-79ea-ba37-84f94a69c3f8; recipient aalekh.dxb@gmail.com |
| Production NEW inspectionId request | FAIL: 400, expected 200 | a582fb17ac05f820-PDX; to, subject, and html are required |
| Staging OLD exact captured request replay | PASS: 200, success true | a58308dc4ac89314-PDX; provider ID 01a1c42a-c7ac-78a4-a165-64593f4fc92b; own address |
| Staging NEW inspectionId request | PASS: 200, success true | a58308d6ed5a5ef0-PDX; provider ID 01a1c42a-c42f-758f-af3a-fb1263f27449; own address |
| Staging 31-recipient request | PASS: 429, not sent | a5830992ecf18d3a-PDX; no 31-message delivery flood performed |
| Staging unrelated recipient | PASS: 403, not sent | a5830997e88111c8-PDX |
| Staging hostile HTML/client from request | PASS for request acceptance only | 200 a583099b2a711561-PDX; provider ID 01a1c42b-3ebc-72ae-9541-8170f8e2c028; sanitization/sender output verified locally, not through provider-stored HTML retrieval |
| Existing email_send_events logging | PASS, real DB observed | Entries for both formats, recipient_count=1; legacy inspection_id empty string, new inspection_id actual ID. Existing schema unchanged. |
| Production old inspection opens | PARTIAL | API 200 a58304a4880fa32d-PDX; actual browser renders Property Condition Report for mvuxjr15recovery1. Browser also reports 106 photos could not be restored. Full photo recovery is NOT a pass. |
| Production Stripe no signature | PASS: 400 | a582fb19498f9976-PDX; Invalid Stripe signature |
| Production Stripe wrong signature | PASS: 400 | a582fb1adef13016-PDX; Invalid Stripe signature |
| Staging Stripe signature checks | FAIL/configuration blocked | 500 Webhook not configured: a5830b2d5e6e6192-PDX and a5830b2f3e1e8736-PDX. SANDBOX_STRIPE_WEBHOOK_SECRET absent; production behavior not changed. |
| Tester flag/credits restored | PASS, real profile read | 200 a5830b310e3cfdb1-PDX; isTester=0, freeInspections=20 |
| Orders/payments not deleted by QA | PASS within this run | Orders 81 and 82 retained and independently queried; payments count 0. No order/payment DELETE issued. |
| Inbox delivery/read | NOT VERIFIED | Provider acceptance is not inbox delivery, spam placement, or a read receipt. No inbox access was supplied. |
| Installed Play Store v9 execution | NOT RUN | No installed v9 APK/device available. Captured live legacy contract plus restored legacy source and exact replay are compatibility evidence, not a device pass. |

## 3. Email endpoint before/after

Today in production the live modal generates a complete HTML report summary with normal styles, tables, and a signed PDF-download link when present. The user chooses checkboxes for recorded tenant/landlord/inspector addresses. It sends one request per selected entry:

```json
{
  "to": ["aalekh.dxb@gmail.com"],
  "subject": "MeInspect Report: QA Phase 1 Email Compatibility (RPT-QA-PHASE)",
  "html": "<the exact 9,228-byte HTML captured from the live modal>"
}
```

The full body is retained as `legacy-real-request.json`; the placeholder above is only an abbreviated description, not the replay body. Byte-for-byte body values were replayed. A shared email recorded twice (tenant and inspector) sends twice in the existing UI; this was preserved. It also calls the pre-existing report-complete notification after success, which can produce a separate notification email. This behavior was not silently removed.

Production validates to/subject/html, recipient syntax and an 8 MB HTML cap, sends via Resend, and returns HTTP 200 with `{success,results:[{email,success,id? or error?}],sentCount,failedCount,error?}` even for provider failures. Old sender selection included a client-from fallback when no configured sender existed. Old endpoint had no demonstrated recipient counter or sanitizer. Staging at task start accepted only `{inspectionId}` and rejected the old format; that regression is now fixed.

After changes, old requests retain those success/failure response fields and HTTP semantics. The client from field is ignored. A parsing sanitizer strips scripts/iframes/event handlers/unsafe URLs and CSS; normal formatting, links, safe images and tables remain. The captured real email is exercised in local output assertions. Each accepted request reserves its recipient count atomically in existing email_send_events, maximum 30 per user in a rolling hour; rejected requests do not poison/extend the quota. Provider attempts stay counted, including failures, and each result is logged.

Legacy has no inspection ID, so its counter row uses an empty string in the existing NOT NULL field. No schema change or synthetic inspection is necessary. The new format derives recipients/server text from an owned inspection and keeps its existing success/error response semantics.

Recipient restriction is enabled only because both the actual live modal and restored legacy modal show checkboxes and NO arbitrary email-address field. Legacy recipients must match signed-in email or addresses on any owned inspection (tenant/landlord/agent/inspector); no new inspectionId requirement was imposed. Users can still enter addresses in their inspection contact details normally.

The unpublished frontend had previously replaced recipient selection and detailed HTML/PDF emails with a fixed notification. Its modal was restored to the pre-change legacy implementation so Update does not silently change the existing Email Report experience. This is the one frontend compatibility restoration in this phase. No mobile version bump or native synchronization was performed.

## 4. Local regression coverage, not live acceptance

36 assertions actually ran using the bundled backend, a real in-memory SQLite database and a mocked email provider. Coverage: all admin prefix routes including unknown future routes; allowlisted owner and empty configuration; paid/completed/report flags; registry-only draft protection; paid order authority; payment cascade prevention; draft deletion; captured legacy request and response; string recipient; server sender; encoded javascript/event handlers/iframe/CSS stripping; preserved real email styles/tables/PDF links; own-inspection recipient; new format; ownership; provider failure shape; two concurrent requests with one quota slot; expiry; and account deletion retaining financial/finalised evidence. This is NOT a claim of live owner login, provider HTML inspection, or a 30-send end-to-end boundary run.

## 5. What Update publishes

Update/Publish promotes the currently staged backend and publishes the current frontend build, not just the selected email route. The backend promotion includes this phase's admin-prefix guard, safe deletion guards (including preventing account-delete cascades), dual email contracts, sender/HTML/recipient/rate protections, plus all other routes already in the staged source. This includes pre-existing staging changes since the older production build; no exact production bundle/deployment revision was available to derive a complete production-to-staging diff. Therefore an exact exhaustive production-change manifest cannot honestly be certified from the available access.

The frontend build includes the restored live-style Email Report modal AND previously saved unpublished work such as the safe sign-in return-path change. It does not make Android source version 3.5/code 10 live in Google Play, replace installed version 9 assets, publish an APK/AAB, or update iOS. Existing native clients start using the promoted backend, which is why the old request contract remains mandatory. No database migration, account creation, secret update or schema change is queued by this phase. Staging and production already share data; QA records and email events exist now, not only after Update.

## 6. Rollback and release gate

**Right now:** production has not been changed by a deployment, so there is no production release from this session to roll back. Do not click Update. Do not roll back the shared database: that would risk customer reports/orders/payments. Tester flag has already been restored to 0; balance stayed 20. Emails cannot be unsent. Disposable deleted QA rows do not require restoration and their tester orders must remain.

**Local/staging revert of this phase:** the pre-edit source/config copies are in `qa/phase1-2026-11-10/restore/`, and the generated `rollback-staging.sh` restores the starting backend entry and modal with the compatible CLI retained, validates, and deploys only to staging. This rollback deliberately restores the starting inspectionId-only email regression, so it is for restoring the work session state, NOT a safe production release. It leaves database rows, payments, orders, secrets and production untouched. The new email-safety helper is unused after entry rollback.

**If Update is clicked later and production regresses:** use the project's History to select the exact version that was published immediately before that Update; restore its frontend and backend together, validate and stage its backend, then use Update/Publish to restore production. Keep the compatible named-createApp tool pin when restoring that architecture. Do not run the forbidden CLI promote workaround. Recheck the live legacy email request, sign-in, owner access, tester checkout, delete guards and Stripe signature rejection. A historical production rollback reintroduces the admin/delete defects demonstrated above; it is a compatibility rollback, not security approval.

**Limit:** this session has no access to the platform's published release identifiers or verified backend rollback controls, so an exact production version ID / one-click backend rollback cannot be supplied or claimed tested. That must be resolved before publication. No rollback was executed against production. The inability to prove owner allowlist access, production revision/rollback identity, the failed production checks, and old-photo restore warning are recorded blockers, not waived by staging success.

## 7. Created, changed and retained

Created six disposable QA inspections across production/shared staging: production draft and paid; staging draft, paid, finalised marker; final-staging draft. All three disposable drafts deleted successfully; the production paid QA row was wrongly deleted by existing production behavior. Retained qa-20261110-staging-paid and qa-20261110-staging-finalised; retained tester orders 81 and 82 (amount 0). No real customer inspection was deleted. Existing qa-phase1-email-20261109 was opened, rendered and re-finalised by the live app's own email flow (about 1.05 MB PDF) and retained; no synthetic replacement PDF was used. Existing old recovery report was opened read-only.

Temporarily set ONLY the supplied QA account's tester flag for the requested real free-checkout tests, then restored it. No credits consumed and no card charged. No accounts created or auth credentials stored in the report. Cookie sessions are signed out and private session material removed at the end. Report emails were sent only to aalekh.dxb@gmail.com; provider acceptance is recorded separately from inbox delivery.

Created email sanitizer, focused regression runner, sanitized HTTP evidence runner, release comparison and evidence reports. Runtime/entry contract and wrangler config remain unchanged. Backend code/dependencies, frontend legacy email modal and lockfiles are the intended changes. No new schema, payment provider logic, native signing, or Play Store release was created.
