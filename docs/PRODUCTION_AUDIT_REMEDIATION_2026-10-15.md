# MeInspect Production Audit Remediation — 2026-10-15

## Executive status

All code-level findings in the requested audit were investigated and repaired. Frontend production build, backend type-check, EdgeSpark bundle validation/dry-run, Capacitor Android/iOS sync, dependency audits for the named advisories, route-contract checks, and staging response-header checks pass.

Two production-only acceptance items remain outside this environment: publishing the staged frontend/backend changes to production, and performing a real paid checkout/email delivery with an approved test customer. Android native compilation is blocked because Java is unavailable here; iOS native compilation cannot run on Linux.

## 1. Broken “Access Your Report” email link

**Root cause**

Payment-webhook, payment-notification, and report-ready templates derived the customer link from the backend request URL (`c.req.url.split('/api')[0]`). A webhook request is received on the YouBase worker, so this produced a worker/staging origin rather than the customer-facing app. Stripe return URLs also trusted the request `Origin` header. This was an origin-selection bug, not a missing SPA route.

**Repair**

- All customer-facing report links now use the explicit canonical app origin `https://app.meinspect.com`.
- A shared report-link builder emits `/report/:id` and URL-encodes the ID.
- Stripe success/cancel URLs now use the same canonical `/report/:id` route.
- Welcome links now also use the customer-facing app origin.
- `/report/:id` remains the authenticated report viewer. `/v/:id` remains the intentionally public cryptographic-verification page; they are different capabilities and are no longer conflated in email links.

**Verification**

- Static contract test confirms the templates, Stripe redirect URLs, and React `/report/:id` route agree.
- `https://app.meinspect.com/report/<probe>` and `/v/<probe>` both resolve to the SPA (HTTP 200), rather than a host-level 404.
- The production backend already supports authenticated report retrieval through `GET /api/inspections/:id`; the report page fetches this authoritative record when it is not on-device.
- EdgeSpark staging deployment succeeded.

**Still manual**

A real Stripe/RevenueCat payment and inbox delivery was not triggered because this environment has no approved disposable customer/payment credentials. Production will keep the old behavior until the staged change is published.

## 2. Critical Capacitor advisory

**Root cause**

Android, iOS, core, and CLI resolved to 8.4.1, within the vulnerable range for GHSA-rvm3-566m-v7fv.

**Repair**

Pinned `@capacitor/android`, `@capacitor/ios`, `@capacitor/core`, and `@capacitor/cli` to 8.5.3, the latest available patched 8.x release. No unrelated application dependency was intentionally upgraded.

**Verification**

- Both lockfile formats resolve the four packages to 8.5.3.
- Focused production audit returns no Capacitor Android/iOS/core advisory.
- Production web build passes.
- `cap sync android`, `cap sync ios`, and combined `cap sync` pass.

**Still manual**

Android Gradle compilation could not run because Java/JAVA_HOME is unavailable. Xcode/iOS compilation is unavailable on Linux. Native compilation should be run in the normal Android Studio/Xcode release environment.

## 3. Intermittent PDF image decode failure

**Root cause**

The vector PDF renderer treated every image load/fetch/decode as all-or-nothing. One corrupt, truncated, expired, empty, or WebView-failed image rejected report preparation. Capture encoding also accepted MozJPEG output without validating JPEG boundaries or proving the encoded result could be decoded before persistence.

**Repair**

- Each report image is now isolated in its own try/catch during layout and PDF source preparation.
- Failed images log the photo ID, a safe/truncated source description, and the decode/fetch error.
- Only the failed frame becomes a clear “Photo unavailable” placeholder; the remaining report continues.
- Photo elements carry their photo IDs into the renderer for actionable logs.
- Capture processing validates source dimensions, MozJPEG SOI/EOI boundaries, and immediate post-encode decodability.
- Encoding retries once at lower quality; if both attempts fail, the capture is rejected before it can be stored and the existing capture UI asks the user to retake it.
- Android decode compatibility is preserved by accepting a valid `onload`/natural-dimension result when `decode()` itself is spuriously rejected.

**Verification**

Frontend build and type-check pass. Existing photo preflight remains in place before finalisation as a second safety layer.

## 4. drizzle-orm / shell-quote

**Root cause**

The vulnerable `shell-quote@1.10.0` did not come from runtime query execution in MeInspect. It came through Drizzle’s optional `gel` peer/tooling path. The backend application contains no child-process, shell execution, raw unsafe SQL, or user-controlled command construction path.

**Repair**

- Upgraded `drizzle-orm` to 0.45.4.
- Upgraded `drizzle-kit` to 0.31.11.
- Forced transitive `shell-quote` to patched 1.12.0 in npm and pnpm resolution.

**Verification**

Focused backend audit returns no shell-quote, Hono, or Drizzle advisory. Backend type-check and EdgeSpark bundle build pass. The code-path audit found no shell/child-process invocation and all data access uses parameterized Drizzle predicates.

## 5. Hono advisories

Upgraded Hono from resolved 4.12.27 to 4.13.13. Backend strict type-check, EdgeSpark build, route analysis, and deployment dry-run all pass.

## 6. Missing production security headers

**Repair**

Added all six requested headers at both serving layers:

- Frontend hosting `_headers` policy for the SPA and static assets.
- Hono middleware for every backend response, including public routes and errors.

Headers: Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy. The CSP permits first-party content plus the app’s actual image, YouBase, Stripe, RevenueCat, blob, font, and worker needs.

**Verification**

A live request to the newly deployed staging backend returns all six headers. The production frontend currently still lacks them because these frontend hosting changes have not yet been published; verify again after publish.

## 7. EdgeSpark “Missing required export: default”

**Root cause**

The application’s `createApp(edgespark)` named factory is the correct current EdgeSpark contract. The previous failure was produced by stale deploy tooling/validation, not by a missing app export. Adding `export default` would conflict with the documented injected-client architecture.

**Repair**

Upgraded `@edgespark/cli` from 0.0.22 to 0.0.23. The named factory was preserved; no default export was added.

**Verification**

`edgespark deploy --dry-run` now passes schema sync, strict type-check, bundle build, bundle validation, and analysis of all 44 routes. Staging deployment also succeeds.

## 8. Accessibility labels

- Associated visible labels with login, signup, forgot-password, and admin-login inputs.
- Added labels for password visibility controls and OTP digit fields.
- Added an accessible label/state to the country-code selector.
- Added alert semantics to authentication errors.
- Replaced the admin login’s generic outer container with a `main` landmark.

Production build passes after these changes.

## 9. Report chunk size

**Root cause**

The report route statically imported the PDF renderer, pulling jsPDF and pdf-lib into one oversized route chunk.

**Repair**

- PDF rendering is dynamically imported only when a user actually generates a PDF.
- jsPDF and pdf-lib are split into separate lazy vendor chunks.

**Verification**

The report route is about 118 kB, the renderer wrapper about 12 kB, jsPDF about 387 kB, and pdf-lib about 429 kB. No emitted JavaScript chunk exceeds 500 kB and the production build no longer emits the chunk-size warning.

## Validation summary

Passed:

- Frontend production build
- Backend strict type-check
- EdgeSpark dry-run bundle validation and route analysis
- EdgeSpark staging deploy
- Capacitor Android sync
- Capacitor iOS sync
- Named dependency advisory checks
- Report-link static contract check
- Staging backend six-header response check
- Public verification API smoke check

Not verifiable here:

- Production publish/promotion (requires the YouWare Publish action)
- Real payment-provider checkout and real customer inbox delivery
- Android compile (Java unavailable)
- iOS compile (Linux environment)
- Production homepage headers until the frontend is published
