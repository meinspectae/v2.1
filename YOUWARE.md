# MeInspect — Property Condition Report App

## Project Overview
A professional property condition reporting application designed for the Dubai real estate market. It enables landlords, tenants, and inspectors to document property conditions with timestamped, geotagged photos and detailed item-by-item assessments.

## Architecture
```
Frontend (React + Vite)
├── src/
│   ├── api/client.ts          — Backend API service layer
│   ├── contexts/AuthContext.tsx — Authentication context
│   ├── components/
│   │   ├── SignaturePad.tsx    — Canvas-based signature component
│   │   └── ErrorBoundary.tsx   — Global error boundary for reliability
│   ├── pages/
│   │   ├── Dashboard.tsx       — Minimal home with Start New Inspection
│   │   ├── InspectionForm.tsx  — 6-step wizard with autocomplete
│   │   ├── ReportPage.tsx      — Multi-page PDF report generator
│   │   └── ...
│   ├── store/inspectionStore.ts — Zustand store (localStorage + API)
│   └── types/index.ts          — TypeScript interfaces

Mobile (Capacitor)
├── android/                   — Native Android project (API 36)
└── ios/                       — Native iOS project (Xcode)

Backend (Cloudflare Workers + D1)
├── backend/
│   ├── src/index.ts            — Worker entry point
│   ├── schema.sql              — Database schema
│   └── wrangler.toml           — Worker config
```

## Key Features
- **4 Property Types**: Apartment, Townhouse, Villa, Office
- **6-Step Inspection Wizard**: Property → Parties → Tenancy → Rooms → Signatures → Review
- **Autocomplete Fields**: 70+ Dubai communities with suggestions as you type
- **Room Management**: Add/remove rooms and items with individual delete options
- **Photo Capture**: Camera-based with GPS tagging and timestamp embedding
- **Digital Signatures**: Canvas-based for Tenant, Landlord, and Inspector
- **Email Report Sending**: Real email delivery via Resend API through backend endpoint
- **Inspection History Sync**: Bidirectional sync between local storage and cloud backend
- **Multi-Page PDF Report**:
  - Page 1: Property summary with exterior photo (centered, constrained width)
  - Page 2: Legal disclaimer (Arabic & English)
  - Page 3: Recording methodology (Arabic & English)
  - Assessment pages: Room-by-room condition tables
  - Last page: Signatures + Legal declaration (Arabic & English)
  - All pages: Timestamp, Report ID, Geolocation, IP Address, Page numbers
  - Tamper-proof: SHA-256 hash of report data for integrity verification

## Report PDF Fixes (2026-07-21)
- **Logo**: `PageHeader` in `ReportPage.tsx` now renders the real `/meinspect-logo.png` image on every page instead of a placeholder blue "M" box.
- **Image stretching**: Cover photo, room-item photos, and signature images were switched from `<img style={{objectFit}}>` to `<div style={{backgroundImage, backgroundSize:'cover'/'contain'}}>` because `html2canvas` (used internally by `html2pdf.js`) does not reliably respect CSS `object-fit` on `<img>` tags, causing visible stretching/distortion in the exported PDF.
- **Blank page space**: Previously every logical section (cover, disclaimer, each room, signatures) was forced into a fixed `height`/`minHeight: 1040px` flex-column div with the footer pinned via `marginTop: 'auto'`, wasting most of the page when content was short. Fixed by removing the forced page height so each section's div shrinks to its actual content height; `pageBreakAfter: 'always'` still forces a fresh PDF page at each section boundary. Rooms are now additionally grouped by an estimated-height greedy packer (`roomGroups` in `ReportPage.tsx`) so multiple short rooms share one physical page instead of each room getting its own near-empty page.
- **Report filename/title**: Both the exported PDF filename (`opt.filename`) and the print-window `<title>` now use `reportTitleString` = `PropertyName-Address-OwnerName-Date` (sanitized via `sanitizeFilename()`), instead of a generic `Property-Inspection-Report-<id>.pdf`.
- `scripts/generate-sample-report.py` mirrors the same fixes (real logo, natural page heights) for the bundled `public/sample-inspection-report.pdf` demo file.
- **Known local-preview limitation**: `vite preview`/`vite dev` serve the frontend from `http://127.0.0.1`, while auth (`@edgespark/client`/better-auth) issues session cookies scoped for the production HTTPS domain. Cross-origin session cookies cannot be set/read over plain HTTP, so email/password and anonymous sign-in cannot be fully exercised from a local preview — this is a sandbox/testing-environment limitation, not a bug in deployed production (same-origin HTTPS).

## Backend Integration
- **Authentication**: Youware platform auth via X-Encrypted-Yw-ID header
- **Database**: Cloudflare D1 (SQLite-compatible) with user-scoped data
- **API Endpoints**:
  - `GET/POST /api/inspections` — List/create inspections (authenticated, user-scoped)
  - `GET/PUT/DELETE /api/inspections/:id` — CRUD single inspection (authenticated, ownership-verified)
  - `POST /api/send-email` — Send report email via Resend API (authenticated, requires RESEND_API_KEY secret)
  - `GET /api/sync/inspections` — Fetch all inspections from cloud for a user (authenticated)
  - `POST /api/sync/push` — Push local inspections to cloud (authenticated)
  - `POST /api/upload/pdf` — Presigned PDF upload URL (authenticated, ownership-verified)
  - `GET /api/download/pdf/:inspectionId` — Presigned PDF download (authenticated, ownership-verified)
  - `POST /api/upload/photo` — Presigned photo upload URL (authenticated, ownership-verified)
  - `GET /api/download/photo` — Presigned photo download (authenticated, path-ownership-verified)
  - `POST /api/user/profile` — Save/update user profile (authenticated)
  - `GET /api/user/profile` — Get own user profile (authenticated)
  - `POST /api/checkout` — Create Stripe payment session (authenticated)
  - `GET /api/checkout/:sessionId` — Verify payment status (authenticated, ownership-verified)
  - `GET /api/orders` — Payment history (authenticated)
  - `POST /api/admin/set-tester` — Set user as tester (requires email and isTester boolean)
- **Security**: 
  - All endpoints enforce user ownership via `requireOwnership()` helper.
  - Authentication is enforced for all `/api/*` routes.
  - Payment status (`paymentData`) is protected and cannot be updated directly via client-side API calls (`PUT /api/inspections/:id`, `POST /api/sync/push`, `POST /api/inspections`).
  - Debug and public test endpoints have been removed for production security.
- **Reliability**:
  - Global `ErrorBoundary` wraps the application to prevent white-screens on runtime errors.
  - Visual "No GPS" badges on photos alert users to missing geolocation data before report generation.
  - Inspection data and photos are persisted using **IndexedDB** (via `idb-keyval`) instead of `localStorage` to provide a much larger storage quota and prevent data loss from `QuotaExceededError`.

## Stripe Integration & Tester Provision
- **Stripe Checkout**: The app uses Stripe Checkout for secure payments.
- **Tester Provision**: Users with `isTester = 1` in the `users` table can generate reports for free. The backend detects this status and bypasses Stripe, creating a "tester" provider order immediately marked as paid.
- **Configuration**: Requires `STRIPE_SECRET_KEY` to be set in the backend secrets.

## Database Schema
- `users` — User accounts synced from Youware auth
- `inspections` — Main inspection records
- `property_details` — Property info (1:1 with inspection)
- `parties` — Landlord, tenant, agent details
- `tenancy_details` — Lease information
- `rooms` — Room definitions
- `items` — Inspection items within rooms
- `photos` — Photos with GPS and timestamps
- `signatures` — Digital signatures
- `payments` — Payment records

## Mobile Deployment (Capacitor)
- **App Version**: 3.5 (versionCode 10) — see `android/app/build.gradle`
- **Release Keystore**: `keystore/release.jks` (PKCS12, alias: meinspect); signing passwords must be provided through `KEYSTORE_PASSWORD` and `KEY_PASSWORD` environment variables.
- **Network Status**: `NetworkStatusBanner` component shows "No Internet Connection" banner when device is offline (prevents "App is not responding" native dialog)
- **Android**: `npm run cap:add:android && npm run cap:open:android`
- **Sync**: `npm run cap:sync`

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 7, Tailwind CSS 3.4
- **State**: Zustand with localStorage persistence + backend sync
- **Backend**: Cloudflare Workers, D1 Database, TypeScript
- **PDF**: html2pdf.js (html2canvas + jsPDF)
- **Mobile**: Capacitor 8

## Bug Fixes Applied
- **Room data loss**: All store room mutation functions now use immutable `.map()` pattern instead of array index mutation to prevent reference sharing issues between rooms
- **PDF generation**: Switched from dynamic `import('html2pdf.js')` to static import to ensure the library is always available; added print fallback on PDF failure
- **Report responsive scaling**: Report (794px A4 width) now uses CSS transform scale to fit mobile viewports without horizontal overflow
- **PDF download on native**: Fixed Filesystem.writeFile to not use Encoding parameter (deprecated); fixed Share API to use `uri` from Filesystem.getUri instead of invalid `documents://` protocol
- **Print on Android**: Print button now triggers PDF generation + Share dialog on native platforms instead of opening a broken new window
- **Broken images in report**: Signatures and photos with empty URLs are now handled gracefully (show "Signature on file" placeholder; filter out empty-URL photos)
- **History card layout**: Moved action buttons below content instead of alongside (prevents text wrapping on mobile)
- **Profile name not saving**: Settings page now sends `name` to backend `/api/user/profile` endpoint; backend now accepts and saves `name` field

## iPhone / Mobile Web (PWA) Fixes (2026-07-22)
- **"Add Photo" not opening the camera/picker on iPhone**: `capturePhoto()`'s web (non-Capacitor) fallback created a `<input type="file">` and called `.click()` on it without ever attaching it to the DOM — iOS Safari/WebViews can silently swallow `.click()` on detached file inputs. Fixed by appending the input (hidden, off-screen) to `document.body` before `.click()`, removing it after selection/cancel. See `capturePhoto()` in `src/utils/helpers.ts`.
- **Tapping a field zooms in and never zooms back out on iPhone**: iOS Safari auto-zooms on focus when a field's computed font-size is below 16px (most fields here use Tailwind `text-sm` = 14px). Fixed via `index.html` viewport meta (`maximum-scale=1.0, user-scalable=no`) plus a `@media (max-width: 768px)` rule in `src/index.css` forcing `input/textarea/select` to 16px as defense-in-depth.
- **No way to navigate back on iPhone**: In-app back buttons called `navigate(-1)` directly, which is a silent no-op when there's no previous history entry (fresh PWA launch, deep link, native WKWebView cold start) — and iOS has no OS-level back gesture to fall back on. Added `safeGoBack(navigate, fallbackPath)` in `src/utils/helpers.ts` (checks `window.history.length`, falls back to a safe route) and wired it into `InspectionForm`, `ReportPage`, `PaymentHistoryPage` back buttons.
- **"Install MeInspect" banner still shown after installing (Android + iOS)**: Visibility only checked `display-mode: standalone`/`navigator.standalone`, missing the Capacitor native app (Android's WebView can still fire `beforeinstallprompt`). `index.html` now also checks `window.Capacitor.isNativePlatform()`, listens for `appinstalled` to hide the banner + persist the dismissed flag immediately, and gates the banner before its 3s show-timer (not just on `load`).

## Pre-Publish Audit — Round 2 (2026-07-23)
- **Camera ONLY, no gallery (FIXED)**: `capturePhoto()` in `src/utils/helpers.ts` now uses `CameraSource.Camera` (was `CameraSource.Prompt`) so the inspection workflow can ONLY take a fresh photo with the live camera — the "Photo Library / gallery" option is removed. Also added explicit `Camera.checkPermissions()` + `Camera.requestPermissions({permissions:['camera']})` before `getPhoto` (fixes iOS silently not opening the camera on first use), `correctOrientation:true`, `saveToGallery:false`, and real error logging in the previously-empty catch.
- **App icon replaced (both platforms)**: User-provided logo (`chat/wv72g7uo7w.jpg`, house+eye+green-check + wordmark) processed with `sharp`. Because a wordmark is illegible at icon sizes, the brand SYMBOL is extracted (crop top region + trim whitespace) and centered:
  - Source masters written to `assets/icon.png` (symbol on white, no-alpha for iOS), `assets/icon-foreground.png` (symbol on transparent, ~62% safe zone), `assets/icon-background.png` (white). Regenerator: `scripts/make-icons.mjs`.
  - Native icons generated by `scripts/generate-native-icons.mjs` (uses local sharp 0.35.x; NOTE: `@capacitor/assets` CLI fails here because its bundled sharp 0.32.6 native binary isn't built under pnpm):
    - iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024×1024, alpha removed — App Store requirement).
    - Android: `mipmap-{mdpi..xxxhdpi}/ic_launcher.png` (square), `ic_launcher_round.png` (circular mask), `ic_launcher_foreground.png` (adaptive foreground). Adaptive background stays white (`@color/ic_launcher_background = #FFFFFF`).
  - In-app/PWA `public/meinspect-logo.png` refreshed to 512×512.
- **Live E2E on https://app.meinspect.com (login aalekh.dxb@gmail.com)**: Login ✓ (email/password → redirects to dashboard), Dashboard ✓ (Welcome Aalekh, 6 completed), History ✓ (`GET /api/sync/inspections` 200, "Synced"), Settings ✓ (`GET /api/user/profile` 200, profile loads), New Inspection wizard ✓ (property-type step), Report page ✓ (loads with payment gate). No 4xx/5xx app errors observed. DB connectivity + sync confirmed. (Automation note: the login form is a React controlled form — programmatic `fill` alone doesn't update state; use `fill` then submit via Enter.)
- **Rollback note**: A prior session's identical fixes (camera, TS type fixes, version bump) had been rolled back before this session, so they were re-applied here. TypeScript `tsc --noEmit` is clean; production build succeeds; `npx cap sync` run for both platforms; Android bumped to `versionCode 4` / `versionName "3.1"`.

## Registration / Welcome Email + Native-iOS Diagnosis (2026-07-24)
Investigation of "no welcome email on registration" + native-iOS API concerns:
- **Root cause of missing welcome email**: `SignUpPage.handleSignup` sent the welcome
  email only inside `if (session.data?.user)` and hit the **authenticated** endpoint
  `/api/notifications/welcome`. But sign-up requires email verification, so
  `signUp.email()` returns `token: null` → **no session exists at that moment** → the
  welcome block never ran. On native (iOS/Android WebView) the app is cross-origin to
  the backend, so the edge-spark auth token isn't auto-injected either → the authed
  endpoint would 401. Result: welcome email was never sent.
- **Fix**: Added a **public, self-verifying** endpoint `POST /api/public/notifications/welcome`
  that looks the email up in `es_system__auth_user` and only sends to a genuinely
  registered account created within the last 30 minutes (anti-abuse). `SignUpPage` now
  calls it **unconditionally** after a successful sign-up (works on web AND native, no
  session/token required). Profile save (`/api/user/profile`) stays session-gated.
- **Resend health = OK (verified live)**: `sendNotificationEmail()` now logs and returns
  the exact Resend result (`{ok,id,error,status}`). A live end-to-end send to
  `delivered@resend.dev` returned `{"success":true}` → **RESEND_API_KEY valid + sender
  domain verified + Resend reachable**. DNS confirms Resend verification records
  (`resend._domainkey.meinspect.com` DKIM + `send.meinspect.com` SPF `include:amazonses.com`).
  So the failure was purely the frontend session-gate, not Resend.
- **Release build API URL = clean**: `dist/assets/*.js` and native `capacitor.config.json`
  (ios + android) contain **no localhost/staging URL**; API client (`src/api/client.ts`)
  uses `VITE_BACKEND_URL || https://olkmxpl1sliijytnc48w.youbase.cloud`.
- **Native iOS CORS = permitted**: backend responds with
  `access-control-allow-origin: capacitor://localhost` + `access-control-allow-credentials: true`.
- **Live E2E on https://app.meinspect.com (aalekh.dxb@gmail.com)**: Login ✓, Dashboard ✓
  (Welcome Aalekh, 6 completed), History ✓ (`GET /api/sync/inspections` 200, "Synced"),
  Settings ✓ (`GET /api/user/profile` 200), New Inspection wizard ✓, Report page ✓
  (payment gate shown). No 4xx/5xx. Automation note: the React login form ignores
  synthetic button-click/Enter from agent-browser — submit via `form.requestSubmit()`
  (or a real device tap); this is an automation quirk, not an app bug.
- **Auth base path** is `/api/_es/auth/*` (not `/api/auth/*`).
- **Deploy note**: backend fix is on **staging**; it goes live on production/native only
  after **Publish**. A throwaway `delivered@resend.dev` diag account remains in Users
  (DELETE is guarded); remove via YouBase → Users if desired.

## Existing-App Recovery Copy (2026-10-30)
- The originating Android build repeatedly re-saved `mvuxjr15sp5jlpzt` as a draft from stale local state, so direct server completion could not remain visible in History.
- A separate paid/completed recovery row, `mvuxjr15recovery1`, was created for `aalekh.dxb@gmail.com`. It copies the complete report payload and signatures and references the original inspection's 107/107 ready photo backups without altering or deleting the original draft.
- The photo retrieval endpoint now securely supports a completed recovery row's `sourceInspectionId`, after verifying the authenticated user owns both rows. This is backend-only and works with the already-installed app after production Publish; no mobile app update is required.
- Backend typecheck, bundle validation, all 49 routes, and staging deployment pass. Production Publish is still required for the existing app to restore the recovery copy's photos.

## Device Unlock Refresh Fix (2026-10-30)
- Server payment state for report `RPT-MVUXJR15` was confirmed paid, but the open inspection wizard on the originating device stayed locked because `syncFromBackend()` refreshed only the inspection list and left `currentInspection.payment` stale.
- `syncFromBackend()` now refreshes the open inspection from the merged authoritative row while preserving device-local draft content.
- The payment step now checks authoritative access when opened and whenever the app returns to the foreground, and includes a visible **Refresh report access** action. This prevents a remotely granted/admin/tester unlock from requiring another checkout or app-data reset.
- Android release metadata is now versionCode 5 / versionName 3.2; production web build and Android asset sync pass. The installed device build must be updated/published before it can receive this client-side fix.

## Build Commands
- `npm run dev` — Development server
- `npm run build` — Production build
- `npm run cap:sync` — Sync to native projects
- `node scripts/make-icons.mjs` — Rebuild icon masters from source logo
- `node scripts/generate-native-icons.mjs` — Regenerate iOS + Android launcher icons

## Android / Play Store
- **Target SDK**: 36 (Android 16) — meets Google's API 35+ requirement
- **Min SDK**: 24 (Android 7.0) — covers all Pixel phones and 99%+ of active devices
- **Manifest additions**: `dataExtractionRules`, `fullBackupContent`, `networkSecurityConfig`, `resizeableActivity`, `<queries>` block for PDF/image sharing
- **Removed permissions (2026-11-06)**: `READ_MEDIA_IMAGES` and `POST_NOTIFICATIONS` are intentionally absent; inspection photos use camera capture, not gallery access.
- **Pixel Fold / Tablet**: `resizeableActivity="true"` ensures proper multi-window support
- **Sample report**: Accessible at `/sample-inspection-report.pdf`; link shown on the Login page. Regenerated on 2026-10-09 in the current report format as a 14-page A4 demonstration report with 8 rooms, 47 rated items, 18 stock-image placements, keys/access cards, utility meters, move-in comparison, findings, bilingual legal wording, dummy signatures, QR/hash verification details, and an explicit sample-data disclaimer. Source stock assets are kept in `public/sample-report-assets/`; regeneration remains `REPORT_TEST_ORIGIN=http://127.0.0.1:5174 python3 scripts/generate-sample-report.py` while Vite is running on port 5174.
- **Play Store listing guide**: `playstore-assets/PLAYSTORE-LISTING.md`


## Native Google OAuth & Complete Brand Assets (2026-07-28)
- Native Google sign-in now launches in a Capacitor system browser via `@capacitor/browser`, never inside the isolated app WebView.
- The browser begins OAuth from the production web origin (`https://app.meinspect.com/mobile-auth.html`) and returns through `mobile-auth-callback.html`, which deep-links to `meinspect://auth/callback`; the app consumes the YouBase `es_auth_token` and restores the session.
- Android registers both the `meinspect://auth/callback` custom scheme and the HTTPS app-link callback. iOS registers the `meinspect` URL scheme.
- The YouBase Google callback is confirmed as `https://olkmxpl1sliijytnc48w.youbase.cloud/api/_es/auth/callback/google`; this is the URI that must remain authorized in Google Cloud.
- A backend mobile OAuth bootstrap/secure-state route is included. It re-issues `better-auth.state` as `HttpOnly; Secure; SameSite=None` before navigation when deployed. The top-level browser flow remains compatible with the platform's current `SameSite=Lax` fallback.
- The current YouBase deployment API returned internal error code `500001` after successful typecheck, build, route analysis, migration checks, storage verification, and bundle upload. The production site/native assets therefore need the normal YouWare Publish flow to go live.
- The complete uploaded MeInspect lockup is now used for the in-app/PWA logo and all generated Android/iOS launcher assets. Regeneration scripts preserve the full lockup rather than cropping to the symbol.
- Frontend production build and Capacitor Android/iOS sync pass. Android native compilation could not run in this environment because Java is unavailable.

## Backend Entry Point Contract (2026-08-10)
- `backend/src/index.ts` now uses the mandatory EdgeSpark contract: `export async function createApp(edgespark) { const app = new Hono(); ...; return app; }`. All `db`/`auth`/`secret`/`storage` access goes exclusively through the injected `edgespark` client (destructured once at the top of `createApp`). Never import from `"edgespark"`/`"edgespark/http"` and never `export default app` — doing so breaks `edgespark deploy` with error 500001.
- Schema/types are imported only from `@generated` (`tables`, `buckets`, `drizzleSchema`) and `@sdk/server-types` (`Client` type). These aliases are resolved by the pinned `@edgespark/cli` bundler itself (esbuild `alias` config), and mirrored in `backend/tsconfig.json` (`paths`) for local type-checking.
- `backend/src/defs/storage_schema.ts` and `backend/src/types.ts` are legacy/unused (excluded in `backend/tsconfig.json`) — the app now sources bucket/table defs from `@generated` only.
- Verify before considering backend work "done": `cd backend && npx edgespark deploy --dry-run` must print the Route Summary with no errors.

## RevenueCat IAP for iOS Report Unlock (2026-08-10)
- iOS uses a native in-app purchase (`com.meinspect.app.report`, RevenueCat) to unlock a single inspection report; web/Android are unchanged and still use Stripe (`PaymentModal`).
- **Correlation model**: before showing the purchase button, the client calls `Purchases.logIn(inspectionId)` (see `src/utils/revenuecat.ts` `identifyReport()`), so RevenueCat's `app_user_id` for that purchase IS the report's `inspectionId` — mirroring the existing Stripe `metadata.inspectionId` pattern. This lets the webhook resolve exactly which report to unlock with zero extra state.
- **Trust model**: the client's purchase success callback never unlocks anything by itself. `ReportPage.tsx` shows a "confirming" state and polls `GET /api/inspections/:id` until the backend's `paymentData.paid` flips to `true`. The **only** code path that sets `paid: true`/`false` for this product is the verified webhook `POST /api/webhooks/revenuecat` in `backend/src/index.ts` (checks `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` with no fallback — fails closed if the secret isn't configured). `INITIAL_PURCHASE` grants access; `CANCELLATION`/`REFUND` revoke it.
- `REVENUECAT_WEBHOOK_SECRET` must be configured as a backend secret (RevenueCat dashboard → webhook → same secret as the `Authorization: Bearer` value).
- Native setup: `@revenuecat/purchases-capacitor` added to `package.json`; `npx cap sync ios` regenerates `ios/App/CapApp-SPM/Package.swift` with the `RevenuecatPurchasesCapacitor` SPM dependency (project uses SPM, not CocoaPods — no `Podfile`). `initRevenueCat()` runs on app startup in `src/main.tsx`, iOS-only (`Capacitor.getPlatform() === 'ios'`).
- Android/keystore/report-rendering code were not touched by this feature.

## App Store Review Remediation (2026-08-05)
- Guideline 4.8: Google sign-in is no longer presented in the native iOS login or registration flows. iOS offers first-party email/password authentication only, so no third-party/social login service is used in the submitted iOS app. Google remains available on web and Android.
- Guideline 2.1(a): The sample report control now uses an explicit native-safe handler. In native builds it opens the verified production PDF in the iOS system browser; on web it opens a new tab. The control has a 44pt-equivalent touch target and an accessible label.
- Verified `https://app.meinspect.com/sample-inspection-report.pdf` responds successfully as `application/pdf`.
- Release version remains 1.0 and the iOS project build number is 15, following rejected build 14.
- Production frontend build and Capacitor iOS sync pass after the remediation.

## App Store Review Remediation Round 2 — Stripe-on-iOS gap + required phone (2026-08-17)
- **Guideline 3.1.1 (Stripe reachable on iOS)**: The `ReportPage.tsx` → RevenueCat platform gate added on 2026-08-10 only covered ReportPage's own "unlock" button. `InspectionForm.tsx` has its **own separate** `PaymentStep`/`PaymentModal` wiring (the wizard's "Payment" step, "Pay AED 199 to Generate Report" button) that was never gated and always opened Stripe checkout, including on iOS — this is what the reviewer captured. Fixed by mirroring the exact same iOS branch used in `ReportPage.tsx` inside `InspectionForm.tsx`: `isIOSNative = Capacitor.getPlatform() === 'ios'`; on iOS, `identifyReport()`/`hasPurchasedReport()` run before showing a purchase button, the button calls `purchaseReport()` (RevenueCat) instead of opening `PaymentModal`, and a `pollBackendForUnlock()` loop waits for the same verified `/api/webhooks/revenuecat` webhook (trust model unchanged — client never self-unlocks). On Android/web, `isIOSNative` is `false` so `PaymentStep`/`PaymentModal` behave exactly as before (Stripe, unchanged). Confirmed via full-codebase search that `ReportPage.tsx` and `InspectionForm.tsx` are the **only two** places that import `PaymentModal` / trigger a report checkout — no other entry points exist.
- **Guideline 5.1.1(v) (phone required at signup/inspection form)**: Phone is only ever used to print contact info on the generated PDF report (`ReportPage.tsx` renders `landlord.phone`/`tenant.phone` with a `'—'` fallback when blank) and to populate `user_profiles.phone` / `users.phone` (both `TEXT DEFAULT ''`, no `NOT NULL` — already optional at the DB layer). It is never used for auth, OTP, or any gating logic, so making it optional breaks nothing. Made phone optional **iOS-only** in the two shared forms Apple flagged:
  - `SignUpPage.tsx` ("Create Account"): `validateForm()` only requires phone when `!isNativeIOS` (existing `isNativeIOS` flag, already used for the Google-sign-in gate); the `PhoneInput` label drops its `*` on iOS. Android/web keep the required-phone behavior.
  - `InspectionForm.tsx` ("Parties" step): added `isIOSNative` (same `Capacitor.getPlatform() === 'ios'` check as the payment fix above); `isPartiesValid()` now checks `(isIOSNative || t.phone)` / `(isIOSNative || l.phone)` instead of unconditionally requiring `t.phone`/`l.phone`; `PartiesStep` gets an `isIOSNative` prop that drops the `*` from the Landlord/Tenant `PhoneInput` labels; the step's validation-error text also adapts. Android/web behavior is byte-for-byte unchanged.

## Full Quality Audit (2026-08-22)
- **Real bug fixed — signatures silently wiped from backend on every sync**: `stripBase64Photos()` in `inspectionStore.ts` strips any `url`/`dataUrl` field starting with `data:` before sending an inspection to the backend, to keep photo payloads under the Cloudflare Workers size limit (photos have a separate `uploadPhotoToCloud()`/`cloudPath` mechanism that preserves the real image). `Signature.dataUrl` matches the same key name but has **no** equivalent cloud-upload path — it is only ever stored inline. Every auto-sync therefore permanently blanked tenant/landlord/inspector signatures in the backend DB (evidentiary data loss on new devices/reinstalls/storage eviction), silently masked in the UI by the existing "Signature on file" placeholder. Fixed by passing a `parentKey` through the recursion and skipping stripping entirely while inside a `signatures` array/object (signature PNGs are only a few KB — no size-limit reason to strip them).
- **Pre-existing bug fixed — LoginPage native-OAuth error narrowing**: `LoginPage.tsx`'s `subscribeToNativeOAuth` callback used `if (!result.ok)` on a `{ok:true} | {ok:false; error:string}` union; without `strictNullChecks` (project default) this fails to narrow and is a genuine `tsc --strict` `TS2339`. Changed to `if (result.ok === false)`, which narrows correctly regardless of strict mode.
- **Verified false positives under `tsc --strict`** (left unchanged — not bugs): (1) `ForgotPasswordPage.tsx`'s `client.auth.forgetPassword.emailOtp(...)` / `client.auth.emailOtp.resetPassword(...)` — flagged as missing properties on `EdgeSparkAuth`, but confirmed via the installed `@edgespark/client` bundle that its own internal `AuthFlowManager` calls these exact same methods; the `.d.ts` is simply incomplete for the `emailOTP` plugin. (2) `InspectionForm.tsx`'s 12 "`currentInspection` is possibly null" warnings — safe because of the `if (!currentInspection) { navigate('/new'); return null; }` guard placed after all hooks (required by React's Rules of Hooks); the component unmounts before those closures can run with a null inspection. (3) `revenuecat.ts`'s `PurchasesPackage | undefined` vs `| null` — cosmetic; the code immediately does `if (!productToBuy)` which treats both identically.
- **Payment platform-branching**: confirmed `ReportPage.tsx` and `InspectionForm.tsx` remain the only two call sites that can open a checkout, and both still branch correctly on `isIOSNative` (RevenueCat on iOS, Stripe `PaymentModal` on Android/web) with no gaps found.
- **No template/branding/dictionary/custom-field feature exists** in this codebase (`propertyTemplates.ts` is static, developer-defined room/item lists, not a user-editable template builder) — sections of a generic audit checklist referring to those features are N/A here.
- Headless Chrome could not be launched in this sandbox (zygote/namespace sandboxing restrictions persist even with `--no-sandbox --disable-dev-shm-usage`), so responsive/visual UI verification for this pass was done via static review of Tailwind breakpoints/overflow handling rather than live screenshots — no hard-coded fixed-width containers or missing `overflow-x-auto`/`flex-wrap` safeguards were found in the pages reviewed (`InspectionForm.tsx` step tabs, `ReportPage.tsx` action bars, `HistoryPage.tsx` cards).
- **Android impact**: none. `android/` was not touched; `Capacitor.getPlatform() === 'ios'` is `false` on Android, so every changed condition (`isIOSNative`) evaluates identically to the pre-existing behavior on Android and web.


## iOS IAP Race Fix + Webhook Root-Cause + Auth Flows (2026-08-27)
Three separate work items. All builds pass: frontend `pnpm run build` ✓; backend `npx edgespark deploy --dry-run` → Type check passed / Build completed / Bundle valid / 38 routes. Backend deployed to **staging**; goes live on production/native via **Publish**.

### Part 1 — iOS purchase-flow race condition (InspectionForm only)
- **Bug**: `InspectionForm.tsx` `handleNativePurchase()` called `purchaseReport()` (RevenueCat) WITHOUT first guaranteeing the inspection row exists in the backend. The webhook resolves the report purely by `app_user_id === inspectionId` and returns 200 doing nothing when no row exists — so if the webhook won the race, the client polled forever and timed out.
- **Fix**: added `syncCurrentInspection(): Promise<boolean>` to `inspectionStore.ts` (ensures the current inspection is in the local array, then `retrySync()`s it, returning `true` only on confirmed backend write). `handleNativePurchase()` now `await`s it BEFORE purchasing; on failure it shows a clear error and aborts (no purchase attempt). iOS-only path — Android/web still use `PaymentModal` (Stripe) unchanged.

### Part 2 — "The product is not available for purchase" (investigation, no code change)
- This exact phrase is NOT in our codebase (our own messages are "Report purchase product is not available right now." / "In-app purchase is only available on iOS."). It is RevenueCat/StoreKit's `PRODUCT_NOT_AVAILABLE_FOR_PURCHASE` error message, surfaced **verbatim** by `purchaseReport()`'s catch in `src/utils/revenuecat.ts` (`message: err?.message`) and rendered via `iapError`. StoreKit raises it at purchase time when the product isn't in a purchasable state — consistent with the user-confirmed App Store Connect requirement (first IAP must be submitted with an app version). Not a code bug.

### Webhook silent-failure root cause (RPT-MSZTKP6U) — PROVEN with real DB data
- `RPT-MSZTKP6U` = `RPT-` + `inspection.id.slice(0,8).toUpperCase()` → inspection id `msztkp6uftr76dev`. Row **exists**; `app_user_id` matched perfectly (never an ID mismatch). Its `payment_data` had a manual backfill noting `"unlockedByEvent":"NON_RENEWING_PURCHASE"`.
- **ROOT CAUSE**: the webhook only granted on `eventType === 'INITIAL_PURCHASE'` (subscriptions). A one-time report unlock is a **non-subscription** product → RevenueCat fires **`NON_RENEWING_PURCHASE`**, which fell into the silent "No action taken" `else` branch, returned 200, and never unlocked.
- **Fixes in `backend/src/index.ts` `/api/webhooks/revenuecat`**:
  - GRANT set now = `INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE`; REVOKE = `CANCELLATION`, `REFUND`, `EXPIRATION`.
  - Always-on structured logging: `app_user_id`, `match_found`, and `action=` (unlocked / revoked / no_match / ignored / no_op).
- **Safety net — manual reconciliation**: new `POST /api/inspections/:id/reconcile-purchase` (auth + ownership). On poll timeout, `InspectionForm.tsx` and `ReportPage.tsx` call it; it queries RevenueCat REST `GET /v1/subscribers/{app_user_id}` with `REVENUECAT_SECRET_API_KEY` and, if a valid non-refunded `non_subscriptions[com.meinspect.app.report]` (or active entitlement) exists, unlocks the report directly (`unlockedByEvent:"RECONCILIATION"`). User is never permanently stuck if the webhook path fails.
- **Verified (staging)**: webhook route live (401 without secret = fails-closed), reconcile route live (401 unauthenticated). DB before/after on a test row: `{"paid":false}` → `{"paid":true,...,"unlockedByEvent":"NON_RENEWING_PURCHASE"}` (the exact write the fixed grant branch performs).

### Part 3 — Forgot Password + Delete Account (both platforms; no payment code touched)
- **Delete Account bug**: `DELETE /api/user/account` deleted only `inspections` + app `users` rows and returned success, but NEVER deleted the auth identity `es_system__auth_user`. Result: the account could still log in and the email stayed permanently "taken" (re-registration failed) — a silent no-op at the auth layer. **Fix**: also delete `tables.esSystemAuthUser` (by id) and `tables.userProfiles` (by userId). Verified live: sign-up writes a real `es_system__auth_user` row (which the old code left behind); the fixed route is deployed & auth-gated. (Full authed end-to-end delete couldn't run in-sandbox because email-verification gates session creation and the auth table is read-only to the SQL tool.)
- **Forgot Password bug**: the OTP send (`forgetPassword.emailOtp`) and reset (`emailOtp.resetPassword`) work (endpoints return 200 / validate OTPs live — method names match the `@edgespark/client` SDK). BUT the post-reset "password changed" confirmation hit the **authenticated** `/api/notifications/password-changed` while the user is logged OUT → always **401** → email silently never sent. **Fix**: added public self-verifying `POST /api/public/notifications/password-changed` (looks the email up in `es_system__auth_user`, only sends to a registered account); `ForgotPasswordPage.tsx` now calls the public endpoint. Verified live: returns `{"success":false,"error":"not_registered"}` (200) for unknown emails.

### Scope confirmation
- Parts 1 & 2 touched only iOS purchase-flow code (`InspectionForm.tsx` iOS branch, `inspectionStore.ts` new method, `revenuecat.ts` unchanged) + the RevenueCat webhook — no Android/web/Stripe code.
- Part 3 touched only auth/notification code (`ForgotPasswordPage.tsx`, delete-account + public password-changed endpoints) — no payment/IAP/Stripe/RevenueCat code.
- `backend/src/index.ts` is shared but the edits are in distinct, unrelated handlers.

## Notification Route/Call-Site Audit (2026-08-28)
Frontend↔backend notification-route audit; fixes are notification-sending code + its call sites only.
- **Item 1 — Welcome email (checked, no fix needed)**: `SignUpPage.tsx` correctly calls the public `POST /api/public/notifications/welcome` unconditionally on signup → `sendNotificationEmail()`. Both required secrets are configured (verified via `cd backend && npx edgespark secret list`): `RESEND_API_KEY` and `FROM_EMAIL` both present. Sending domain `meinspect.com` is verified with Resend — confirmed live via DNS: DKIM `resend._domainkey.meinspect.com` has a valid `p=` key, `send.meinspect.com` SPF = `v=spf1 include:amazonses.com ~all`, and MX `10 feedback-smtp.ap-northeast-1.amazonses.com`. No secret missing; no code change. NOTE: `edgespark` CLI exposes no log-streaming command and secret *values* are never returned by the API, so live `[NOTIFICATIONS]` log lines / the FROM_EMAIL literal value can't be read from this environment. If welcome mail still isn't arriving, the remaining causes are non-code: staging-vs-Publish (backend notification changes go live only after Publish) or recipient-side spam filtering.
- **Item 2 — Payment-success confirmation email (gap fixed)**: `POST /api/notifications/payment-success` (authed) existed but was never called from the frontend. Added a shared, idempotent, best-effort helper `notifyPaymentSuccess({email,name,amount,currency,reportId})` in `src/utils/helpers.ts` (POSTs via authed `client.api.fetch`; per-report `localStorage` guard `meinspect_pmt_email_sent_<id>` so it sends at most once across the multiple confirmation paths/reloads). Wired into the actual "payment just succeeded" moments on BOTH platforms — Stripe (web/Android): `InspectionForm.handlePaymentSuccess` + `ReportPage` Stripe-redirect `verifyPayment`; RevenueCat/IAP (iOS): `InspectionForm` `markPaid` (poll+reconcile) + `ReportPage` `pollBackendForUnlock` success + reconcile-safety-net success. Deliberately NOT wired into `ReportPage.checkBackendPayment` (the on-mount stale-sync check) to avoid a spurious "payment received" email when merely *opening* an already-paid report on a fresh device. Email/name sourced from `useAuthStore().user`. Files: `src/utils/helpers.ts`, `src/pages/InspectionForm.tsx`, `src/pages/ReportPage.tsx`.
- **Item 3 — Bulk `POST /api/download/photos` (checked, left alone)**: never called anywhere in the frontend (only the *singular* `GET /api/download/photo` is used, via `getPhotoDownloadUrl()` to restore individual report photos). It is abandoned scaffolding for a "download all photos" feature that was never built. Left alone deliberately: every captured photo is already embedded in the generated PDF report (so a separate raw-photo bulk download is redundant), there is no gallery/multi-select UI to hang it off, and wiring a real "download all" would require non-trivial new logic (zip creation or multi-file native Share) — which the request explicitly said not to build.
- **Scope**: no `ios/` or `android/` native config touched; no Stripe/RevenueCat purchase-flow logic touched (checkout creation, `purchaseReport`/`handleNativePurchase`/`identifyReport`, `PaymentModal` internals, the `/api/webhooks/revenuecat` webhook — all unchanged). Frontend `pnpm run build` ✓ and `tsc --noEmit` ✓.

## 5-Bug Fix Pass — Payment re-paywall, form validation, phone overflow, form consolidation, duplicate items (2026-09-01)

1. **Payment History / Completed Reports re-paywalling bug**: `PaymentHistoryPage.tsx`'s "View Report" button previously navigated straight to `/report/:id` with no local inspection data at all — if that report's paid status only existed in the `orders` table (e.g. purchased on a different device, or a fresh reinstall with an empty local store), `ReportPage.tsx`'s `getInspection(id)` (local-only lookup) returned `undefined`, so `isPaid` could never be derived and the page fell straight to "Inspection not found" / re-showed the paywall instead of the report the user already paid for. Fixed in two places: (a) `PaymentHistoryPage.tsx` now looks up any local copy via `getInspection()` and calls `setCurrentInspection()` before navigating; (b) `ReportPage.tsx` now has a genuine backend fallback — when there's a route `id` but no local/current inspection, it fetches `GET /api/inspections/:id` directly (the same paymentData source of truth the existing `checkBackendPayment` effect already trusted), maps it into the `Inspection` shape, and adopts it via `setCurrentInspection()` before rendering, with a loading spinner instead of an immediate "not found". The pre-existing `checkBackendPayment`/`isPaid` reactive-update effects are unchanged and pick up the correct `paymentData.paid` once the record loads — so a report paid for on any device now opens without a payment prompt from History, Completed Reports, or Payment History. `HistoryPage.tsx` already called `setCurrentInspection()` before navigating and needed no change. **Regression/manual test**: pay for a report → close the app → reopen from Payment History or History → Completed → confirm it opens straight to the unlocked report, no paywall.
2. **Inspection form submittable with no input**: `InspectionForm.tsx` already blocked `goNext()`/`handleComplete()` via `canProceed()`, but `isRoomValid()` only rejected a room if an item was *partially* filled in — a room with zero items touched at all was considered "valid", so a user could tab through every room without entering any data. Fixed: `isRoomValid()` now additionally requires at least one non-General item to be *fully* assessed (condition + comment + photo) before a room step passes. Added inline, per-field error messages (red border + text under the exact invalid field) to `InputField`/`AutocompleteInput`/`PhoneInput` for the (now-combined) Details step, and an inline warning under the item list for Room steps — both gated by a new `showStepErrors` state that flips true when `goNext()` is blocked (validate-on-click) and resets on any successful/attempted navigation, so errors aren't just a generic banner. The `Next`/`Complete` buttons remain disabled via `canProceed()` as a second line of defense.
3. **Fields overflowing screen in Involved Parties (phone inputs)**: `PhoneInput.tsx`'s digits `<input>` used `flex-1` with no `min-width: 0`, so on narrow viewports (~360px) the flex item refused to shrink below its intrinsic content width, pushing the whole control past the card boundary. Fixed by adding `min-w-0 w-full` to the digits input, `flex-shrink-0` + `whitespace-nowrap` to the country-code button, and constraining the dropdown to `max-w-[80vw]`; the component root and its flex row now also carry `w-full min-w-0`. Applies uniformly to every `PhoneInput` usage (Landlord/Tenant), so no separate per-form fix was needed.
4. **Consolidated Property Details + Involved Parties + Tenancy Details into one step**: `InspectionForm.tsx`'s wizard `steps` array collapsed the three separate `'property'`/`'parties'`/`'tenancy'` entries into a single `'details'` step rendered by a new `DetailsStep` component — one scrollable form with three `<section>` blocks (Property Details → Involved Parties → Tenancy Details), each with its own header/icon and separated by `<hr>` dividers. The step indicator/progress bar automatically reflects the reduced step count since it's driven by `steps.length`. Field reduction (confirmed with the user before implementing): the optional "Real Estate Agent" sub-form was removed entirely (it was never rendered anywhere in the generated PDF report — confirmed via `ReportPage.tsx`, which never reads `inspection.agent` for display, only round-trips it in a sync payload), and "Contract Number" was dropped from Tenancy Details (still optionally rendered on old reports that have it saved, via `ReportPage.tsx`'s existing conditional `{inspection.tenancy.contractNumber && ...}`, but no longer collected or required). Kept: Makani Number/Area/City (required), Building Name/Unit/Total Area/Bedrooms/Bathrooms/Furnished (optional, still useful for the report), Landlord/Tenant Name+Phone+Email (required), Lease Start/End Date (required). New validation: `isTenancyValid()` now also rejects a Lease End Date earlier than the Lease Start Date, with the same check surfaced as an inline error under the Lease End Date field.
5. **Duplicate items within the same room**: audited `propertyTemplates.ts`'s static room definitions end-to-end — no room definition actually spreads the same category array twice, so the visible duplication was a latent risk rather than an existing static bug in the current template data. Hardened every layer that touches a room's item list defensively so duplicates can never reach the UI regardless of future template edits or sync timing: added `dedupeItemsByName()` (used inside `withGeneralItem()`, so every template-built room's items are deduped by name at construction time) and `dedupeRoomItems()` (ID-first, name-fallback) in `propertyTemplates.ts`; applied `dedupeRoomItems()` in `inspectionStore.ts`'s `assignIds()` (new inspections), `syncFromBackend()`'s both merge branches (backend-authoritative rooms and the newer-local-preserve-photos path), `addRoom()`, and `setRooms()`; guarded `addItem()` against inserting a second item with the same (trimmed, case-insensitive) name into the same room (defends against a double-tap/double-submit adding a custom item twice); and applied a final render-time `dedupeRoomItems()` pass in `SingleRoomStep` (`InspectionForm.tsx`) via a memoized `displayItems` array used for both the item list and the room's progress counters, so even a stale cached room from before this fix can never render a duplicate row. **Verified**: `propertyTemplates.ts`'s `dedupeItemsByName`/`dedupeRoomItems` unit-checked by inspection — every room type (apartment/townhouse/villa/office + dynamic bedrooms/bathrooms/meeting-rooms) now produces item names deduped at build time in addition to the render/merge/add-time safety nets.

**Build verification**: `pnpm run build` ✓ (no errors, `ReportPage` chunk >500kB warning is pre-existing/unrelated) and `npx tsc --noEmit -p tsconfig.app.json` ✓ (zero type errors) after all five fixes.
**Scope**: Android/iOS both use the same shared React codebase (Capacitor WebView) for these pages — no native (`ios/`/`android/`) code was touched, so all fixes apply identically on both platforms. No changes to Stripe/RevenueCat purchase logic, payment webhooks, or `backend/src/index.ts` — the re-paywall bug was purely a frontend data-loading gap, not a backend/payment-authority issue.


## Phase 1 inspection reliability changes — 2026-09-30 (acceptance pending)
- User explicitly requires **NO IndexedDB**. This supersedes the old IndexedDB notes. Store now uses metadata-only localStorage; `idb-keyval` removed. Photo binaries exist only in memory until immediate cloud upload; never serialize photo data URLs or signed download URLs. Small signature data remains persisted. No legacy IndexedDB read/migration was performed; old local-only evidence needs an explicit migration decision.
- Scope is Phase 1 only. **Do not start Phase 2 until Phase 1 is accepted/tested**. Optional meters/reference, legal/Arabic text, page numbering and verification QR/hash remain deferred. Preserve Stripe/RevenueCat and auth behavior.
- `inspectionData.ts` is the shared final-checklist/summary layer. Deleted entries filtered independently of unrated entries; duplicates merge all notes/photos and retain conflicting rating history (most severe rating counts once). Default carpet/wallpaper/ceiling fan filtered at template creation, not retroactively erased from retained checklist data.
- `draftBackup.ts` serializes cloud saves per inspection; owns photo queue/online retry, recovery and discard ordering. `BackupNotice` surfaces failures/pending evidence. Resume displays property, start time and photo count. Draft remains recoverable until PDF cloud upload AND metadata save succeed. Camera offline/force-close limitation is explicit: memory-only photos cannot survive termination until uploaded.
- Added `inspections.extra_data` and indexed `inspection_photo_backups` via SQL tool; audit migration saved under backend/migrations. Photo manifest routes in backend enforce ownership; paths tagged by inspection/room/item. Pending path stored before binary upload and confirmation; fallback to old singular upload/download routes retained while new routes are undeployed.
- `PortraitCapture` provides live browser framing (where getUserMedia works), system-camera fallback and 3:4 repositionable crop. Native fallback cannot overlay the system view: device check remains required. Capture max edge 2000px at JPEG ~0.78; report embeds detail JPEGs separately from page screenshots, two photos side by side. `reportPdf.ts` clones one section at a time and releases canvases. Stronger compression passes precede the 40MB hard share gate; extremely large reports still error visibly rather than dropping photos.
- Validation and manual steps: `docs/PHASE_1_VALIDATION.md`. Browser fixtures passed checklist/counts/default filtering, portrait crop, 2000px sizing, 32 synthetic photos at 1.74MB, metadata without photo bytes, mocked upload tags, reload restoration, and online retry. Real-device/cloud recovery and real scratch sharpness remain unverified. Random-noise 32-photo stress exhausted sandbox memory, so it is NOT a pass; one-section cloning was added afterward.
- **BLOCKER: backend deploy tool mismatch.** CLI 0.0.22 and 0.0.23 typecheck/build successfully but reject the documented named `createApp` contract, demanding a default Hono instance (confirmed by actual CLI source inspection; default-exported factory is NOT a fix). `edgespark pull types` fails: server did not return edgespark.d.ts. Do not invent a new auth/runtime adapter or change contract to appease it. Original CLI 0.0.22 retained. New backend routes have NOT been deployed; resolve via platform support. Frontend builds/typecheck pass.


## Report core fixes and quality — 2026-09-30 (supersedes earlier PDF/storage notes)
- User scope: ONLY the 13 requested report/core fixes. Preserve auth/payments and existing stack.
- No IndexedDB. Zustand persists metadata only; draftBackup uploads compressed photos immediately, serializes cloud writes, retries failures, restores renewable cloud display URLs. Offline pending image bytes exist only in memory and cannot survive app termination; warn explicitly. Legacy IndexedDB-only bytes are not migrated.
- inspectionData normalizes deleted rooms/items and merges duplicates retaining evidence/notes and worst rating plus history. Summary buckets: Good (includes Very Good), Fair, Issues. Notes for Fair/Issue are prompted but skippable.
- PortraitCapture provides 3:4 cropping. Evidence capture max edge 2000px, JPEG .78. reportPdf uses section rendering and original detail embedding, excludes the original report DOM from html2canvas clones, sequential physical 1–N footers, keep-together blocks, automatic compression passes and 40 MiB cap. Successful cloud uploads release data URLs in favor of signed display URLs.
- Optional meters (electricity/water/gasCooling) and move-in reference metadata live in inspections.extra_data; meter photos share backup logic. PDF attachments use private references storage. Empty optional sections never print.
- Historical legal implementation (superseded 2026-10-01): the seven-clause configuration has been replaced by the user's exact 19-clause bilingual Report Scope & Method text; see the latest report update below.
- Full content hash includes canonical visible content, legal wording and evidence references; printed with version ID/QR on last page. Server independently hashes actual PDF bytes on finalisation. report_verifications stores both hashes and immutable private-copy path. Public /v/:id checks PDF locally then sends only hash; pasted content hash confirms record identity only. No personal data public.
- Backend staging deploy successful (contract requires re-exporting tables/buckets/drizzleSchema). Frontend uses staging URL, automatically promoted on publication; QR uses app.meinspect.com public route (requires publication). Existing auth/UI/payment conventions retained.
- Checks: 32-photo scratch sample 1.20 MiB; 32 distinct high-entropy photo fixture triggers stronger pass -> 38.60 MiB. 13 consecutive PDF pages, embedded font, QR decoded, 7 Arabic clauses visually checked. Public staging verification tested using seeded fixture, then disabled. Fixture qa-verification-test remains with non-matching sentinel hashes (SQL tool disallows DELETE).
- Detailed changes/how-to-test and honest remaining device/legal acceptance gates: docs/PHASE_1_VALIDATION.md, docs/PHASE_2_VALIDATION.md. Physical-device crash recovery and authenticated attachment/finalisation end-to-end are NOT claimed as tested.


## PDF layout/photos and exact bilingual report wording — 2026-10-01

This section supersedes the earlier screenshot-based PDF, portrait-cropping and seven-clause report notes for this update.

- Scope: report presentation/photo encoding and the user's explicit legal-text replacement only. Preserve rating logic/checklists, signature capture, hash/verification algorithm, storage, auth/payments and existing finalisation workflow. No new screen or mandatory step.
- `src/components/ReportDocument.tsx` provides cover, legend/overview/findings, 19-clause scope/method, optional keys/meters/reference, flowing rooms and last-page signatures. Existing display names remain Very Good / Good / Fair / Issue; summary remains Good (includes Very Good) / Fair / Issues.
- `src/utils/reportPdf.ts` is now a vector jsPDF renderer, not html2canvas/html2pdf screenshot output. A4 portrait, 15 mm exterior margins, existing header/footer content, true physical Page X of N. Text and independent JPEG evidence remain separate. Original JPEG dimensions are retained on normal export. Quality retries decrease by .05 before dimensions at the unchanged 40 MiB cap.
- `src/utils/photoEncoding.ts` uses MozJPEG explicit 4:2:0 at .80; new photos contain the complete oriented frame in 900x1200 / 1200x900. Cover live capture up to 1200x1600 (landscape equivalent); existing cover dialog no longer crops. Standard display frames 50x66 / 79x59 mm, cover 90x120, 3 mm gaps, 8 pt captions. Oversized items receive continuation cards between complete rows.
- Embedded Inter regular/bold/italic and merged Noto Naskh Arabic report font in `public/fonts`; merged font includes Latin glyphs needed inside Arabic clauses. `pdfUnicode.ts` normalizes contextual Arabic glyphs/RTL text streams for logical searchable text. Font-source/license metadata retained alongside fonts.
- Editable `src/config/reportLegal.ts` contains the exact supplied 19 clauses (A1–F2), six headings, declaration and unsigned labels. ReportQualitySections, ReportDocument, signature-step wording in InspectionForm and public sample all consume that source. Rating definitions live in the same config separately. Never reintroduce old legal claims or review-status comments. Verification wording remains outside legal sections.
- `reportVerification.ts` algorithm is unchanged. Because it already includes the legal config, the requested wording replacement naturally changes new report content hashes. Registered historic PDF records are not rewritten.
- Signature records currently have no captured per-signer IP. Report prints an existing signer IP if present, otherwise 'Not recorded'; do not invent it or substitute inspector IP. Adding IP capture is outside this task.
- Validation: phase A 32 photos / 8 pages / 2,018,377 bytes. Final synthetic fixture 34 independent JPEGs / 13 pages / 3,283,294 bytes; deleted/unrated absent, empty room message, empty utility omitted, filled-meter/no-findings variants, landscape cover, unsigned tenant, counts 3+1+1=5, exact bilingual clauses, Arabic search/joining, embedded fonts, no blank pages or split photo rows, 300% synthetic mark and unchanged input/hash under rendering all pass. Build + typecheck pass. Fixture QR deliberately not registered; real-device camera and authenticated delivery remain manual acceptance.
- Public artifacts: `/meinspect-test-report.pdf`, `/phase-a-test-report.pdf`, regenerated `/sample-inspection-report.pdf`; available on current app/preview, production only after publication. `scripts/generate-sample-report.py` now uses the actual report components/renderer, not a parallel hardcoded legal template.
- Detailed changes/how-to-test, exhaustive active legal-surface audit, and limitations: `docs/REPORT_LAYOUT_VALIDATION.md` (public review copy at `/report-review-notes.md`). Browser fixture/tests in `scripts/report-fixture.tsx`, `report-layout-check.js`, `report-extra-check.js`; actual PDF inspection in `scripts/validate-report.py`, results in `report-validation-results.json`.


## Report generation/photo recovery remediation — 2026-10-02
- Replaced fragile image `decode()` timing with load/error-event based report image loading. PDF preparation now waits for every image before rendering and fails visibly instead of silently producing unavailable-photo placeholders.
- Finalise, Download PDF, Email Report and Print run a photo pre-flight before payment. Each included photo refreshes its cloud URL and is fetched/decoded up to three times, then falls back to an available device URL up to three times. Failures are itemised with Retry, Retake photo and explicit Continue without these photos actions; retake navigates to and expands the exact room/property item.
- Continuing without failures records `includeInReport:false`; cover counts only readable/included photos and prints the excluded count. Earliest readable capture supplies the 90 × 120 mm cover; an address card is the no-photo fallback.
- RPT-MUPJUFH1 (`mupjufh1uyeey9gk`) production data audit: 21/21 unique photo backup records are `ready=1`, all 21 inspection references are `backed_up`, none excluded, capture range 2026-10-01 13:09:17–13:15:08 UTC. Saved URLs are intentionally blank because signed URLs expire and are renewed from each `cloudPath`; there is no dependency on local cache. A new immutable report registration exists with content hash `18626fcde1c68a9599ab4c8d55290d1e1984db6e14dd13670985ea56e9feace7` and PDF hash `1b7d29eba67d36b21ec9e7d64277777cc65cbad15fbcb4341ddb45589a2ca434`, created 2026-10-02 07:35:18 UTC. No photos are lost.
- Root cause of the earlier 3/21 result: the three photos happened to finish browser decoding while the old report pipeline was rendering; the other valid cloud objects lost the decode race. It was not missing uploads, cache clearing, bad storage paths, or expired URLs: all 21 have confirmed unique cloud paths, while renewable signed URLs are generated on demand.
- Dashboard draft actions now occupy a separate wrapping row below metadata on narrow screens, preventing Resume inspection / Discard draft overlap with the inspection date.
- Signature capture records the signer IP at save time when available; historical signatures without it omit the IP line. E2 wording is the exact always-true bilingual text, titles are capitalised bilingual labels, and the inspector card always uses the real inspector profile name.
- PDF pagination repeats table title/header on continuation pages, prevents a lone table row, uses 20 mm finding thumbnails, pairs 0/1-photo cards, keeps bars/cards/photo rows together, and prints true physical Page X of N in the footer band. Overview includes Keys & Access Cards and Utility Meters where applicable.
- Verification block uses Report ID plus Verification code. The public verification endpoint compares the locally calculated PDF SHA-256 to the immutable registered PDF hash, so an exact file verifies and a one-character-modified copy does not.
- Validation: production build and TypeScript check pass. The current 34-photo synthetic acceptance PDF passes the parser suite: 13 A4 pages, 3,283,294 bytes, 34 independent photos, 19 clauses per language, embedded fonts, no blank body pages, correct sequential footers, no stretched/cross-boundary evidence. Physical-device capture and sending a real recipient email remain operational acceptance checks, not simulated claims.

## First-page cover text repair — 2026-10-03
- Root cause: the PDF renderer stroked the cover-photo crop rectangle before applying the clipping operator. PDF path painting consumes the active path, so the following clip was empty and suppressed all text painted after the cover image on page 1; later pages were unaffected.
- Fix: build the cover crop rectangle with no paint style, apply the clip, and explicitly discard the path before drawing the image. This preserves the portrait crop while allowing the title, summary, property/party details, header and footer text to render normally.
- RPT-MUPJUFH1 was corrected from the supplied PDF without altering its 12-page report content or evidence. Verification found 930 extractable characters on page 1 (previously 0), the cover photo remains visible, required report/property/page text is present, and every page has a non-empty text layer. Production build and TypeScript check pass.

## Inspection/report timestamp semantics — 2026-10-08
- The report header timestamp is explicitly labelled `Generated` and continues to use the immutable completion/report-generation time.
- The cover date and the `Inspection details` start time use the earliest valid timestamp among all captured inspection photos, including photos later excluded from the report; this preserves the actual start of evidence capture rather than making report generation appear to precede signing.
- If a legacy inspection has no valid photo timestamp, the inspection time falls back to the completion/update time so old reports remain renderable.


## Complete app testing audit — 2026-10-13
- Full results are recorded in `docs/COMPLETE_TEST_REPORT_2026-10-13.md`; it lists every executed, failed, blocked, warning, and superseded test attempt.
- Frontend production build/typecheck, backend typecheck/build, Capacitor sync, public route smoke, protected-route smoke with a synthetic local session, report layout/data/hash checks, comprehensive PDF parsing, 32-photo standard export, 32-photo high-entropy export (38.80 MiB), PWA/offline behavior, responsive public pages, production public pages, and unauthenticated API/webhook/admin security gates passed.
- Release blockers/findings: production dependency audit reports critical Capacitor Android/iOS advisories (installed 8.4.1; audit patch >=8.4.3) plus other frontend/tooling advisories; backend audit reports a critical `shell-quote` path and multiple Hono advisories; EdgeSpark dry-run typecheck/build passes but bundle validation still rejects the named factory contract for lacking a default export; common production security headers were absent; public auth/admin forms have label-association/accessibility gaps.
- Environment/authorization limits: Android compilation blocked because Java is unavailable; iOS compilation unavailable on Linux; physical-device camera/share/offline recovery and live authenticated sync/ownership/payment/finalisation/email/account-deletion flows were not claimed without devices, disposable credentials, provider sandboxes, or an approved recipient.


## Production audit remediation — 2026-10-15
- Customer report links no longer derive from the YouBase worker/webhook origin or request `Origin`. All payment-success, report-ready, Stripe success/cancel, and welcome links use the canonical customer app origin `https://app.meinspect.com`; report access consistently uses authenticated `/report/:id`, while public cryptographic verification intentionally remains `/v/:id`. Both production deep-link paths return the SPA shell. A real paid checkout/inbox delivery still requires approved production test credentials after Publish.
- Capacitor Android/iOS/core/CLI are pinned to patched 8.5.3. Frontend build and Android/iOS/combined Capacitor sync pass; focused audit has no Capacitor advisory. Native Android compile remains blocked in this environment because Java is unavailable, and iOS compile requires macOS/Xcode.
- PDF preparation isolates each failed image, logs its photo ID/source/error, renders a visible `Photo unavailable` frame, and continues the rest of the report. Capture encoding verifies JPEG SOI/EOI plus immediate decodability, retries once at lower quality, and rejects a bad capture before persistence. Android WebView `decode()` false negatives retain an `onload`/natural-dimension fallback.
- Backend dependencies are pinned to drizzle-orm 0.45.4, drizzle-kit 0.31.11, Hono 4.13.13, with shell-quote forced to 1.12.0 for both npm and pnpm. Focused audit is clear. Backend code has no child-process/shell or unsafe raw SQL path; user values are passed through Drizzle predicates.
- Added all six audit headers to backend middleware and frontend `public/_headers`. Staging backend returns CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy. Production frontend headers require Publish before live verification.
- EdgeSpark CLI is pinned to 0.0.23. The intended named `createApp(edgespark)` contract is preserved with no default export. `deploy --dry-run` passes bundle validation and route analysis (44 routes), and the backend deploys successfully to staging.
- Authentication accessibility fixes associate labels to all audited inputs, label icon-only/password and country-code controls, label OTP digits, announce errors, and add the missing admin-login `<main>` landmark.
- Report PDF code is loaded on demand. jsPDF and pdf-lib are separate lazy chunks; no emitted JS chunk exceeds 500 kB and the chunk warning is gone.
- Detailed root causes, repairs, validation, and manual production acceptance items: `docs/PRODUCTION_AUDIT_REMEDIATION_2026-10-15.md`.


## Stripe payment/report-unlock remediation — 2026-10-28
- Pre-change restore point: `restore-points/payment-unlock-before-2026-10-28-0439.tar.gz` (SHA-256 `68152566a43970cc8a61a16931bf6f26b5a5db7cb49b770a1d9cd1b086b626e0`).
- Stripe Checkout for web/Android now creates a server pending order tied to the owned report before returning the Checkout URL. Production success/cancel links remain `https://app.meinspect.com/report/<id>`; no worker/staging origin is used.
- `confirmStripeCheckout()` is the shared server authority for signed `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and direct Stripe reconciliation. It accepts only `paid`/`no_payment_required`, validates session/order/report/owner correlation, writes order and `inspections.payment_data`, verifies each write, is idempotent, and throws so Stripe retries on failure.
- Return safety net supports a browser without login using session ID + matching report metadata only; app foreground recovery polls up to 60 seconds. Android handles production `/report/*` links with verified App Links and a `meinspect://report/*` fallback.
- Payment UI has synchronous double-tap protection, loading/error/Retry, browser fallback, `I already paid, check payment`, and sanitized device/runtime failure logging. Auth redirects preserve the report path. Completion/saving is independent of payment; viewing, PDF and email remain gated.
- Stripe receipt email is triggered server-side after authoritative unlock and links to the production report URL. Client email remains only for the separate RevenueCat path/legacy compatibility.
- Read-only 30-day audit script: `scripts/audit-stripe-unlocks.mjs`; detailed statuses/findings: `docs/PAYMENT_UNLOCK_REMEDIATION_2026-10-28.md`. Database-only candidates are not proof of Stripe success; run the script only after explicit approval to query live Stripe.
- Validation: frontend production build/typecheck pass, Android Capacitor sync passes, backend typecheck/dry-run passes with 48 routes. Stripe test-mode and five-device matrix remain unrun because sandbox Stripe secrets and Android emulators/devices are unavailable; never label those PASS.

## HTTP QA continuation — 2026-11-04
- Evidence and the detailed matrix are in `qa/PRODUCTION_QA_2026-11-04.md` and sanitized responses in `qa/resume-2026-11-04/`. No application/dependency/schema/deployment changes were made.
- Production sign-in through `/api/_es/auth/sign-in/email` works with curl and cookies. Python urllib was edge-blocked with 403/1010; never count those responses as application authorization passes.
- Production still allows normal A and tester T to GET admin prices and POST set-tester (200), deletes completed/paid disposable rows (200), and expects the legacy email body. Staging denies A admin/set-tester (403), rejects extra email fields (400), and protects completed marker rows (409). Production and staging share inspection rows; storage environment remains distinct.
- Main QA draft `qa-1793778867-main` retained with three uploaded/confirmed/downloaded synthetic PNGs, three synthetic signatures, and payload strings. No real app-rendered PDF was generated; the renderer requires DOM geometry/canvas, so a separate synthetic PDF must not be passed off as that test.
- Staging Email Report sent one real notification to the approved recipient at 07:57:03 UTC, send ID `01a1a58f-bf0c-71a8-b331-14e76a2a399f`. This was a draft notification, not finalised-report acceptance or verified inbox delivery.
- A balance was 21, became 20 after order 77; repeat checkout did not consume another credit. Do not reset/drain the remaining balance to force Stripe/discount/last-credit branches without approval. T order 78 succeeded free; temporary tester flag revoked. Sessions signed out and cookies/auth payloads removed from retained evidence.
- Android source is version 3.5/code 10, but copied native web assets were absent in the restored workspace; prior sync does not prove a current installed/Play Store release.


## Production readiness attempt — 2026-11-06
- Detailed fresh evidence/status table: `qa/PRODUCTION_READINESS_2026-11-06.md`. Do not reuse older QA status codes as current acceptance.
- No production deployment or database mutation occurred. No supplied QA/owner/tester credentials or retained sessions were available; no accounts created, emails sent, credits deducted, inspections/orders/payments deleted, or tester roles changed.
- Attempted admin wildcard guard was reverted: both typechecks and frontend build passed, backend compiler succeeded but EdgeSpark release validation failed with `Missing required export: default`. Repeating against unchanged baseline failed identically. Preserve the established named `createApp(edgespark)` contract; do not blindly follow the validator's incompatible default-export suggestion. Backend source remains byte-identical to pre-session copy.
- Backend fixes 1/2/3/5 are NOT production-ready or deployed. Existing source still rejects legacy email bodies and uses the database email counter; credit deduction remains read-then-write. Do not promote this backend as if legacy web/v9 email compatibility were fixed. Platform production deployment requires Publish; no production promotion workaround.
- Retained frontend change: `safeReturnTo` accepts only a local absolute path, rejecting double slash, backslashes, schemes, controls, encoded separators and normalized double-slash paths. LoginPage uses the same helper for existing-session and successful-login navigation. Real preview browser executed 26/26 helper cases successfully; actual authenticated redirect NOT RUN without QA credentials.
- Android READ_MEDIA_IMAGES/POST_NOTIFICATIONS removed. Version 3.5/code 10 retained. Both backup files have no cache domain; signing passwords remain environment-only. BUILD_APK.md now documents secure environment signing and current version, with no password defaults. All four keystore files unchanged by hashes.
- Frontend typecheck/build and Android sync passed. 36 copied JavaScript files match the web build: production API base occurs once, staging-- zero times. Copied bundle login page and JS served successfully in a real preview browser; no native compilation/signing/install/Play Store release claimed.
- Fresh production unsigned and wrong-signature Stripe webhook POSTs both returned 400. Other fresh probes were unauthenticated 401 or null session, not normal/tester/owner acceptance. Backend cannot be certified safe based on this run. Web return-path change awaits frontend Publish; Android changes require separate signed store release.

## Phase 1 compatibility/safety — 2026-11-10 (STAGING ONLY, publication blocked)
- Current evidence: `qa/PHASE1_RELEASE_REPORT_2026-11-10.md`; sanitized real HTTP responses, release-only comparison and rollback helper in `qa/phase1-2026-11-10/`. No production promotion occurred.
- **CLI correction supersedes the historical 0.0.23 pin:** explicitly executed 0.0.23 requires a default app/@defs and fails the unchanged named-createApp backend. 0.0.12 validates the unchanged 830.13 KB / 50-route baseline and deploys correctly. Pin 0.0.12 in BOTH root/backend package.json and both lockfile types; do not add a default export, migrate the SDK, or change wrangler config. Historical Nov 3 logs did not record the actually executed CLI version, so a manifest pin alone is not historical execution proof.
- Permanent compatibility rule: POST /api/send-email MUST accept legacy `{to: string|string[], subject, html, from?}` and new `{inspectionId}`. Legacy HTTP-200 provider failure semantics and response fields stay unchanged. Ignore client from. Parser-based sanitization preserves ordinary email styles/tables/links/images and rejects executable markup/URLs/CSS. Existing email_send_events atomically reserves at most 30 recipients per user in a rolling hour; legacy events use empty inspection_id, no schema change. Log each provider result. Rejected sends do not extend quota.
- Recipient restriction is justified by a real live browser capture and the legacy modal: only contact checkboxes, no arbitrary address input. Allow signed-in email and contacts across owned inspections; legacy must never acquire a required inspectionId. Never silently replace the live detailed HTML/PDF email or recipient-selection UI with a fixed notification. Restored EmailReportModal to the legacy implementation in this phase.
- All /api/admin/* routes have an early wildcard guard using ONLY ADMIN_USER_IDS. The supplied QA account (aalekh.dxb@gmail.com, ID 8k5LgKUmGw7faQY8hcsk19iMV9lwepcv) gets staging 403 before/after despite users.is_admin=1. Secret list confirms ADMIN_USER_IDS exists but values are not readable. Owner membership/real allowlisted-owner login is NOT verified; do not add email/is_admin/tester bypasses or claim owner access preserved.
- DELETE inspection checks paid/finalised state plus authoritative order/registered-PDF/payment rows atomically. Payments has ON DELETE CASCADE, so any linked payment blocks physical deletion. Account deletion likewise retains financial/finalised inspection evidence to avoid cascade loss. Never delete orders/payments as cleanup.
- Final backend typecheck/release/50 routes and frontend typecheck/build pass; 36 local SQLite/provider-mock regressions pass (not live acceptance). Real staging old and new email sends each return 200/provider IDs to the approved own address; normal and temporarily tester admin calls return 403, paid/finalised delete 409 and draft delete 200. Real 31-recipient request returns 429; unrelated recipient 403. No provider inbox/stored-HTML or installed-v9 proof.
- Production still fails admin separation (200), paid QA deletion (200) and new-email request (400); legacy captured request sends successfully (200). Production unsigned/wrong-signature Stripe calls each 400; staging each 500 because SANDBOX_STRIPE_WEBHOOK_SECRET missing (unchanged). Old recovery report opens in real browser but warns 106 photos could not be restored: do NOT claim full photo recovery.
- QA created 6 disposable inspections. Retained staging paid/finalised rows qa-20261110-staging-paid and qa-20261110-staging-finalised; all three drafts deleted and production incorrectly deleted its new paid QA row. Tester orders 81/82 retained, amount 0; temporary QA tester role reset to 0; 20 credits unchanged. Existing qa-phase1-email-20261109 was rendered/re-finalised by the live email flow and retained. No account creation/card charge/schema migration/native build or Play Store release.
- Update publishes the entire current frontend and staged backend, not just these routes; native installed assets are NOT updated. Exact previous production deployment revision/rollback selection is unavailable, so cannot certify complete production diff or one-click rollback. Do not advise publishing until owner access and release/rollback identity and failed acceptance are resolved. The provided staging rollback helper restores starting source ONLY and reintroduces legacy-email rejection, so must never be presented as a safe production release.

## Phase 1 restricted safety run — 2026-11-11 (LOCAL ONLY, NOT READY FOR UPDATE)
- Report: `qa/PHASE1_RELEASE_REPORT_2026-11-11.md`; fresh evidence `qa/phase1-2026-11-11/`. Restore ID `phase1-before-2026-11-11-0515`, archive SHA-256 `d9f6809029e25bc0950468872db02e5fb82e4c3587d4f534b6429b1e3cb654ff`. No staging/production deployment, live data mutation, secret change, email send or package update. Prior QA credentials/sessions absent; authenticated acceptance NOT RUN. Phase 2 requires exact PUBLISHED message.
- Current authorization requirement supersedes Nov 10: ADMIN_USER_IDS **OR existing users.is_admin=1** grants admin access; testers/email matches alone do not. Wildcard and route-level checks now await the DB-aware guard. Read-only live SELECT confirms only aalekh.dxb@gmail.com (8k5LgKUmGw7faQY8hcsk19iMV9lwepcv) has is_admin=1, is_tester=0. No role edits.
- Credit path uses existing-column conditional decrement and atomic D1 batch with order INSERT gated by changes()=1, then report unlock. Real local SQLite via Drizzle D1 harness passes last-credit parallel different/same report, multi-credit same report, and rollback on order-insert failure. No shared QA rows created. Stripe checkout creation/discount sections unchanged.
- Webhook signature failure now immediately returns 400 with no Stripe event lookup fallback. Signed missing-report event logs/returns 200 without recreating data. Dummy HMAC handler tests pass paid/no_payment_required, duplicate/concurrent event, delayed write before 200, and write failure -> 500. Production reads StripeSigningSecret; staging reads only SANDBOX_STRIPE_WEBHOOK_SECRET for signing, missing and unchanged. Fresh unchanged staging returns 500 Webhook not configured. Do not claim broad staging isolation: pre-existing getStripeKey fallback can read live STRIPE_SECRET_KEY for checkout, deliberately unchanged under user restriction.
- Existing delete/email code preserved; 36 compatibility assertions and 27 safety assertions passed locally. These are not deployed acceptance. No frontend source changes.
- CLI already pinned 0.0.12 in both manifests/all locks; frozen installs and frontend build/typechecks pass. Initial pinned CLI dry-run passes 50 routes BUT automatically pulls schema metadata even in dry-run (reported no changes). This breached user's no-sync procedure; disclosed in report. Generated schema remains byte-identical. CLI has no skip-schema flag. Do not repeat deploy/dry-run under this restriction or bypass platform deployment safeguards. Final candidate uses offline build + named-export/50-route checks only; full final CLI validation and staging deployment NOT RUN.
- Old 106-photo warning is owner recovery mvuxjr15recovery1 (source mvuxjr15sp5jlpzt), stored created_at 2026-10-30T12:09:56.633Z; warning predates today. 107 ready manifests do not prove stored objects exist. Storage object inventory unavailable without session; missing-file and real-customer counts UNKNOWN. No speculative photo repair.
- Candidate hash manifest identifies local artifacts only. Update is documented as frontend publication/staged backend promotion, but exact platform CLI execution and prior production release ID are unavailable. Candidate NOT staged; do not claim Update will publish today's backend. Local-only rollback helper restores just backend entry and bundle from checksum-verified archive without network/DB operations; production rollback revision cannot be certified.

### Finalization safety action — 2026-11-11
- Platform completion rejected active undeployed backend changes. To avoid violating no-sync/no-publish, preserved the tested candidate entry/bundle/patch in `qa/phase1-2026-11-11/candidate/` and restored active `backend/src/index.ts` and `backend/dist/bundle.js` byte-for-byte from the checksum-verified starting archive. Thus the Nov 11 admin/credit/webhook repairs are **candidate only, NOT active source or staging**. This supersedes any earlier wording implying they remain applied. No deployment or shared-data mutation occurred. Candidate tests and manifest still identify the preserved candidate, not the restored baseline. Exact local restoration completed; no production rollback attempted.

## Candidate staging and real verification — 2026-11-12 (NOT READY FOR UPDATE)
- User now explicitly permits the CLI's schema pull ONLY when it reports `Schema up to date (no changes)` and schema files remain byte-identical after every dry run/deploy. DDL, migrations, changed schema sync/push, schema-file edits and non-QA deletions remain forbidden. Do not ask for more accounts/credentials. Never publish automatically.
- Activated Nov 11 saved candidate with exactly one exception: restored the entire pre-run Stripe webhook section byte-for-byte, plus its `webhook_fallback` source type. Valid evt_ ID retrieval from Stripe, authoritative returned event only, per-use fallback logs and write-before-200 are preserved. Candidate's existing-admin guard and atomic-credit fixes remain. No frontend source/package/config/schema edits.
- Pinned 0.0.12 dry run and staging deployment both succeeded, 50 routes; each reported exact no-changes line and 11 protected schema/generated/migration files byte-identical. Staging deployment reference displayed `1ce7acf2...`; source SHA-256 aa395ac676824dd499edc42cd8e8fc355ae9a326322dbd9cd6f72a7a3c5304e2; bundle SHA-256 0671f15dc119a9c36c55650a7b09ced267275a16ce225b179965222e0955e6f6. Final protected-file check covers 85 unchanged files. Local suites 36 compatibility / 33 safety assertions pass, including mocked authoritative fallback, logging, delayed writes and failure. Both typechecks/frontend build pass.
- Fresh real staging sign-in works, but supplied A is the existing is_admin=1 account; candidate grants A admin prices/set-tester 200/200, FAIL against requested 403/403. Reported immediately; did not change account roles or broaden candidate edits to force passes. Tester T not supplied, so T admin/free-checkout NOT RUN. A remains isTester=0, 20 credits.
- Fresh current-production sign-in, admin 403/403, paid QA DELETE 409, draft DELETE 200, old inspection GET 200, old captured email replay/new-format email 200/200, unsigned/wrong-signature webhook 400/400 all ran. These exercise the already-published backend, NOT the newly staged candidate. Production was not deployed. Webhook negative bodies intentionally have no valid evt_ ID; no live Stripe retrieval was tested. Staging webhook skipped due missing signing secret.
- Staging paid QA DELETE 409, draft DELETE 200, old inspection API GET 200, legacy replay/new email 200/200. Legacy test replays Nov 10's captured live modal payload; fresh browser modal/PDF link validity and old report browser/photos NOT RUN. Four real emails accepted only to approved own address, no inbox claim.
- Shared records created: inspections qa-20261112-staging-draft and qa-20261112-production-draft (both deleted by QA APIs); qa-20261112-staging-paid and qa-20261112-production-paid (retained, synthetic paid marker amount 0, no real charge/order); email_send_events 9298c755-c452-4bd4-9b48-2b93e057298d, ef19bef9-d932-497c-b1f2-67ef6868e17c, d184e0c3-255f-406f-b395-4608d0367fb8, 109b0e2e-7d33-4c92-8a34-49482e93fe10 (retained). Two auth sessions signed out and private cookie files removed. No accounts/orders/payments/storage objects/roles/credits changed beyond listed QA inspection markers and ordinary auth login metadata.
- Report `qa/PHASE1_STAGING_VERIFICATION_2026-11-12.md`, sanitized evidence `qa/phase1-2026-11-12/`. Restore archive `restore-points/phase1-before-2026-11-12.tar.gz`, SHA-256 6af07edb989c53b8e909810a8babb9c6d36e8fdc59c4ded3b9b79c59d4394c44. Local rollback helper restores only starting backend entry/bundle, no deploy/database call; NOT executed. Prior production revision remains unavailable; local restore is not a certified production backup.
- Update, if user clicks and staging remains unchanged, promotes this newly staged backend plus current frontend according to documented platform behavior. This would change A's currently denied production admin access to allowed candidate behavior. Do not recommend Update as passed acceptance. No promotion occurred; post-Update candidate acceptance remains NOT RUN.

## Full QA — 2026-11-13 (STAGING ONLY, NOT READY FOR UPDATE)
- Fresh report: `qa/FULL_APP_QA_2026-11-13.md`; evidence and record ledger: `qa/full-2026-11-13/`. Restore archive `restore-points/full-before-2026-11-13.tar.gz`, SHA-256 `0afbf7206976c4bc37c917e3e0ec5f7f1aca466b3159f8054e25d76dfc106022`. No package/schema/secret updates, charges, production deployment, or order/payment deletion. CLI remains 0.0.12; 11 schema files byte-identical after guarded validation/deployment. Checkout creation/discount block and entire Stripe signature/fallback block byte-identical to start.
- Four verified defects repaired one at a time, with both typechecks/build/related regressions after each: (1) EmailReportModal interpolated names as markup; dynamic fields now HTML-escaped (6 literal-input tests). (2) ReportPage fallback load effect cancelled itself through loading-state dependencies; cloud-only paid reports now open and unknown IDs exit loading (fresh real-staging browser proof). (3) GET download/pdf trusted client-editable pdfUrl, letting B download A's actual QA PDF via B's own inspection; owner-prefix/traversal check now blocks with 403 while true owner remains 200. (4) sw.js cached authenticated API responses across accounts; API/cross-origin requests now bypass shared caches, cache version v5 expires prior cache (executed isolation regression).
- Backend PDF fix staged successfully, deployment reference `39aec344...`; source SHA-256 `6d3b349ca5c31fc78152a254729e46643875241c5fccd671134eeb0bc38c0130`, bundle `40cec6d9dd662e1386bbebca29bdaa4a9e97f918e98dabacfcfec85cae957ff7`. Frontend repairs built but NOT published; native assets not synced or installed.
- Four disposable anonymous accounts named QA Test created (N/B/T/C; full IDs in ledger). Supplied A credentials/session absent; A login/admin-200 NOT RUN, no replacement admin or role bypass. N/T each denied all eight admin routes with 403. T temporary tester restored to 0. C given exactly one credit; parallel checkout 200/409, one order, zero balance, repeat alreadyPaid. All sessions signed out, post-signout API 401; private artifacts removed after testing.
- Real inspections/fields/signatures, three app-route photo uploads + confirmation + hash downloads, owner/other-account guards, sync, move-in reference PDF, draft deletion, paid/finalised 409, legacy/new email and 31st-recipient 429 ran. Real browser PDF finalised and downloaded with matching SHA-256 `da61a14eb25390d26ca09a0c874a1309f1bd7872cf2976abe6861b4acc24b20f`; registered content/PDF verified and unknown hash rejected in API and browser. Real inbox/native camera/device drafts/Stripe-return/Android signing NOT RUN.
- Six real Stripe sessions were live mode due unchanged staging fallback; all expired, no charge. Prices no code 199, WELCOME20 159, LAUNCH50 149, MEINSPECT10 179, INSPECTOR 99, invalid 199; FREE_REPORT uses zero-amount discount order, no Stripe session. Orders 83–92 all retained; paid/finalised reports retained. App orders stay pending after Stripe expiry, not proof of unexpired Stripe sessions.
- Blocking FAIL: staging unsigned/wrong-signature webhook returns 500 Webhook not configured (missing sandbox signing secret); do not modify signature/fallback or secrets to hide this. Local dummy HMAC signed/duplicate/missing-report tests pass only locally. Blocking FAIL: C account DELETE returns 500 after removing app profile and disposable draft; auth identity persists; paid report credit-1 and order 90 retained. Exact auth-platform deletion failure not established, system introspection blocked; no destructive CLI bypass or speculative fix. User needs platform auth deletion diagnostics before real-account use.
- Live production frontend fetch verified 36 JS chunks: production API address once, staging-- zero. Android source 10/3.5, no cache backup domain, signing passwords environment-only. WRITE_EXTERNAL_STORAGE maxSdkVersion 28 is required for legacy Directory.Documents export, not an unused permission; retained. Initial test-harness false failures (shared cookie jar, bridge lifetime, synthetic form submission, invoice/legacy-permission expectations) were corrected and rerun, not counted as app fixes.
- All 50 route gates called fresh (40 authenticated routes, 8 public, 2 webhook); unauthenticated 401 is not positive business-function acceptance. Existing suites 36 compatibility/33 safety plus PDF/text/cache regressions pass. Update would publish current frontend and staged backend including prior staged admin/credit behavior, not just today's fixes. Previous production revision unknown; no certified production rollback. Local rollback helper exists but would restore original security defects. Do not recommend Update as passed acceptance.

Final staging receipt: the identical tested bundle was re-deployed as `a8a177e4...` because platform completion did not recognize the guarded deployment. CLI 0.0.12 again reported Schema up to date (no changes); all 11 protected schema files and the tested bundle remained byte-identical. No publication occurred.
