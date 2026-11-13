# Production QA continuation — 4 November 2026

## Verdict and scope

**FAIL — production does not have the reviewed staging protections.** This is an incomplete acceptance run, not an all-pass report. HTTP evidence was collected approximately 07:52–07:57 UTC. Authentication used the supplied email/password and a retained session cookie; no browser was used. No application logic, dependencies, schema, or production deployment was changed. No card was charged.

The initial Python HTTP client was rejected by the edge with HTTP 403 / error 1010. Those responses are NOT application authorization passes. Curl subsequently authenticated successfully with HTTP 200 and retrieved A's profile with HTTP 200.

A started with 21 credits and ended with 20 after one explicitly requested credit checkout. Its repeat returned alreadyPaid without consuming another credit. No balance reset or bulk credit consumption was performed. T was temporarily provisioned through the production set-tester route for the requested tester tests and then revoked. This also demonstrates the production authorization defect; no unrelated account was changed.

## 1. Production versus staging

| Item | Where it ran | Result | Evidence |
|---|---|---|---|
| Tester is not admin | Production | **FAIL** | T was confirmed isTester=1, then GET /api/admin/prices returned 200 (a5520e412d0a9bf9-PDX); T POST /api/admin/set-tester returned 200 (a5520e42c879121f-PDX), not 403. |
| Normal user is not admin | Production | **FAIL** | A isTester=0. GET /api/admin/prices 200 (a5520d300cb4147f-PDX); POST set-tester with A's unchanged false value 200 (a5520d2e29978e6c-PDX). /api/admin/access is missing, 404, not proof of an authorization guard. |
| Admin separation | Staging | **PASS for A only** | GET /api/admin/access 403 (a5520c318a115ee0-PDX); POST set-tester 403 (a5520c33fb88efb4-PDX). T on staging not executed. Current source uses ADMIN_USER_IDS, not tester status or users.is_admin. |
| Paid/completed deletion returns 409 | Production | **FAIL** | A's paid QA row DELETE 200 (a5520df8f9c1c146-PDX); completed/reportGenerated marker row DELETE 200 (a5520d392ef7fdb1-PDX), subsequent GET 404. The latter is a completed-state test, not a registered-PDF finalisation test. |
| Completed deletion returns 409 | Staging | **PASS for completed marker** | DELETE staging guard row 409 (a552106b4c96d106-PDX). Registered-PDF and separate paid staging cases not run. |
| Email accepts only inspectionId | Production | **FAIL / old contract live** | inspectionId-only POST 400: "to, subject, and html are required" (a5520b442e76ccd1-PDX). |
| Email accepts only inspectionId | Staging | **PASS** | Extra html field rejected 400 (a5520c32cc11c4ac-PDX). Valid owned inspectionId-only request sent one email, 200. |
| 30-recipient rolling-hour cap | Staging source / prior local regression | **PRESENT, live boundary NOT RUN** | Current source reserves recipients and rejects used >30. No 31-message real HTTP boundary test performed. Production cap cannot be established from the old contract; do not claim it is 30. |
| Production API default | Production web + local source | **PASS for fetched main bundle** | Live main bundle fetched 200: one production API base occurrence, zero staging-- occurrences. Local client has production fallback. |
| Android files | Local repository | **SOURCE ONLY / release NOT VERIFIED** | versionCode 10 / versionName 3.5. Native source exists, but copied Android web JavaScript assets are absent in this restored workspace. Prior report's sync is historical evidence only. No APK/AAB, installed-device, or Play Store release verification. Android files are not made live by a web/backend deployment. |

Staging and production share the database: staging GET of the newly production-created main inspection returned 200 (a5521067ffe31319-PDX), and the database read found that exact ID. Storage and payment environment distinctions still matter; shared rows do not prove shared binaries or deployed behavior.

## 2–8. Executed matrix and remaining gaps

| Item | Where it ran | Result | Evidence |
|---|---|---|---|
| A sign-in and session | Production auth API | **PASS** | Curl sign-in 200; authenticated profile 200, a5520b408ac47b78-PDX. |
| Create rooms, conditions, signatures and notes | Production | **PASS for persistence** | Main inspection POST 201, a5520d037fe8fdb1-PDX; PUT 200, a5520d1c98ee1d57-PDX; GET 200, a5520d1ecf350384-PDX. One room, two rated-condition items, three synthetic signature images, 5,000-character general note. Not touch-signature/camera testing. |
| Three photos | Production API and object storage | **PASS for upload/confirmation/manifest** | Three distinct synthetic PNG files, each binary PUT 200; confirmation 200: a5520d0a2d319b30-PDX, a5520d113cc6efc2-PDX, a5520d1a0b814598-PDX. Manifest GET 200, a5520d1ffbcc5ee6-PDX. All three files were subsequently downloaded with HTTP 200 and matched their uploaded SHA-256 hashes; manifest count=3, persisted signature count=3, note length=5000. Actual camera photos were not claimed. |
| Finalise, fetch PDF, images of every page, visible page-1 text, PDF photo count, no unavailable photos | Not executed | **BLOCKED** | App creates the PDF client-side using DOM layout, canvas, Image and computed geometry. The HTTP backend registers an uploaded PDF; it does not generate this report. Uploading a separately fabricated PDF would not validate the app renderer. No sample PDF substituted and no page pictures claimed. Main inspection remains draft. |
| Real Email Report | Staging API using shared QA row | **PASS for provider acceptance only; finalised-report flow NOT RUN** | 200 at 2026-11-04 07:57:03 UTC; recipient aalekh.dxb@gmail.com; send ID 01a1a58f-bf0c-71a8-b331-14e76a2a399f; a55210cfd906a11a-PDX. sentCount=1, failedCount=0. Inbox delivery/opening not verified. It was allowed for a draft, not a finalised report. No production-contract send was substituted. |
| B reads A inspection | Production | **PASS** | 404, a5520d264f9ea096-PDX. |
| B requests A photo URL / photo manifest | Production | **PASS** | Photo URL 403, a5520d28a90cc36d-PDX; manifest 404, a5520d29aeaeff0f-PDX. |
| B deletes A inspection | Production | **PASS** | 404, a5520d2afc1dc62a-PDX; A's row retained. |
| B requests A PDF | Production | **PARTIAL** | 404, a5520d278867b876-PDX, but A has no registered PDF. Repeat with an existing final PDF is still required. |
| B deletes photo/PDF | Production | **NOT AN AUTHORIZATION PASS** | Both attempted DELETE URLs returned generic route-not-found 404 (a5520d2c3f60ff03-PDX, a5520d2d3b7baee3-PDX). No dedicated delete routes were found. Does not establish an existing-resource deletion guard. |
| Draft deletion | Production | **PASS** | Create 201, DELETE 200 (a5520d33adff5ee4-PDX), GET 404 (a5520d35da10f896-PDX). |
| Paid deletion | Production | **FAIL** | Credit checkout made row paid; DELETE nevertheless 200. Order 77 survives while inspection was deleted. |
| A Stripe creation + request ID + expiry | Not executed | **BLOCKED** | A has 20 remaining credits and checkout automatically consumes credits before Stripe. No bypass flag exists. No unauthorized balance reset; no Stripe creation/expiry/request ID claimed. |
| T free checkout | Production | **PASS** | 200, a5520e476faec36d-PDX; order 78; tester_1793778919666_j3zqx18go4; provider tester. Tester flag subsequently revoked, 200 (a5520e4abd68b18c-PDX). |
| A credit used once; repeat same report | Production | **PASS** | 200, order 77, credit_1793778905982_lhcts2xywmf (a5520df1a9215939-PDX). Repeat 200/alreadyPaid=true (a5520df65dc369d4-PDX). Balance 21 → 20. |
| Parallel requests on final credit | Not executed | **BLOCKED / source risk** | No account A state with exactly one credit. Current source reads balance then writes balance-1 without a conditional atomic claim, so race safety is not established. No runtime race result claimed. |
| All five discounts plus invalid | Source/read-only DB only | **NOT RUN as checkout** | A's remaining credits take precedence over discounts. Calculated values below are not observed Stripe prices and not PASS. |
| Hostile strings, Arabic, emoji, long note | Production persistence | **PASS for round-trip only** | Script string in building/room notes; img/onerror string in tenant/item notes; JSON __proto__ text in landlord/item notes; Arabic/emoji in area/room; exactly 5,000 N characters in generalNotes. These are strings, not an executed prototype-pollution test. |
| PDF escaping and email HTML escaping | Source review only / no PDF | **NOT END-TO-END VERIFIED** | Staging template uses escapeEmailText for property text; real send accepted, but provider-stored HTML was not retrieved. PDF renderer not executed. Do not equate stored literal payloads with demonstrated safe rendering. |

### Discounts (configured, not runtime prices)

| Code | Database configuration | Current source computed AED | Checkout / expiry |
|---|---|---:|---|
| WELCOME20 | active, percent 20 | 159 | NOT RUN |
| LAUNCH50 | active, fixed 50 | 149 | NOT RUN |
| MEINSPECT10 | active, percent 10 | 179 | NOT RUN |
| INSPECTOR | active, fixed 100 | 99 | NOT RUN |
| FREE_REPORT | active, percent 100 | 0 | NOT RUN; source bypasses Stripe for zero, so no Stripe session to expire |
| Invalid code | no match | 199 | NOT RUN; source silently retains base price |

Percentage discount rounds to whole AED in current source, hence 159 rather than 159.20 and 179 rather than 179.10.

## Production/shared-database leftovers

Read-only database queries confirmed these tables exist. Source references were compared against backend/src/index.ts; generated declarations alone do not count as application use. This is an inventory, not permission to remove data.

| Unused table | Rows observed | Notes |
|---|---:|---|
| parties | 0 | JSON inspection fields are used instead |
| tenancy_details | 0 | JSON inspection fields are used instead |
| property_details | 0 | JSON inspection fields are used instead |
| rooms | 0 | rooms_data JSON is used instead |
| items | 0 | nested rooms_data/property_items JSON |
| photos | 0 | inspection_photo_backups and nested JSON used instead |
| signatures | 0 | inspections.signatures JSON used instead |
| payments | 0 | orders and inspections.payment_data used instead |
| report_access | 0 | No current reference |
| credit_ledger | 1 | Old data, not used by current credit route |
| credit_tokens | 6 | Old data, not used by current credit route |
| report_unlocks | 1 | Old data, not used by current unlock route |
| payment_webhook_events | 0 | No current reference |
| payment_failures | 0 | No current reference |
| discount_codes | 5 | Current checkout uses a hard-coded map, not this table |
| discount_code_uses | 0 | Current checkout does not record usage here |
| api_rate_limits | 0 | Current email route instead uses email_send_events |

Unused application-specific columns: users.password_hash (11 nonempty rows; built-in auth used instead); users.is_admin (one true row; source admin gate uses ADMIN_USER_IDS); users.deleted_at (0 populated); inspections.share_token (1 populated), share_revoked_at (0), deleted_at (0); orders.price_id (0 populated), orders.metadata (1 populated, not explicitly consumed by current logic). Whole-row selects may expose these columns without semantically using them.

Do not classify platform-managed auth tables as leftovers. user_profiles is referenced during account deletion, even though profile reads/writes use users; payment_prices has admin routes despite checkout not reading it; email_send_events is active in staging and has one event after this send. Existing row data in unused tables must be reviewed before cleanup.

## 9. Read-only dependency triage

Scope: the saved npm audit's **24 package-level entries** (3 critical + 21 high), not 24 unique advisories. No dependency update or exploit attempt was made. Versions below are from package-lock.json, which has drift from package.json (notably EdgeSpark CLI). Fix targets are derived from the saved advisory ranges, not a claim that upgrading the top-level package alone clears every transitive path. Managed auth-server version is not established by the frontend lockfile.

| Package | Severity / locked version | App or tooling | Exploitable in current use? | Fix target / qualification |
|---|---|---|---|---|
| better-auth | critical / 1.6.22 | Client portions in app; server managed externally | **Unsure** — OAuth server configuration/version unavailable; frontend dependency does not prove server vulnerable | 1.7.7; separately verify managed server |
| dompurify | critical / 3.4.11 | Optional PDF HTML dependency in app distribution | **No identified path** for listed hooks/IN_PLACE/XML modes; current vector renderer does not call them | 3.4.17 |
| tar | critical / 6.2.1, 7.5.19 | Native/deployment tooling only | **Unsure** if hostile archives enter build; not remotely exposed in app | 7.5.21; replace all older nested copies compatibly |
| @capacitor/assets | high / 3.0.5 | Icon tooling only | **No identified app path**; depends on vulnerable image/archive tools | Audit proposes 4.0.0 but range is '*'; no verified clean parent version. Patch sharp/tar chain and re-audit |
| @capacitor/cli | high / 5.7.8, 8.5.3 | Native tooling only, despite dependencies placement | **No identified app path**; hostile build inputs remain a supply-chain concern | No verified clean parent version; audit's 2.5.0 downgrade is not a safe project recommendation; fix tar/minimatch chain |
| @edgespark/cli | high / 0.0.22 in npm lock | Deployment tooling only | **No identified production route**; emulator dependencies implicated | No verified clean parent version; audit suggests 0.0.15 downgrade, not recommended blindly; patch miniflare dependencies |
| @remix-run/router | high / 1.23.0 | App runtime | **Unsure** — unsafe redirect data paths require runtime confirmation | 1.23.3 for its own entries, plus parent router fixes |
| @xmldom/xmldom | high / 0.9.10 | XML/native build tooling | **No identified app path** — no user-provided XML ingestion | 0.9.12 |
| brace-expansion | high / 2.0.2, 5.0.6 | Glob/build tooling | **No identified app path** — patterns not supplied by app users | 2.1.7 and 5.0.12 respectively |
| browserslist | high / 4.25.1 | CSS/build tooling | **No identified app path** — fixed build configuration | 4.28.7 |
| follow-redirects | high / 1.16.1 | Node/tooling HTTP dependency | **No identified app path** using cross-realm sensitiveHeaders arrays | 1.16.2 |
| miniflare | high / 4.20260730.0 | Local worker emulator only | **Unsure** for emulator input; not deployed worker code | No independently verified clean parent version; update sharp >=0.35.5 and undici >=7.30.1 within compatible parent |
| minimatch | high / 8.0.7, 9.0.5, 10.2.5 | Build glob tooling | **No identified app path** — untrusted glob input absent | 11.0.1 for all listed ranges; compatibility review required |
| nanoid | high / 3.3.11 | Transitive package; production reachability not established | **No identified path** — no user-controlled generator sizes found | 3.3.18 |
| picomatch | high / 2.3.1, 4.0.3 | Build tooling | **No identified app path** — not accepting user globs | 2.3.2 / 4.0.4 |
| postcss | high / 8.5.6 | CSS build tooling | **No identified app path** — no uploaded CSS pipeline | 8.5.23 |
| react-router | high / 6.30.1 | App runtime | **Unsure** — returnTo filter blocks // but allows slash-backslash inputs into navigate; actual router/browser handling was not executed here. SSR hydration issue not applicable to this SPA | 7.18.0 per saved backslash advisory; 6.30.4 only fixes narrower issues; migration/backport decision needed |
| react-router-dom | high / 6.30.1 | App runtime | **Unsure**, same potential redirect path via react-router; no runtime exploit claimed | Compatible parent release containing patched router; 7.18.0 for full listed router fix, not merely 6.30.4 |
| rollup | high / 4.44.1 | Bundler only | **No identified app path** — no untrusted build output paths | 4.59.0 |
| sharp | high / 0.32.6, 0.35.2 | Icon/image tooling, not browser runtime | **Unsure** — malformed image input can reach tooling if supplied; no exploit tested | 0.35.5, including nested versions |
| source-map-js | high / 1.2.1 | Build/source-map tooling | **No identified app path** — no untrusted source-map service | 1.2.2 |
| undici | high / 7.28.0 | Emulator/deployment tooling | **Unsure** for tooling/network input; no app backend import | 7.30.1 |
| vite | high / 7.3.6 | Dev/build server only; production serves static assets | **No identified production path** — dev-server/editor endpoints not deployed | 7.3.7 |
| zod | high / 4.4.3 | Transitive SDK validation; emitted reachability not established | **Unsure** — oversized constrained collections require call-path verification | 4.6.6 |

"No identified path" is a source-review assessment, not proof of absence or a runtime PASS. No new npm audit was uploaded; the requested saved findings were reviewed read-only.

## Every QA record created in this continuation

| Record | Created where | Final known state |
|---|---|---|
| qa-1793778867-main | Production | Draft retained, one room/two items, three photo references, three embedded synthetic signatures, hostile-string payloads |
| qa-1793778867-main-photo-1 | Production storage + photo manifest | Retained, confirmed ready |
| qa-1793778867-main-photo-2 | Production storage + photo manifest | Retained, confirmed ready |
| qa-1793778867-main-photo-3 | Production storage + photo manifest | Retained, confirmed ready |
| qa-1793778867-draft | Production | Deleted successfully as intended |
| qa-1793778867-completed-guard | Production | Deleted unexpectedly despite completed/reportGenerated markers |
| qa-1793778867-credit | Production | Deleted unexpectedly despite paid state; order retained |
| Order 77 | Production | Paid admin_credit, credit_1793778905982_lhcts2xywmf |
| qa-1793778867-tester | Production | Retained paid tester inspection |
| Order 78 | Production | Paid tester, tester_1793778919666_j3zqx18go4 |
| qa-1793778867-staging-guard | Staging request/shared DB | Retained completed marker; deletion rejected 409 |
| B auth user ttonmiBlLxJroxL6mAlvEFsKXlhFL0Df | Production auth | Disposable anonymous account; no profile created |
| T auth user AKrAcpA3dBNADknAijmrQAoeMXVg55TJ | Production auth + users | Disposable anonymous account; profile QA T 2026-11-04; tester status restored to false |
| Email event for qa-1793778867-main | Staging request/shared DB | One recipient reservation; event ID 10195b6a-afa8-4eec-a00b-21753a571bf5 |
| Provider email 01a1a58f-bf0c-71a8-b331-14e76a2a399f | Staging send route | Provider accepted at 07:57:03 UTC |

No new PDF, report_verifications row, Stripe checkout, discount use, or credit-token row was created. Existing QA rows from earlier sessions are not attributed to this continuation. Authentication additionally creates platform session records; cookies are sensitive and excluded from retained public evidence.

## What is needed to finish honestly

Use the actual client PDF renderer (a browser-capable run is necessary for this implementation), then fetch and rasterize that PDF and repeat existing-PDF access tests. Provide or approve a controlled account/balance setup for Stripe, discounts and the last-credit race; do not consume A's 20 remaining credits just to reach the branch. Confirm the production/staging policy before deploying repairs. Retrieve provider HTML/delivery evidence and execute the email cap boundary under a controlled recipient plan. Verify an actual Android release artifact/device, not just repository source.
