# Full application QA — 13 November 2026

## Decision: NOT READY FOR UPDATE

Four confirmed code defects were repaired. The PDF authorization repair is deployed to **STAGING only**; frontend repairs are prepared and built but **not published**. Staging Stripe webhook configuration and account deletion still fail. Supplied admin A login was unavailable, so admin A acceptance is NOT RUN. This is not a claim that every function works.

## Safety and evidence boundaries

- Restore point was created before application edits or live mutations: `restore-points/full-before-2026-11-13.tar.gz`, SHA-256 `0afbf7206976c4bc37c917e3e0ec5f7f1aca466b3159f8054e25d76dfc106022`. Git metadata was unavailable; archive is the restore point, not a git commit.
- No schema changes, package updates, secret edits, production deployment, charges, or order/payment deletions. CLI remained 0.0.12. Frozen installs did not change manifests or either lockfile format. Checkout creation/discount block and complete Stripe signature/fallback section are byte-identical to restore point.
- Staging and production share app database rows. All new shared data is QA-owned and inventoried below. Six Stripe sessions were live-mode due existing staging fallback; every one was explicitly expired and no payment was made.
- Real API requests used staging. Browser used a temporary local bridge to the real staging API with a disposable QA session because local HTTP cannot use production secure-cookie authentication directly. This is browser-plus-real-backend coverage, not testing a published staging frontend.
- App HTTP responses did not supply an application request ID. Evidence records that absence and the real **CF-Ray** correlation ID instead; no request IDs invented. Stripe request IDs are listed separately. Local tests have no external HTTP request ID.
- Anonymous accounts have no password: anonymous sign-in, session persistence, sign-out and rejected wrong password ran; successful email/password login with supplied A did not. No credentials were requested, recovered from hashes, guessed or reset.

## Test matrix — failures first

| Area | Test | Result | Evidence |
|---|---|---|---|
| Webhook | unsigned returns 400 | FAIL | HTTP 500; request ID not supplied; CF-Ray a59bbfa2cc859976-PDX; webhook-unsigned. Webhook not configured |
| Webhook | wrong-signature returns 400 | FAIL | HTTP 500; request ID not supplied; CF-Ray a59bbfa3fa025f03-PDX; webhook-wrong-signature. Webhook not configured |
| Access control | own report cannot reference another account PDF | FAIL | HTTP 200; request ID not supplied; CF-Ray a59bd575fa771561-PDX; B-own-report-foreign-pdf. Real QA-only cross-account path probe |
| Access control | foreign PDF bytes blocked | FAIL | HTTP 200; request ID not supplied; CF-Ray a59bd5776a73afe8-PDX; B-foreign-pdf-bytes. Matched victim hash: True |
| Accounts | disposable account deletion | FAIL | HTTP 500; request ID not supplied; CF-Ray a59bdc4438558969-PDX; delete-account |
| Accounts | deleted account session invalid | FAIL | HTTP 200; request ID not supplied; CF-Ray a59bdc482fe29b30-PDX; deleted-account-session |
| Access control | Foreign PDF metadata exploit before repair | FAIL | HTTP 200; request ID not supplied; CF-Ray a59bd5776a73afe8-PDX; B-foreign-pdf-bytes. FIXED ON STAGING: HTTP 200 previously returned victim QA PDF bytes matching registered hash; fix3-foreign-pdf-denied is 403 |
| Input safety | Email template interpreted malicious names as HTML | FAIL | email-escaping-before (local/browser evidence). FIXED in prepared frontend: actual template failed 3/6 literal-string cases before; 6/6 pass after |
| Frontend | Cloud-only paid report stuck loading | FAIL | HTTP 200; request ID not supplied; CF-Ray a59bcd4fac511571-PDX; report-load-before. FIXED in prepared frontend: request-cancelling effect; browser now opens real paid report and unknown ID exits loading |
| Access control | Offline API cache crossed account boundary | FAIL | sw-access-before (local/browser evidence). FIXED in prepared frontend: executed service worker reused prior account response; after repair no shared API/storage caching |
| Payments | Stripe test-mode isolation | FAIL | HTTP 200; request ID not supplied; CF-Ray a59bbf3f0d1d5ecd-PDX; pay-normal-checkout. Staging checkout returned cs_live session using existing fallback. No charge made; all six Stripe sessions expired. No key/fallback/checkout changes permitted. |
| Auth | supplied A password sign in and admin access | NOT RUN | credential-availability (local/browser evidence). QA_EMAIL and QA_PASSWORD absent; no retained supplied A session located |
| Payments | launch50 checkout | NOT RUN | HTTP 401; request ID not supplied; CF-Ray a59bbf523b6c150f-PDX; pay-launch50-checkout. Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Payments | meinspect10 session expired | NOT RUN | HTTP 401; request ID not supplied; CF-Ray a59bbf592dd94b48-PDX; pay-meinspect10-expire. Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Payments | free session expiry | NOT RUN | HTTP 200; request ID not supplied; CF-Ray a59bbf6428a6e5c0-PDX; pay-free-checkout. Free discount does not create a Stripe session; no session to expire |
| Payments | launch50 actual price AED 149 | NOT RUN | HTTP 200; request ID not supplied; CF-Ray a59bbf70fcc4b298-PDX; N-orders. Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Verification | browser negative | NOT RUN | verify-page-negative (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Verification | browser positive | NOT RUN | verify-page-positive (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Verification | browser pdf | NOT RUN | verify-page-pdf (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Android | release source settings | NOT RUN | android-static (local/browser evidence). Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Payments | tester order receipt returned | NOT RUN | HTTP 400; request ID not supplied; CF-Ray a59be42c6869ff1a-PDX; tester-order-invoice. Initial QA harness/expectation failure, not application defect; corrected fresh PASS appears below. Original response retained. |
| Auth | supplied account password login | NOT RUN | credential-availability (local/browser evidence). Previously supplied login secret/session unavailable in this session; no passwords requested or reset |
| Access control | admin A staging 200 | NOT RUN | credential-availability (local/browser evidence). No usable supplied A session; existing admin role not modified |
| Real phone | camera capture on real phone | NOT RUN | manual-device-checks (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Requires actual device or recipient inbox; no substitute claimed |
| Real phone | PDF device save share print | NOT RUN | manual-device-checks (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Requires actual device or recipient inbox; no substitute claimed |
| Real phone | drafts after device restart offline | NOT RUN | manual-device-checks (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Requires actual device or recipient inbox; no substitute claimed |
| Real phone | email inbox delivery | NOT RUN | manual-device-checks (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Requires actual device or recipient inbox; no substitute claimed |
| Real phone | Stripe return to installed app | NOT RUN | manual-device-checks (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Requires actual device or recipient inbox; no substitute claimed |
| Real phone | Android signed build install permissions | NOT RUN | manual-device-checks (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Requires actual device or recipient inbox; no substitute claimed |
| Release | native Android compile signing | NOT RUN | manual-device-checks (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Static settings only; no native build or credentials requested |
| Release | Production full functional acceptance after Update | NOT RUN | no publication (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). No production deployment; only live frontend asset address audit ran on production. |
| Email | Read actual provider-stored sanitized HTML / sender | NOT RUN | provider access unavailable (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Real requests accepted and local actual handler capture proves sanitizer/sender behavior; no provider credential or inbox access requested. |
| Auth | N anonymous sign up | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbb4f0d94ad76-PDX; N-signup |
| Auth | B anonymous sign up | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbb5bd836ef24-PDX; B-signup |
| Auth | T anonymous sign up | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbb65df6a5ecc-PDX; T-signup |
| Auth | C anonymous sign up | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbb6e8b33dabf-PDX; C-signup |
| Auth | N persisted session | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf3c9ccc0d87-PDX; N-session |
| Inspections | pay-normal create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf3c79258ce4-PDX; pay-normal-create |
| Accounts | N profile and initial balance | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf3e8d0aff0a-PDX; N-profile |
| Auth | B persisted session | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf402f7d8636-PDX; B-session |
| Accounts | B profile and initial balance | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf41dd36ef8c-PDX; B-profile |
| Auth | T persisted session | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf438c259b30-PDX; T-session |
| Accounts | T profile and initial balance | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf44ef6a6e09-PDX; T-profile |
| Payments | normal session expired | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf441b1b1571-PDX; pay-normal-expire |
| Payments | normal real Stripe session request id | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf3f0d1d5ecd-PDX; pay-normal-checkout. req_mg2IWxaSA7fc1f |
| Payments | normal checkout | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf3f0d1d5ecd-PDX; pay-normal-checkout |
| Auth | C persisted session | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf464aaf150f-PDX; C-session |
| Inspections | pay-welcome20 create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf465e31ff17-PDX; pay-welcome20-create |
| Accounts | C profile and initial balance | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf4798258969-PDX; C-profile |
| Auth | wrong password rejected | PASS | HTTP 401; request ID not supplied; CF-Ray a59bbf48e96dd74d-PDX; wrong-password. Anonymous identity has no password; real supplied-account wrong password NOT RUN |
| Inspections | main create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf4bbb20efde-PDX; main-create |
| Inspections | open rooms ratings notes | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf4dcbfb9bf9-PDX; main-open |
| Fields | keys meters move-in round trip | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf4dcbfb9bf9-PDX; main-open |
| Payments | welcome20 session expired | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf4d1cd1b7b9-PDX; pay-welcome20-expire |
| Signatures | all three signatures round trip | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf4dcbfb9bf9-PDX; main-open |
| Payments | welcome20 real Stripe session request id | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf486f00503f-PDX; pay-welcome20-checkout. req_R4TDiQx3w8HAyI |
| Input safety | six adversarial strings stored literally | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf4dcbfb9bf9-PDX; main-open |
| Payments | welcome20 checkout | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf486f00503f-PDX; pay-welcome20-checkout |
| Inspections | pay-launch50 create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf4f6f356c24-PDX; pay-launch50-create |
| Inspections | edit inspection | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf4f689c5ed2-PDX; main-edit |
| Inspections | list includes new inspection | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf52bb70a11a-PDX; main-list |
| Inspections | pay-meinspect10 create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf533f972d7c-PDX; pay-meinspect10-create |
| Inspections | empty create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf542e2f1d89-PDX; empty-create |
| Fields | empty optional fields | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf561b9e054d-PDX; empty-open |
| Delete rules | draft delete returns 200 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf576c4796ba-PDX; empty-delete |
| Payments | meinspect10 real Stripe session request id | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf5538f2cf48-PDX; pay-meinspect10-checkout. req_LpDAv4yVV447NW |
| Payments | meinspect10 checkout | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf5538f2cf48-PDX; pay-meinspect10-checkout |
| Delete rules | deleted draft returns 404 | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf599efffef6-PDX; empty-gone |
| Access control | N POST /api/admin/audit-stripe-unlocks denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf5aef93ef10-PDX; N-admin-post-audit-stripe-unlocks |
| Inspections | pay-inspector create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf5a5f6cdabf-PDX; pay-inspector-create |
| Access control | N GET /api/admin/access denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf5c5ad75332-PDX; N-admin-get-access |
| Access control | N POST /api/admin/prices denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf5d9bfbef24-PDX; N-admin-post-prices |
| Access control | N GET /api/admin/prices denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf5ed82aefde-PDX; N-admin-get-prices |
| Access control | N POST /api/admin/set-tester denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf600956e5c0-PDX; N-admin-post-set-tester |
| Payments | inspector session expired | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf603bccfef6-PDX; pay-inspector-expire |
| Payments | inspector real Stripe session request id | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf5c783cd82e-PDX; pay-inspector-checkout. req_rrUmihZ1tO4Xfg |
| Payments | inspector checkout | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf5c783cd82e-PDX; pay-inspector-checkout |
| Access control | N GET /api/admin/users denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf614cd3b8b9-PDX; N-admin-get-users |
| Access control | N POST /api/admin/grant-credits denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf62cc429314-PDX; N-admin-post-grant-credits |
| Inspections | pay-free create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf622bf8b84b-PDX; pay-free-create |
| Access control | N POST /api/admin/revoke-credits denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf640fb78e63-PDX; N-admin-post-revoke-credits |
| Access control | T POST /api/admin/audit-stripe-unlocks denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf65489fc4ac-PDX; T-admin-post-audit-stripe-unlocks |
| Access control | T GET /api/admin/access denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf668903c153-PDX; T-admin-get-access |
| Access control | T POST /api/admin/prices denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf67ca01efb8-PDX; T-admin-post-prices |
| Payments | free checkout | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf6428a6e5c0-PDX; pay-free-checkout |
| Access control | T GET /api/admin/prices denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf691dd1962a-PDX; T-admin-get-prices |
| Inspections | pay-invalid create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf692c5869d7-PDX; pay-invalid-create |
| Access control | T POST /api/admin/set-tester denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf6a6b4d2d7c-PDX; T-admin-post-set-tester |
| Access control | T GET /api/admin/users denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf6b9debef0c-PDX; T-admin-get-users |
| Access control | T POST /api/admin/grant-credits denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf6cda67ccd1-PDX; T-admin-post-grant-credits |
| Access control | T POST /api/admin/revoke-credits denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf6e1c1b2fbe-PDX; T-admin-post-revoke-credits |
| Access control | second account GET /api/inspections/qa-20261113-main | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf6f58a869d5-PDX; B-denied-0 |
| Payments | invalid session expired | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf6f0f46147f-PDX; pay-invalid-expire |
| Payments | invalid real Stripe session request id | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf6b2e5e503f-PDX; pay-invalid-checkout. req_nNKCvevSju0pis |
| Payments | invalid checkout | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf6b2e5e503f-PDX; pay-invalid-checkout |
| Access control | second account PUT /api/inspections/qa-20261113-main | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf70b936d74d-PDX; B-denied-1 |
| Payments | normal actual price AED 199 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf70fcc4b298-PDX; N-orders |
| Payments | welcome20 actual price AED 159 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf70fcc4b298-PDX; N-orders |
| Payments | meinspect10 actual price AED 179 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf70fcc4b298-PDX; N-orders |
| Payments | inspector actual price AED 99 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf70fcc4b298-PDX; N-orders |
| Payments | free actual price AED 0 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf70fcc4b298-PDX; N-orders |
| Payments | invalid actual price AED 199 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf70fcc4b298-PDX; N-orders |
| Access control | second account DELETE /api/inspections/qa-20261113-main | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf71f8680c31-PDX; B-denied-2 |
| Inspections | tester create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf727b67ef1c-PDX; tester-create |
| Access control | second account GET /api/download/pdf/qa-20261113-main | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf735e71dd6a-PDX; B-denied-3 |
| Access control | second account GET /api/inspections/qa-20261113-main/photos | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf748af04598-PDX; B-denied-4 |
| Access control | second account POST /api/upload/pdf | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf75ca0e12b1-PDX; B-denied-5 |
| Payments | tester free checkout | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf746fcb96ba-PDX; tester-checkout |
| Access control | second account POST /api/upload/photo | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf771c5accd1-PDX; B-denied-6 |
| Delete rules | paid inspection delete 409 | PASS | HTTP 409; request ID not supplied; CF-Ray a59bbf779d9ccb90-PDX; tester-paid-delete |
| Access control | second account POST /api/inspections/qa-20261113-main/finalise | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf78584c7b78-PDX; B-denied-7 |
| Payments | paid report never asks again | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf78dcd78bee-PDX; tester-repeat-checkout |
| Access control | second account POST /api/checkout | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf79ac9623a3-PDX; B-denied-8 |
| Access control | second account POST /api/send-email | PASS | HTTP 404; request ID not supplied; CF-Ray a59bbf7ace15ef20-PDX; B-denied-9 |
| Inspections | credit-1 create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf7a3d87b1c2-PDX; credit-1-create |
| Inspections | credit-2 create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bbf7c2e8d8ce4-PDX; credit-2-create |
| Photos | photo 1 upload route | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf7c192131df-PDX; photo1-presign |
| Payments | last credit parallel requests exactly one unlock | PASS | credit-parallel-1 and credit-parallel-2 |
| Photos | photo 1 binary upload | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf7e89b1debd-PDX; photo1-put |
| Payments | credit used only once | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf811ee7ef24-PDX; credit-repeat |
| Accounts | credit balance exactly zero never negative | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf824fd68e69-PDX; credit-balance |
| Photos | photo 1 confirmed | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf815b0f4afe-PDX; photo1-confirm |
| Accounts | one credit order only | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf837fcd3d49-PDX; credit-orders |
| Photos | photo 1 hash matches | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf852c74bd22-PDX; photo1-download |
| Access control | second account photo 1 denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf86c943ef38-PDX; B-photo1 |
| Photos | photo 2 upload route | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf87cd31f3b4-PDX; photo2-presign |
| Photos | photo 2 binary upload | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf8a3c70d106-PDX; photo2-put |
| Photos | photo 2 confirmed | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf8c68875012-PDX; photo2-confirm |
| Photos | photo 2 hash matches | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf903aee8b10-PDX; photo2-download |
| Access control | second account photo 2 denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf91bf3169d7-PDX; B-photo2 |
| Photos | photo 3 upload route | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf92ac9e5f03-PDX; photo3-presign |
| Photos | photo 3 binary upload | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf951cd29873-PDX; photo3-put |
| Photos | photo 3 confirmed | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf97cece6e10-PDX; photo3-confirm |
| Photos | photo 3 hash matches | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbf9b8d28a11a-PDX; photo3-download |
| Access control | second account photo 3 denied | PASS | HTTP 403; request ID not supplied; CF-Ray a59bbf9d4e960ba9-PDX; B-photo3 |
| Photos | three saved photo references restored | PASS | HTTP 200; request ID not supplied; CF-Ray a59bbfa03b938e5d-PDX; main-photo-list |
| Payments | pay-meinspect10 session expired retry | PASS | HTTP 200; request ID not supplied; CF-Ray a59bc01fc9fc1fb9-PDX; pay-meinspect10-expire-retry. Initial 401 caused by QA cookie-jar race; client corrected, app unchanged |
| Payments | launch50 checkout retry | PASS | HTTP 200; request ID not supplied; CF-Ray a59bc0218fab8969-PDX; pay-launch50-checkout-retry. Initial QA cookie-jar race resolved |
| Payments | launch50 session expired | PASS | HTTP 200; request ID not supplied; CF-Ray a59bc0256e5588dc-PDX; pay-launch50-expire |
| Payments | launch50 actual price AED 149 retry | PASS | HTTP 200; request ID not supplied; CF-Ray a59bc0273b8d61c8-PDX; N-orders-retry |
| Inspections | email create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bca853fd3fc83-PDX; email-create |
| Email | legacy format real provider 200 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bca89787f1a0b-PDX; email-legacy |
| Email | inspectionId format real provider 200 | PASS | HTTP 200; request ID not supplied; CF-Ray a59bca8e5d3c23a3-PDX; email-new. Anonymous auth email may be nondeliverable; inbox not claimed |
| Email | unsafe HTML request accepted after sanitizer | PASS | HTTP 200; request ID not supplied; CF-Ray a59bca92cc918639-PDX; email-unsafe-html. Actual outgoing HTML validated separately by executed provider harness; remote inbox content NOT RUN |
| Email | 31st recipient in hour returns 429 | PASS | HTTP 429; request ID not supplied; CF-Ray a59bcb598d6fefa4-PDX; email-recipient-31 |
| Inspections | final create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bcc1bcb78b248-PDX; final-create |
| Payments | final report free unlock | PASS | HTTP 200; request ID not supplied; CF-Ray a59bcc1e2b71efa4-PDX; final-free-checkout |
| Finalisation | actual browser PDF generated uploaded finalised | PASS | browser-finalise (local/browser evidence). Real app renderer, not synthetic PDF; da61a14eb25390d26ca09a0c874a1309f1bd7872cf2976abe6861b4acc24b20f |
| Verification | unknown | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd060ddd43d1b-PDX; verify-unknown |
| Verification | registered-pdf | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd0626c485d68-PDX; verify-registered-pdf |
| Verification | registered-content | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd063dd0e69da-PDX; verify-registered-content |
| PDF | registered PDF downloaded hash matches | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd06709e79976-PDX; final-pdf-download |
| Access control | second account actual final PDF denied | PASS | HTTP 404; request ID not supplied; CF-Ray a59bd069ade8b332-PDX; B-final-pdf-denied |
| Delete rules | finalised inspection returns 409 | PASS | HTTP 409; request ID not supplied; CF-Ray a59bd06b2f7c148b-PDX; final-delete |
| Inspections | pdf-access-probe create | PASS | HTTP 201; request ID not supplied; CF-Ray a59bd573ce208e63-PDX; pdf-access-probe-create |
| Access control | foreign pdfUrl denied after fix | PASS | HTTP 403; request ID not supplied; CF-Ray a59bd880d87a4b48-PDX; fix3-foreign-pdf-denied |
| Access control | owner final PDF still allowed after fix | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd8858f840eda-PDX; fix3-owner-pdf-allowed |
| Release | live frontend production address once no staging | PASS | live-bundle-counts (local/browser evidence). 36 actual live JS chunks |
| Verification | browser negative completed | PASS | verify-browser-negative-final (local/browser evidence; HTTP/request ID not applicable unless shown in artifact) |
| Verification | browser positive completed | PASS | verify-browser-positive-final (local/browser evidence; HTTP/request ID not applicable unless shown in artifact) |
| Verification | browser PDF verification completed | PASS | verify-browser-pdf-final (local/browser evidence; HTTP/request ID not applicable unless shown in artifact) |
| Frontend | /history opens | PASS | browser-history (local/browser evidence; HTTP/request ID not applicable unless shown in artifact) |
| Frontend | /settings opens | PASS | browser-settings (local/browser evidence; HTTP/request ID not applicable unless shown in artifact) |
| Frontend | /new opens | PASS | browser-new (local/browser evidence; HTTP/request ID not applicable unless shown in artifact) |
| Input safety | stored malicious names rendered as text | PASS | browser-input-safety (local/browser evidence) |
| Frontend | unknown report does not spin forever | PASS | browser-missing-report (local/browser evidence; HTTP/request ID not applicable unless shown in artifact) |
| Sync | full inspection sync | PASS | HTTP 200; request ID not supplied; CF-Ray a59be40debd0fef6-PDX; sync-pull |
| Sync | push QA inspection | PASS | HTTP 200; request ID not supplied; CF-Ray a59be4161bef2fbe-PDX; sync-push |
| Photos | owner batch download URLs | PASS | HTTP 200; request ID not supplied; CF-Ray a59be418af7fefc6-PDX; photos-batch |
| Access control | second account batch denied per item | PASS | HTTP 200; request ID not supplied; CF-Ray a59be41b5d8ae8e9-PDX; B-photos-batch |
| Fields | empty reference attachment returns 404 | PASS | HTTP 404; request ID not supplied; CF-Ray a59be41cac76b84b-PDX; reference-empty |
| Fields | reference PDF upload | PASS | HTTP 200; request ID not supplied; CF-Ray a59be41f9b0bfdb1-PDX; reference-upload |
| Fields | saved move-in PDF returned | PASS | HTTP 200; request ID not supplied; CF-Ray a59be424ce328d3a-PDX; reference-download |
| Access control | second account reference PDF denied | PASS | HTTP 404; request ID not supplied; CF-Ray a59be4270c8c58d9-PDX; B-reference-denied |
| Payments | T paid access reconciliation | PASS | HTTP 200; request ID not supplied; CF-Ray a59be428ff45ff03-PDX; T-reconcile |
| Payments | C paid access reconciliation | PASS | HTTP 200; request ID not supplied; CF-Ray a59be42abc93aee3-PDX; C-reconcile |
| Access control | second account invoice denied | PASS | HTTP 404; request ID not supplied; CF-Ray a59be42e1d7ada91-PDX; B-order-invoice-denied |
| Payments | normal expired session does not unlock | PASS | HTTP 200; request ID not supplied; CF-Ray a59be42fa8068864-PDX; checkout-status-normal |
| Payments | welcome20 expired session does not unlock | PASS | HTTP 200; request ID not supplied; CF-Ray a59be4324c9cd0a0-PDX; checkout-status-welcome20 |
| Payments | meinspect10 expired session does not unlock | PASS | HTTP 200; request ID not supplied; CF-Ray a59be4350958ad66-PDX; checkout-status-meinspect10 |
| Payments | inspector expired session does not unlock | PASS | HTTP 200; request ID not supplied; CF-Ray a59be4374b7723a3-PDX; checkout-status-inspector |
| Payments | invalid expired session does not unlock | PASS | HTTP 200; request ID not supplied; CF-Ray a59be4398d053e6d-PDX; checkout-status-invalid |
| Payments | launch50 expired session does not unlock | PASS | HTTP 200; request ID not supplied; CF-Ray a59be43be96bff17-PDX; checkout-status-launch50 |
| Cleanup | delete own QA email draft | PASS | HTTP 200; request ID not supplied; CF-Ray a59be66ad91eaee3-PDX; cleanup-email |
| Cleanup | delete own QA pdf-access-probe draft | PASS | HTTP 200; request ID not supplied; CF-Ray a59be66dea4d3741-PDX; cleanup-pdf-access-probe |
| Accounts | N final nonnegative balance | PASS | HTTP 200; request ID not supplied; CF-Ray a59be6709d911d89-PDX; N-final-profile |
| Auth | N sign out | PASS | HTTP 200; request ID not supplied; CF-Ray a59be6748c8bdab7-PDX; N-signout |
| Auth | N session cleared | PASS | HTTP 200; request ID not supplied; CF-Ray a59be676d9b4c8da-PDX; N-session-after-signout |
| Auth | N protected route after logout | PASS | HTTP 401; request ID not supplied; CF-Ray a59be6787c229314-PDX; N-profile-after-signout |
| Accounts | B final nonnegative balance | PASS | HTTP 200; request ID not supplied; CF-Ray a59be67a0d494518-PDX; B-final-profile |
| Auth | B sign out | PASS | HTTP 200; request ID not supplied; CF-Ray a59be67d4f2cda91-PDX; B-signout |
| Auth | B session cleared | PASS | HTTP 200; request ID not supplied; CF-Ray a59be67f9bc3eedd-PDX; B-session-after-signout |
| Auth | B protected route after logout | PASS | HTTP 401; request ID not supplied; CF-Ray a59be6815cdddabf-PDX; B-profile-after-signout |
| Accounts | T final nonnegative balance | PASS | HTTP 200; request ID not supplied; CF-Ray a59be68298bcfef0-PDX; T-final-profile |
| Auth | T sign out | PASS | HTTP 200; request ID not supplied; CF-Ray a59be685f821efd6-PDX; T-signout |
| Auth | T session cleared | PASS | HTTP 200; request ID not supplied; CF-Ray a59be6888c0c9bf9-PDX; T-session-after-signout |
| Auth | T protected route after logout | PASS | HTTP 401; request ID not supplied; CF-Ray a59be68a1e964e7c-PDX; T-profile-after-signout |
| Auth | C sign out | PASS | HTTP 200; request ID not supplied; CF-Ray a59be68ebd8a5ec8-PDX; C-signout |
| Auth | C session cleared | PASS | HTTP 200; request ID not supplied; CF-Ray a59be690fb05ef63-PDX; C-session-after-signout |
| Auth | C protected route after logout | PASS | HTTP 401; request ID not supplied; CF-Ray a59be692a842ef94-PDX; C-profile-after-signout |
| Release | protected release invariants | PASS | final-invariants (local/browser evidence) |
| Android | release source settings corrected test | PASS | android-static-final (local/browser evidence). Original permission allowlist omitted required Android <=9 documents permission; no app change |
| Accounts | paid report and order survive failed account deletion | PASS | account-deletion-retention (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Fresh database read: report qa-20261113-credit-1 and order 90 retained; auth identity remains; profile and draft credit-2 removed |
| Payments | tester invoice unavailable by design | PASS | HTTP 400; request ID not supplied; CF-Ray a59be42c6869ff1a-PDX; tester-order-invoice. HTTP 400 expected for non-Stripe free order; not a failed purchase or code defect |
| Email | custom sender ignored and unsafe markup stripped | PASS | fix4-compatibility (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). Executed real backend handlers with captured provider request; live sends 200, actual provider HTML inspection NOT RUN |
| Webhook | signed duplicate missing-report dummy harness | PASS | fix4-safety (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). 33 local handler assertions; signed and duplicate 200; missing report 200; no live signed event used |
| Email | actual modal delivery accepted | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd5087ae49935-PDX; browser-email. HTTP 200; provider accepted 1 recipient, 0 failures; no inbox claim |
| Input safety | email literal input escaping regression | PASS | email-escaping-fix4 (local/browser evidence). See before/after evidence; local/browser scope stated in artifact |
| Frontend | cloud-only report loading repaired | PASS | report-load-after (local/browser evidence). See before/after evidence; local/browser scope stated in artifact |
| Access control | shared offline API cache leakage repaired | PASS | sw-access-after (local/browser evidence). See before/after evidence; local/browser scope stated in artifact |
| Release | Frontend and backend type checks after every fix | PASS | fix1/2/3/4-frontend-typecheck and backend-typecheck. All eight commands exit 0 |
| Release | Production frontend build after every fix | PASS | fix1/2/3/4-build (local/browser evidence; HTTP/request ID not applicable unless shown in artifact). All four builds exit 0 |
| Release | Pinned CLI 0.0.12 release validation and staging deployment | PASS | fix3-validation; fix3-staging; staging-check. 50 routes; exact Schema up to date (no changes); all 11 schema files byte-identical; staging reference 39aec344... |

## All 50 routes: fresh real unauthenticated/public calls

This section proves route reachability and auth/validation gates only. A 401 is **not** a normal-user happy-path pass. Positive admin actions are NOT RUN without A. The detailed positive tests above cover inspections, storage, signatures, finalisation, verification, email, checkout, credits, profile, sync and deletion.

| Area | Test | Result | Evidence |
|---|---|---|---|
| Route gate | GET /api/public/mobile-auth/google | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd934ac5e6c17-PDX; public validation response |
| Route gate | POST /api/public/mobile-auth/secure-state | PASS | HTTP 400; request ID not supplied; CF-Ray a59bd934ae9fc4ac-PDX; public validation response |
| Route gate | GET /api/public/mobile-auth/callback | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd934bcb91d57-PDX; public validation response |
| Route gate | POST /api/user/profile | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd934aeb3d74d-PDX; unauthenticated gate |
| Route gate | DELETE /api/user/account | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd937cd628ce4-PDX; unauthenticated gate |
| Route gate | GET /api/user/profile | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd937d827121f-PDX; unauthenticated gate |
| Route gate | GET /api/inspections | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd937c9bf816e-PDX; unauthenticated gate |
| Route gate | GET /api/inspections/:id | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9384dbdbd22-PDX; unauthenticated gate |
| Route gate | POST /api/inspections | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd938bfecefa4-PDX; unauthenticated gate |
| Route gate | PUT /api/inspections/:id | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd939afbf4598-PDX; unauthenticated gate |
| Route gate | DELETE /api/inspections/:id | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93a290bb84b-PDX; unauthenticated gate |
| Route gate | POST /api/send-email | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93a399cd106-PDX; unauthenticated gate |
| Route gate | GET /api/sync/inspections | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93a4f2023a3-PDX; unauthenticated gate |
| Route gate | POST /api/sync/push | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93ac9305ee3-PDX; unauthenticated gate |
| Route gate | POST /api/public/verify/:id | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd93b0d1cc654-PDX; public validation response |
| Route gate | POST /api/inspections/:id/reference/upload | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93b6dbba096-PDX; unauthenticated gate |
| Route gate | GET /api/inspections/:id/reference | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93b89c98e6c-PDX; unauthenticated gate |
| Route gate | POST /api/inspections/:id/finalise | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93bcf09b338-PDX; unauthenticated gate |
| Route gate | POST /api/upload/pdf | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93c8925cb90-PDX; unauthenticated gate |
| Route gate | GET /api/download/pdf/:inspectionId | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93cbed91c37-PDX; unauthenticated gate |
| Route gate | POST /api/upload/photo | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93cee86495f-PDX; unauthenticated gate |
| Route gate | POST /api/inspections/:id/photos/:photoId/confirm | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93cf8ecfef4-PDX; unauthenticated gate |
| Route gate | GET /api/inspections/:id/photos | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93d7a9fe102-PDX; unauthenticated gate |
| Route gate | GET /api/download/photo | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93dafb49935-PDX; unauthenticated gate |
| Route gate | POST /api/download/photos | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93dbecfcb73-PDX; unauthenticated gate |
| Route gate | POST /api/checkout | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93ddbb98e6c-PDX; unauthenticated gate |
| Route gate | POST /api/checkout/:sessionId/expire | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93e6faa9873-PDX; unauthenticated gate |
| Route gate | GET /api/checkout/:sessionId | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93e8a7cb395-PDX; unauthenticated gate |
| Route gate | POST /api/inspections/:id/reconcile-payment | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93e9b5ade1d-PDX; unauthenticated gate |
| Route gate | POST /api/public/payments/confirm | PASS | HTTP 400; request ID not supplied; CF-Ray a59bd93ebf4c69d5-PDX; public validation response |
| Route gate | POST /api/public/payments/client-error | PASS | HTTP 200; request ID not supplied; CF-Ray a59bd93f4f0fd74d-PDX; public validation response |
| Route gate | POST /api/admin/audit-stripe-unlocks | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93f7826ad66-PDX; unauthenticated gate |
| Route gate | POST /api/webhooks/stripe | FAIL | HTTP 500; request ID not supplied; CF-Ray a59bd93f79f18e12-PDX; public validation response |
| Route gate | POST /api/webhooks/revenuecat | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd93f8a976192-PDX; public validation response |
| Route gate | POST /api/inspections/:id/reconcile-purchase | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9402a6e9873-PDX; unauthenticated gate |
| Route gate | GET /api/orders | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9404f00c12a-PDX; unauthenticated gate |
| Route gate | GET /api/orders/:id/invoice | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9405aa29976-PDX; unauthenticated gate |
| Route gate | GET /api/admin/access | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9407afa5012-PDX; unauthenticated gate |
| Route gate | POST /api/admin/prices | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9410a400ba9-PDX; unauthenticated gate |
| Route gate | GET /api/admin/prices | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9412c1bc8da-PDX; unauthenticated gate |
| Route gate | POST /api/admin/set-tester | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9414d3470b9-PDX; unauthenticated gate |
| Route gate | GET /api/admin/users | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9415ab43741-PDX; unauthenticated gate |
| Route gate | POST /api/admin/grant-credits | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd941ddff12b1-PDX; unauthenticated gate |
| Route gate | POST /api/admin/revoke-credits | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd941ea79fdb1-PDX; unauthenticated gate |
| Route gate | POST /api/public/notifications/welcome | PASS | HTTP 400; request ID not supplied; CF-Ray a59bd9421d3b817f-PDX; public validation response |
| Route gate | POST /api/public/notifications/password-changed | PASS | HTTP 400; request ID not supplied; CF-Ray a59bd9422844efce-PDX; public validation response |
| Route gate | POST /api/notifications/welcome | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd942986c5f03-PDX; unauthenticated gate |
| Route gate | POST /api/notifications/report-complete | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd942add9fefd-PDX; unauthenticated gate |
| Route gate | POST /api/notifications/payment-success | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd942fead96ba-PDX; unauthenticated gate |
| Route gate | POST /api/notifications/password-changed | PASS | HTTP 401; request ID not supplied; CF-Ray a59bd9431a2defc2-PDX; unauthenticated gate |

## Payments: actual prices and expiry proof

| Code | Price AED | Checkout | Stripe creation request ID | Expiry | Stripe expiry request ID |
|---|---:|---|---|---|---|
| No code | 199 | HTTP 200 | req_mg2IWxaSA7fc1f | HTTP 200 / expired | req_EJkFMEp2j0VwPl |
| WELCOME20 | 159 | HTTP 200 | req_R4TDiQx3w8HAyI | HTTP 200 / expired | req_NFDqdVoMGzmAex |
| LAUNCH50 | 149 | HTTP 200 | req_DkL0E5il35lErG | HTTP 200 / expired | req_j1snqH9tfQJiu0 |
| MEINSPECT10 | 179 | HTTP 200 | req_LpDAv4yVV447NW | HTTP 200 / expired | req_dNfAxGDzEjfNOv |
| INSPECTOR | 99 | HTTP 200 | req_rrUmihZ1tO4Xfg | HTTP 200 / expired | req_cAe7nq8Ri65ejw |
| FREE_REPORT | 0 | HTTP 200 / discount order 87 | Not applicable: no Stripe session by design | NOT RUN / no session to expire | Not applicable |
| QA_INVALID_20261113 | 199 | HTTP 200 | req_nNKCvevSju0pis | HTTP 200 / expired | req_EkEBKvtJUzfMm9 |

Actual last-credit race: C had exactly one credit; parallel different-report requests returned **200 and 409**, only report `qa-20261113-credit-1` unlocked, only order 90 created, balance became 0, repeat returned alreadyPaid. Existing A credits were not touched. Expired Stripe orders intentionally remain pending in app history; Stripe expiry is proven by the expiration response, not inferred from the order row.

## Repairs and proof

1. **Cross-account PDF download through editable pdfUrl.** A second QA account could copy another account’s storage path into its own draft and download the victim PDF (HTTP 200, matching SHA-256). The download route now validates the storage owner and rejects path traversal before signing. Six local authorization cases pass; fresh staging attacker 403 and real owner 200. Staging deployment `39aec344...`; source SHA-256 `6d3b349ca5c31fc78152a254729e46643875241c5fccd671134eeb0bc38c0130`.
2. **Literal names becoming email markup.** The real frontend email template now escapes dynamic report/property/party/room text and PDF URL attributes. Its six adversarial-string cases pass and input objects remain unchanged. Normal styled legacy email and server sanitization compatibility still pass. Prepared frontend only; installed old clients do not automatically receive it.
3. **Paid report from another device stuck at Loading your report.** The effect depended on its own loading/result state and cancelled the request when setting loading. It now only restarts for report/account changes. Fresh browser opened a cloud-only paid report, generated its real PDF, and an unknown ID reached the not-found state. Prepared frontend only.
4. **Shared offline cache leaking authenticated API responses.** Executed service-worker harness proved an offline second-account request could receive the prior account’s cached response. API and cross-origin signed-storage requests now bypass shared CacheStorage; cache version bumped to remove existing shared caches on activation. Regression passes. Prepared frontend only; device-specific draft storage isolation is not certified by this test.

After **each** repair: frontend and backend type checks, production frontend build and related tests passed. Current suites: 36 compatibility assertions, 33 safety assertions, 6 PDF authorization cases, 6 email-escaping cases and the service-worker isolation regression. Dummy-secret webhook tests invoke actual handlers over isolated SQLite: signed/duplicate/missing-report = 200; injected write failure = 500; signature/fallback behavior preserved. These are explicitly local tests, not live signed-webhook acceptance.

## Still broken, blocked or unverified — exact next steps

### Staging webhook — FAIL, configuration
Unsigned and wrong-signature requests returned **500 Webhook not configured**, not the requested 400; fresh deployed route probe also returns 500. Existing staging signing secret is missing. In Stripe test mode, configure the staging webhook endpoint for checkout completion/async success, then set its signing secret in YouBase staging as `SANDBOX_STRIPE_WEBHOOK_SECRET`. Set/verify `SANDBOX_STRIPE_SECRET_KEY` for the same test account so staging no longer falls back to live checkout. Re-run the two 400 checks plus signed test-mode events. **No secret was set or changed here**, per instruction; signature/fallback code was not modified.
### Account deletion — FAIL, auth identity removal unresolved
Disposable C DELETE returned **500** (CF-Ray `a59bdc4438558969-PDX`). Its app profile and unpaid draft credit-2 were removed, but auth identity remained and the authenticated session still worked until explicitly signed out. Paid report credit-1 and order 90 were retained. Local isolated deletion tests pass; the live failure occurs after app-data cleanup and needs platform diagnostics at auth identity removal. System schema inspection was blocked (`600114`; request ID `18e18eab-9676-46f7-b66b-92ee7744043d`); a QA-only auth cleanup attempt was rejected by the CLI destructive-operation guard before execution. No bypass was attempted. In YouBase → Users, inspect/delete only disposable C after confirming paid report/order retention; inspect worker logs for the deletion CF-Ray and resolve the supported auth deletion mechanism with support@youware.com. Do not re-run deletion against a real customer until it is atomic and verified. Exact underlying platform failure is **not proven**, so no speculative code/schema change was made.
### Admin A and release identity — NOT RUN
Use the already-held A account on staging and verify all required admin routes while normal/tester remain 403. A credentials/session were not present in this run; no replacement admin or bypass was created. Record the current production deployment revision before Update. The previous production revision could not be established here, so a certified production rollback is not available.
### Android permissions and free invoices — corrected test expectations
WRITE_EXTERNAL_STORAGE is limited to Android 9 and below (maxSdkVersion 28), and is actually used by Capacitor’s Directory.Documents export. It was **not removed as unused**. VersionCode 10, versionName 3.5, no cache backup domain, no gallery/notification permission, and environment-only signing passwords pass source checks. A tester order intentionally has no Stripe invoice (400), not a broken invoice purchase. Android native compilation/signing/install remain NOT RUN.
### Test-infrastructure failures, not app repairs
Concurrent QA processes initially wrote the same cookie jar, causing transient 401 on LAUNCH50 and one expiry. The QA client was fixed to avoid jar writes during app requests; fresh checkout/expiry passed and all six Stripe sessions are expired. Browser bridge lifetime and synthetic form submission initially caused verification failures; corrected real browser hash and PDF checks passed. Raw failures remain preserved and are not passed off as app defects.

## Tests requiring your real phone / inbox

- PDF: Download/Share/Print on the installed Android/iOS app; verify Arabic text, photos, pagination and opening in another viewer. A real desktop-browser-generated 1.09 MB PDF was uploaded/finalised/downloaded and its hash matched, but this does not establish native behavior.
- Camera: permission deny/allow, capture-only behavior, rotation, GPS, timestamps and three real photos.
- Drafts: offline edit, app termination/restart, reconnect, sync, account switch and photo restoration on the device.
- Inbox: actual recipient receipt, rendering, sender and attachment/link access. Provider accepted QA simulator sends; inbox delivery was not observed.
- Stripe return: external browser → installed app, cancelled checkout, paid return, foreground reconciliation; no real charge made here.
- Android: signed version 3.5/code 10 installation or Play internal track update, old-device documents permission, app links and existing local data migration. No signing secrets requested.

## What Update would deploy, and rollback

Do not click Update as if acceptance passed. Under the documented platform flow, Update promotes the currently staged backend plus the current frontend. If staging remains unchanged, this includes today’s PDF-owner check, the previously staged existing-admin/atomic-credit behavior, the two frontend repairs and service-worker cache isolation. It does **not** update native installed assets or configure missing secrets. We cannot certify the whole diff against the unknown previous production revision. No production promotion was performed.

Local rollback (not executed): use `qa/full-2026-11-13/rollback-local.py --confirm-local-rollback` to verify archive hash and restore only changed app source plus backend bundle; then re-run type checks, build and related tests. A staging rollback needs the same guarded CLI 0.0.12 dry run/deploy, stopping on any schema change. This restores known earlier vulnerabilities and is **not a safe production recommendation**. For production rollback, first record/select the previous known-good deployment in platform History and confirm its identity; that revision was unavailable here. Never roll back or delete financial records. QA cleanup is separate from app rollback.

## Every shared QA record created

| Account | ID | Final state |
|---|---|---|
| N — QA Test | DHlXy1QGQ9N4bNUz84yyUNRWbKCetxry | Retained; signed out |
| B — QA Test | I9x4jTX29wRiTIum0mYmjbSEzLfXQZX2 | Retained; signed out |
| T — QA Test | ngpPitm0v8x6HZJEtcCNiCz9BqBD7ZcS | Retained; temporary tester role restored to 0; signed out |
| C — QA Test | auHg2A9v5OQElcJJkvIy6gjLTmlTqiQB | Auth identity retained; app profile removed by failed deletion; signed out |

All four auth identities and three surviving app profiles were created by this run. C alone received one test credit; T alone temporarily received tester=1. Existing supplied A and customer roles/credits untouched. Ordinary platform-created auth session/internal metadata IDs are not exposed; all four sessions were explicitly signed out (200) and later profile calls returned 401.

| Inspection | Final state |
|---|---|
| qa-20261113-pay-normal | Retained |
| qa-20261113-pay-welcome20 | Retained |
| qa-20261113-main | Retained |
| qa-20261113-pay-launch50 | Retained |
| qa-20261113-pay-meinspect10 | Retained |
| qa-20261113-empty | Deleted only by QA test/cleanup or C account deletion |
| qa-20261113-pay-inspector | Retained |
| qa-20261113-pay-free | Retained |
| qa-20261113-pay-invalid | Retained |
| qa-20261113-tester | Retained |
| qa-20261113-credit-1 | Retained |
| qa-20261113-credit-2 | Deleted only by QA test/cleanup or C account deletion |
| qa-20261113-email | Deleted only by QA test/cleanup or C account deletion |
| qa-20261113-final | Retained |
| qa-20261113-pdf-access-probe | Deleted only by QA test/cleanup or C account deletion |

**Orders:** 83, 84, 85, 86, 87, 88, 89, 90, 91, 92 — all retained. Six Stripe orders are uncharged, sessions expired; free/tester/credit orders are zero amount. **Payments table:** no rows intentionally created or deleted. No orders or payments were deleted.

**Photo manifests and objects:** `qa-20261113-photo1`, `qa-20261113-photo2`, `qa-20261113-photo3`, all retained under owner N’s `qa-20261113-main/room1/item1` storage prefix. Each binary upload, confirm and hash-compare download passed.

**PDF verification:** `qa-20261113-final-0ea7f42773d3c245`, retained. Final PDF SHA-256 `da61a14eb25390d26ca09a0c874a1309f1bd7872cf2976abe6861b4acc24b20f`. One staged-upload PDF and immutable final copy were created; final-copy path is in `browser-finalise.json`. Upload object UUID was not captured before signing URLs were discarded; its exact path is NOT KNOWN, but owner/report prefix and upload count are known. One reference PDF under N’s main inspection was also created and retained (exact path in `ledger.jsonl`). Do not bulk-delete any prefix containing financial/finalised reports.

**Email quota rows:** 30 retained records, 31 reserved recipients: B’s 29 rows reserve 30 recipients, N’s browser-send row reserves 1. Other free-unlock notifications are outside this counter and their provider IDs were not returned by checkout. The anonymous auth email may be nondeliverable; no real recipient was invented. Explicit test recipient was the provider simulator `delivered@resend.dev`.
- 0c5666f2-c495-4b80-a74e-be953fc2a9e1
- 41c892e4-29f0-4672-8b01-62e471a3512f
- a003b1a0-7e69-4360-9ce6-b06d906ba5b0
- c4a15531-bacf-4525-bea4-ab0d46c75aab
- 385e7a74-44ce-4ab1-aa3e-a125b9b46573
- 6c2db769-8e9c-4fa3-8721-3df8814a0963
- 988a0e08-0a3c-4b57-8c58-12170988b110
- 16352a7a-a077-481a-8e46-d2eba296d6c7
- 68be1618-a8f3-447d-8ce7-035d74b83cba
- 7a7d887c-1cf3-45bb-aacd-ccc88b769d00
- d9d5a9ad-6c73-4a92-87e4-1a6823e923c9
- e8956136-f9bd-4aef-8e95-4270fd4976ac
- 45901fa6-c5a9-4538-9027-ce1de533bfb7
- ac400940-ddcf-41d1-a28d-b2cd79ba9a9c
- 4ee3948c-b3c8-4c49-955a-18e9bb7ccd74
- a9d1ca13-6191-4664-8000-0d1ab36c907d
- a7aaf9f9-223d-4255-960a-90e74ad55145
- 655c91a2-9cbf-456a-9693-bca0cfe75363
- 1f294c76-acc5-4d62-8cfd-226c2fca4c14
- f508dfc0-2cab-47dd-ae72-aaed4b1c84c6
- a8bc93dc-84e2-4d05-abfd-a033f11e956b
- 0dae21ef-4509-460f-9093-0baa45ea7615
- bb3c7bb1-53b7-44d2-9dff-7a7dc7537c9a
- bb17e077-37e3-4370-8fd5-fc5f2049ab12
- 8eea5fcf-b15d-4ad7-b0c5-a74a1861d3f5
- 128c2afd-42fa-4cff-b976-7613f29474e3
- e01b504e-f021-42ef-8c99-f49f0ad0e1d4
- afbc81df-0ac0-4982-b12e-d9ffc63fc0a8
- f6f53e92-b70d-4b58-af67-9a84e30877d4
- f6b38fd9-4584-4d11-8d60-b4f4aaa839bd

**Local-only fixtures:** the SQLite suites create/destroy isolated in-memory fixtures, not shared records. Exact fixture operations are in `local-compatibility-operations.json` and `local-safety-results.json`; local orders/payments were not issued to Stripe. QA screenshots, downloaded PDF, logs, restore archive and test helpers are local artifacts. Private cookie/state files were removed after sign-out; no secret values appear in this report.

## Evidence index

All fresh evidence: `qa/full-2026-11-13/`. Detailed results: `results.jsonl`; all route gates: `route-matrix.json`; starting archive manifest: `restore-manifest.json`; release guard: `staging-check.json`; protected invariants: `final-invariants.json`; actual prices and expiry: `pay-*-checkout/expire*.json`; record ledger: `ledger.jsonl`; verification/browser evidence clearly named. Earlier dates were used only to reuse test helpers, not as current acceptance proof.

Final staging receipt: the identical tested bundle was re-deployed as `a8a177e4...` because platform completion did not recognize the guarded deployment. CLI 0.0.12 again reported Schema up to date (no changes); all 11 protected schema files and the tested bundle remained byte-identical. No publication occurred.
