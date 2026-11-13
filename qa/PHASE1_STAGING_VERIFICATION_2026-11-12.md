# STAGING deployment and verification — 12 November 2026

## Decision: STAGED, NOT READY FOR UPDATE

The requested candidate variant deployed successfully to **STAGING**, but A's staging admin checks **FAILED** the requested 403 expectation: both returned **200**. The supplied account has `is_admin=1`, and the saved candidate deliberately grants access to existing admins. No role or additional application changes were made to force these tests to pass. The first failure was reported immediately, with rollback guidance, before continuing the other independent checks.

Only the supplied account was used as A. No T account was supplied; all T-specific checks are **NOT RUN**, not substituted with A. No questions, forms, new accounts or secret requests were made. **Nothing was published or promoted to production.**

Fresh live requests ran on 12 November 2026, approximately 09:38–09:42 UTC. Application request-ID headers were absent; the request references below are actual **CF-Ray edge request IDs**, not invented application IDs. PASS means the named check actually executed; local, replay and API-only scopes are explicitly distinguished from browser/device acceptance.

## Report: item | result | evidence

| Item | Result | Evidence |
|---|---|---|
| Candidate activated with only requested fallback exception | PASS | Active source equals saved candidate except pre-run webhook block and fallback source type; full webhook block, validation and logging byte-identical to pre-run source |
| Local compatibility suite | PASS | 36/36 actual bundled-handler assertions, isolated SQLite and mocked email provider; rerun after deployment, not live acceptance |
| Local safety/fallback suite | PASS | 33/33 actual bundled-handler assertions, isolated SQLite, dummy signatures and mocked Stripe event retrieval; includes authoritative event-only processing, every fallback logged, delayed write before 200, write failure 500 |
| Frontend/backend typechecks; frontend production build | PASS | Both typechecks exit 0; frontend build exit 0; no frontend source changes |
| Pinned CLI dry run | PASS | Executed 0.0.12; exit 0; output: `Schema up to date (no changes)`; all 11 protected schema/generated/migration files byte-identical to restore; 50 routes valid |
| Pinned CLI STAGING deployment | PASS | Executed 0.0.12; exit 0; output: `Schema up to date (no changes)`; all 11 protected schema/generated/migration files byte-identical to restore; 50 routes valid |
| STAGING — A sign-in | PASS | HTTP 200 (expected 200); CF-Ray `a594908b0cb3c146-PDX`. Authenticated user confirmed; session cookie retained for subsequent calls, then signed out |
| STAGING — A GET /api/admin/prices | FAIL | HTTP 200 (expected 403); CF-Ray `a59490b8ba4612b1-PDX`.  |
| STAGING — A POST /api/admin/set-tester | FAIL | HTTP 200 (expected 403); CF-Ray `a59492b4dceb5ec3-PDX`. Nonexistent target address, isTester=false; no account role changed |
| STAGING — T admin prices / set-tester | NOT RUN | No T identity or credentials supplied; did not create an account or turn A into a tester |
| STAGING — A deletes paid QA inspection | PASS | HTTP 409 (expected 409); CF-Ray `a594932679d9a096-PDX`. Fresh QA-only paid marker, amount 0; no card charge or real paid order fabricated |
| STAGING — A deletes fresh QA draft | PASS | HTTP 200 (expected 200); CF-Ray `a59493280d4f4b01-PDX`. Subsequent GET 404 confirms removal |
| STAGING — Old-format captured Email Report request replay | PASS | HTTP 200 (expected 200); CF-Ray `a594932a8c82c895-PDX`. Real provider accepted 1 email to approved address; provider ID `01a1cf21-390e-7ab3-9884-c04749f544aa`; historical Nov 10 captured request replay, not a fresh live UI capture |
| STAGING — Fresh live Email Report modal capture / PDF-link validity | NOT RUN | No browser/device modal flow executed; historical captured request includes a previously signed PDF link whose current validity was not verified |
| STAGING — {inspectionId} email format | PASS | HTTP 200 (expected 200); CF-Ray `a59493301d9011c8-PDX`. Real provider accepted 1 email to approved address; provider ID `01a1cf21-3b13-7b72-9e34-9f04980db421` |
| STAGING — Inbox delivery | NOT RUN | Provider accepted sending; inbox not inspected |
| STAGING — Old inspection opens via authenticated API | PASS | HTTP 200 (expected 200); CF-Ray `a59492b78a435f03-PDX`. mvuxjr15recovery1 returned completed and paid; no modification |
| STAGING — Old inspection browser rendering / all photos | NOT RUN | API readability does not prove browser rendering or missing-photo recovery |
| STAGING — T tester free checkout | NOT RUN | No T credentials; A remains non-tester with 20 credits. No checkout, credit debit or role provisioning performed |
| STAGING — QA session signed out | PASS | HTTP 200 (expected 200); CF-Ray `a5949589080558c2-PDX`. Private session cookies removed afterward |
| PRODUCTION — A sign-in | PASS | HTTP 200 (expected 200); CF-Ray `a59493657c6eefb8-PDX`. Authenticated user confirmed; session cookie retained for subsequent calls, then signed out |
| PRODUCTION — A GET /api/admin/prices | PASS | HTTP 403 (expected 403); CF-Ray `a594936b7df0ef10-PDX`.  |
| PRODUCTION — A POST /api/admin/set-tester | PASS | HTTP 403 (expected 403); CF-Ray `a5949390dcc8d82e-PDX`. Nonexistent target address, isTester=false; no account role changed |
| PRODUCTION — T admin prices / set-tester | NOT RUN | No T identity or credentials supplied; did not create an account or turn A into a tester |
| PRODUCTION — A deletes paid QA inspection | PASS | HTTP 409 (expected 409); CF-Ray `a59493fe88ea9b30-PDX`. Fresh QA-only paid marker, amount 0; no card charge or real paid order fabricated |
| PRODUCTION — A deletes fresh QA draft | PASS | HTTP 200 (expected 200); CF-Ray `a59494335cca5ed2-PDX`. Subsequent GET 404 confirms removal |
| PRODUCTION — Old-format captured Email Report request replay | PASS | HTTP 200 (expected 200); CF-Ray `a5949435ed581fb9-PDX`. Real provider accepted 1 email to approved address; provider ID `01a1cf21-e0dd-7754-9151-ee40dfe5c9a3`; historical Nov 10 captured request replay, not a fresh live UI capture |
| PRODUCTION — Fresh live Email Report modal capture / PDF-link validity | NOT RUN | No browser/device modal flow executed; historical captured request includes a previously signed PDF link whose current validity was not verified |
| PRODUCTION — {inspectionId} email format | PASS | HTTP 200 (expected 200); CF-Ray `a594943ca990fef6-PDX`. Real provider accepted 1 email to approved address; provider ID `01a1cf21-e2f0-7712-a65f-95903ae3dca4` |
| PRODUCTION — Inbox delivery | NOT RUN | Provider accepted sending; inbox not inspected |
| PRODUCTION — Old inspection opens via authenticated API | PASS | HTTP 200 (expected 200); CF-Ray `a59493929bc85ec6-PDX`. mvuxjr15recovery1 returned completed and paid; no modification |
| PRODUCTION — Old inspection browser rendering / all photos | NOT RUN | API readability does not prove browser rendering or missing-photo recovery |
| PRODUCTION — T tester free checkout | NOT RUN | No T credentials; A remains non-tester with 20 credits. No checkout, credit debit or role provisioning performed |
| PRODUCTION — QA session signed out | PASS | HTTP 200 (expected 200); CF-Ray `a594958b8fc428b9-PDX`. Private session cookies removed afterward |
| STAGING — Stripe webhook | NOT RUN | Skipped as instructed: staging has no signing secret |
| PRODUCTION — Stripe webhook without signature | PASS | HTTP 400 (expected 400); CF-Ray `a59494660e74d82e-PDX`. Body deliberately has no valid evt_ ID; does not exercise event-retrieval fallback |
| PRODUCTION — Stripe webhook with wrong signature | PASS | HTTP 400 (expected 400); CF-Ray `a59494677e734e7c-PDX`. Body deliberately has no valid evt_ ID; does not prove every unsigned valid Stripe event is rejected |
| Production verification of newly staged candidate | NOT RUN | User has not clicked Update during this run. Real production checks above exercised the already-published backend, not the newly staged candidate |
| Schema/lockfiles/config/frontend final invariant | PASS | 85 protected files byte-identical to pre-run restore; 11 schema/generated/migration files also byte-identical to Nov 11 archive; active source and bundle still match staged hashes |

## Exact deployment output excerpts

Both commands executed the installed, verified **0.0.12** CLI without modifying it. Full sanitized output is retained with this report. No production deployment command ran.

Dry run:

```text
✔ Schema up to date (no changes)
✔ Type check passed
✔ Build completed
✔ Bundle valid (1.20MB)
✔ Routes valid (50 routes)
✔ Dry run complete
Schema files byte-identical to restore: true (11 files)
Exit code: 0
```

Staging deployment:

```text
✔ Schema up to date (no changes)
✔ Type check passed
✔ Build completed
✔ Bundle valid (1.20MB)
✔ Routes valid (50 routes)
✔ Deployment prepared (1ce7acf2...)
✔ Bundle uploaded
✔ Deployed successfully to staging
Schema files byte-identical to restore: true (11 files)
Exit code: 0
```

No schema-file changes, DDL, migration, schema push, secret edits or package-version changes occurred. No schema changes were reported. The CLI's unchanged-schema pull was allowed by the revised rule; both post-command byte checks passed, as did the final check against the November 11 restore.

## What Update will deploy and replace

Under the platform's documented publication behavior, **Update publishes the current frontend and promotes the backend currently staged**. This run did stage the requested candidate variant successfully, and the active backend source/bundle still match the deployed artifacts. Therefore, if staging remains unchanged before Update, **the backend promoted to production will be this staged candidate variant**, replacing the currently published backend for all routes, not just the repaired routes.

The frontend source was not edited; its current production build is included in publication. Update replaces the published web assets, not installed Android/iOS binaries. The staged backend differs from this run's starting source in the saved candidate's admin, atomic-credit and signed-missing-report handling, while preserving the exact pre-run webhook retrieval fallback and logs. Existing dual-format email and paid-delete protection remain intact. There is no queued schema migration or secret change from this run.

**Important observed replacement difference:** the current production backend denied A admin access (403/403), while the staged candidate granted it (200/200). Updating would introduce that candidate's intentional existing-admin behavior, which conflicts with the requested expected results. Do not Update based on this report as an acceptance pass.

The platform's internal Update CLI execution and exact previous production revision are not exposed here. This is a documented promotion guarantee conditional on unchanged staging, not an already-executed publication or verified previous-production-bundle diff. Current production test passes cannot certify the candidate after Update; that verification remains NOT RUN.

Staged identity:

- Deployment reference shown by CLI: `1ce7acf2...` (CLI displays only a prefix; full ID unavailable).
- Backend source SHA-256: `aa395ac676824dd499edc42cd8e8fc355ae9a326322dbd9cd6f72a7a3c5304e2`.
- Backend bundle SHA-256: `0671f15dc119a9c36c55650a7b09ced267275a16ce225b179965222e0955e6f6`.

## Rollback steps — not executed

### Before Update: local/staging undo

1. Do not click Update. Production needs no deployment rollback because this run did not publish.
2. Verify restore archive `restore-points/phase1-before-2026-11-12.tar.gz` has SHA-256 `6af07edb989c53b8e909810a8babb9c6d36e8fdc59c4ded3b9b79c59d4394c44`.
3. Restore only `backend/src/index.ts` and `backend/dist/bundle.js` from that archive; verify both against the saved restore manifest. The included `rollback-local.py` performs only that local restoration, with checksum checks and no network/database action.
4. To also undo staging, run the unchanged pinned 0.0.12 dry run and staging deployment against the restored backend. After EACH command require the exact `Schema up to date (no changes)` output and byte-identical schema-file checks; stop immediately on any reported/file change. Do not promote or publish.
5. Recheck the restored staging behavior. This restores the **starting local backend**, not a certified previous staging deployment revision; it also removes the candidate's atomic-credit improvements. A rollback was not silently performed because the requested candidate was to remain staged for review.

### If Update is clicked later

Use platform History to select the release published immediately before that Update; verify that its matching frontend and backend are both restored, then have the user click Update to republish that matching pair and repeat real checks. The exact prior production revision and whether History restores both artifacts cannot be independently certified here, so this is **NOT a tested one-click rollback**. Do not treat the local starting archive as a verified production backup. Do not restore the shared database, delete payment/order history, change secrets, or use CLI promote as a workaround.

## Shared QA record ledger — every created application record

Only four QA inspections and four email-rate records were created. The staging/production inspection table is shared; environment in the names identifies which endpoint created/tested them, not physical database isolation.

| Record | Created through | Final state |
|---|---|---|
| `qa-20261112-staging-draft` | Staging API, 201; CF-Ray `a59492b95a239694-PDX` | Deleted by QA DELETE 200; GET 404 |
| `qa-20261112-staging-paid` | Staging API, 201; CF-Ray `a59492bb7bb2495f-PDX` | Retained; QA-only payment marker set to paid with amount 0 using one narrowly scoped UPDATE; DELETE rejected 409 |
| `qa-20261112-production-draft` | Production API, 201; CF-Ray `a59493948df4a509-PDX` | Deleted by QA DELETE 200; GET 404 |
| `qa-20261112-production-paid` | Production API, 201; CF-Ray `a5949396fd9c613d-PDX` | Retained; QA-only payment marker set to paid with amount 0 using one narrowly scoped UPDATE; DELETE rejected 409 |
| Email event `9298c755-c452-4bd4-9b48-2b93e057298d` | Staging legacy replay | Retained; empty inspection ID, recipient_count 1 |
| Email event `ef19bef9-d932-497c-b1f2-67ef6868e17c` | Staging new format | Retained; staging paid QA inspection, recipient_count 1 |
| Email event `d184e0c3-255f-406f-b395-4608d0367fb8` | Production legacy replay | Retained; empty inspection ID, recipient_count 1 |
| Email event `109b0e2e-7d33-4c92-8a34-49482e93fe10` | Production new format | Retained; production paid QA inspection, recipient_count 1 |

Two auth sessions were created by the required sign-ins, used through private cookie jars, and successfully signed out (200/200); session identifiers were deliberately neither retained nor printed. Authentication may update its normal login metadata. No account was created, no tester/admin role changed, no credit consumed (A remains at 20), and no order, payment, card charge, photo or PDF object was created. The existing old inspection and historical email-report inspection were only read/referenced, not modified. Four emails were accepted by the real provider to the approved address; their provider IDs are listed in the result table. Inbox delivery was not checked.

## Isolated local QA records

These are in-memory SQLite fixtures only, not staging/production rows. The compatibility fixture operation ledger records each SQL mutation and generated email-event ID. The safety fixture ledger enumerates every user, inspection and order created; temporary credit-user rows are explicitly removed and each in-memory database is discarded at the end of the suite. No production financial history was deleted. Fresh evidence includes both complete local ledgers and the 36/33 assertion output.

## Stop

Candidate remains staged, with no further application edits after deployment. **No Update/publication action was taken.** Acceptance remains blocked by the two staging admin mismatches and the explicitly unrun T/browser/post-Update checks.
