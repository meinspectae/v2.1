# MeInspect Complete Test Report

**Test date:** 2026-10-13  
**Environment:** Linux sandbox, Chromium automation, Node/pnpm, Python/uv  
**Scope:** Frontend, backend, public production deployment, report/PDF engine, PWA/offline behavior, API security boundaries, Capacitor synchronization, static native configuration, dependency security, responsive layout, and accessibility smoke checks.

## Executive result

The application builds and type-checks successfully, its main public pages and synthetic inspection/report workflows work, all tested protected API routes reject unauthenticated requests, PDF validation passes, and a 32-photo high-entropy report remains below the 40 MiB cap.

The audit is **not a clean release pass** because dependency auditing found known vulnerabilities, including critical advisories affecting the installed Capacitor Android/iOS packages. Native compilation could not be executed because Java is unavailable, iOS compilation cannot run on Linux, and live authenticated/payment/email/camera/destructive-account flows require credentials, secrets, payment-provider environments, or physical devices that were not supplied.

### Totals

| Status | Count |
|---|---:|
| Passed test groups | 53 |
| Failed product/release checks | 3 |
| Blocked or not safely executable | 8 |
| Harness/environment attempts superseded by successful reruns | 7 |

## Critical and important findings

### FAIL — vulnerable production dependencies

`pnpm audit --prod` reported **2 critical, 17 high, 7 moderate, and 2 low** vulnerabilities across the root dependency graph.

Most importantly:

- `@capacitor/android@8.4.1` and `@capacitor/ios@8.4.1` are affected by GHSA-rvm3-566m-v7fv; the audit reports patched versions at `>=8.4.3`.
- `react-router-dom@6.30.4` is affected by an open-redirect/XSS advisory; the audit reports `>=6.30.6` as patched.
- `html2pdf.js` resolves to a vulnerable DOMPurify version according to the audit.
- Several high-severity findings are in `@capacitor/cli` transitive tooling (`brace-expansion`, `tar`, and `@xmldom/xmldom`).

### FAIL — vulnerable backend dependencies

The backend production audit reported **1 critical, 7 moderate, and 1 low** vulnerability:

- `drizzle-orm` pulls `shell-quote` with a critical command-injection advisory; patched version reported as `>=1.11.0`.
- `hono@4.12.27` has multiple advisories; the newest listed fixes require `>=4.13.7`.

### FAIL — backend dry-run deployment validator

Backend TypeScript checking and bundling passed, but `pnpm exec edgespark deploy --dry-run` failed bundle validation:

> Missing required export: default.

The same command also warned that local SDK types are stale. This conflicts with the project’s documented injected `createApp(edgespark)` contract and is a platform/tooling compatibility failure, not a TypeScript failure.

### WARNING — missing production security headers

The production homepage returned HTTP 200 and `cache-control: no-cache`, but the response inspection did not find the following headers:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy

### WARNING — accessibility smoke findings

Automated DOM checks found:

- Login: 1 unnamed icon button and 2 inputs without programmatic labels.
- Signup: 1 unnamed icon button and 7 inputs without programmatic labels.
- Forgot password: 1 input without a programmatic label.
- Admin login: 1 input without a programmatic label and no `<main>` landmark.
- Public verification page: no issues in the checks performed.

Visible labels exist in several of these cases, but they are not associated with the controls using `for`/`id`, wrapping labels, or ARIA.

### WARNING — production sample differs from current local sample

The production sample PDF and current local sample are different files:

- Local: 3,195,528 bytes, SHA-256 `9fc54692fcc3d245fe7ed2c940d2311f1fa560a44a0d2fd554590135a0da8a27`
- Production: 3,283,294 bytes, SHA-256 `b766a9c67821acbc48bee8068e1a4e247b8ce5362d73ca9607b7b6c04a497e6d`

This is consistent with the local build not being published, but it means production is not serving the exact local artifact tested in this run.

## Complete test results

### A. Installation, type checking, and builds

| # | Test | Result | Observed result |
|---:|---|---|---|
| 1 | Root dependency install with frozen lockfile | PASS | 628 packages installed; lockfile accepted. |
| 2 | Frontend TypeScript check | PASS | `pnpm exec tsc --noEmit -p tsconfig.app.json` exited 0. |
| 3 | Frontend production build | PASS | 965 modules transformed; production assets generated. |
| 4 | Build chunk-size check | WARNING | Build succeeded, but the report chunk exceeded the 500 kB warning threshold. |
| 5 | Backend dependency install with frozen lockfile | PASS | Backend dependencies installed successfully. |
| 6 | Backend TypeScript check | PASS | `pnpm exec tsc --noEmit -p backend/tsconfig.json` exited 0. |
| 7 | Backend EdgeSpark type-check and bundle build | PASS | Dry run reported “Type check passed” and “Build completed.” |
| 8 | Backend EdgeSpark bundle validation | FAIL | Validator rejected the named factory contract and demanded a default export. |
| 9 | Root release HTML asset references | PASS | All 7 root-relative references in the generated HTML resolve to existing files. |
| 10 | Release HTML localhost scan | PASS | No localhost or 127.0.0.1 URLs in web, Android, or iOS release HTML. |
| 11 | JSON configuration parse | PASS | Public manifest, YouWare manifest, and Capacitor config parsed successfully. |

### B. Native/Capacitor packaging

| # | Test | Result | Observed result |
|---:|---|---|---|
| 12 | Capacitor synchronization | PASS | Web assets copied and 9 plugins synchronized to both Android and iOS. |
| 13 | Native web-bundle completeness | PASS | Both native bundles contain index, manifest, service worker, logo, and sample PDF. |
| 14 | Capacitor identity consistency | PASS | App ID, app name, web directory, and server settings match root/Android/iOS configs. |
| 15 | Native launcher/store image dimensions | PASS | Logo 512×512, source icon 1024×1024, Play icon 512×512, feature graphic 1024×500. |
| 16 | Android lint/unit/assemble | BLOCKED | Gradle could not run because Java/JAVA_HOME is unavailable in the environment. |
| 17 | iOS native compilation | BLOCKED | Xcode/iOS compilation is unavailable on Linux. |
| 18 | Physical-device camera, permissions, sharing, and force-close recovery | BLOCKED | Requires Android/iOS hardware or simulators not present in this environment. |

### C. Public pages and form behavior

| # | Test | Result | Observed result |
|---:|---|---|---|
| 19 | Login page render | PASS | Heading, Google option, email/password fields, forgot password, signup, and sample report controls rendered. |
| 20 | Empty login validation | PASS | Displayed “Please enter both email and password.” |
| 21 | Invalid login rejection | PASS | Remained on login and displayed “Invalid email or password.” |
| 22 | Signup page render | PASS | All signup controls and country/city selectors rendered. |
| 23 | Empty signup validation | PASS | Seven required-field messages appeared and eight controls received error styling. |
| 24 | Signup city dependency | PASS | City remained disabled until a country is selected. |
| 25 | Forgot-password empty validation | PASS | Displayed “Please enter your email address.” |
| 26 | Public verification empty-hash validation | PASS | Displayed the complete 64-character hash requirement. |
| 27 | Public verification invalid file validation | PASS | A PNG upload was rejected with “Choose a PDF up to 40 MB.” |
| 28 | Public verification nonmatching hash | PASS | Valid-format zero hash returned “Not verified.” |
| 29 | Admin wrong-secret rejection | PASS | Displayed incorrect-password message and did not reveal admin content. |
| 30 | Unknown/protected route redirects | PASS | Unauthenticated protected and catch-all routes returned to login. |
| 31 | Dashboard synthetic-session smoke | PASS | Dashboard and empty inspection state rendered without error boundary. |
| 32 | New-inspection property types | PASS | Apartment, townhouse, villa, and office options rendered; Start initially disabled. |
| 33 | New-inspection selection | PASS | Selecting Apartment enabled room controls and Start action. |
| 34 | Inspection wizard creation | PASS | Synthetic inspection created and `/inspect` rendered details plus all generated room steps. |
| 35 | Protected route component smoke | PASS | Dashboard, History, Settings, Payments, and New pages rendered without error boundary or horizontal overflow using a local synthetic session. |
| 36 | Real authenticated cloud workflows | BLOCKED | No user credentials/session were provided; no production customer account was modified. |
| 37 | Signup/email-verification success flow | BLOCKED | Avoided creating a live account or sending unsolicited mail. |
| 38 | Password-reset OTP success flow | BLOCKED | Requires a real mailbox and live OTP. |

### D. Responsive behavior

The following public routes were tested at **375×812**, **768×1024**, and **1440×900**:

- Login
- Signup
- Forgot password
- Public report verification
- Admin login

| # | Test | Result | Observed result |
|---:|---|---|---|
| 39 | Public route horizontal overflow matrix | PASS | 15/15 route/viewport combinations had no horizontal overflow. |
| 40 | Protected route horizontal overflow smoke | PASS | Dashboard, History, Settings, Payments, and New pages had no horizontal overflow in the tested viewport. |

### E. Inspection data and report logic

| # | Test | Result | Observed result |
|---:|---|---|---|
| 41 | Deleted rooms/items and duplicate merge harness | PASS | 1 room, 3 items, 2 rated, 1 Fair, 1 Issue; removed entities stayed excluded. |
| 42 | Default property template deduplication | PASS | Apartment/townhouse/villa/office templates contained no duplicate names or forbidden default carpet/wallpaper/ceiling-fan items. |
| 43 | Optional-section omission | PASS | Empty utility/move-in sections were omitted. |
| 44 | Optional-section values | PASS | Meter and move-in values rendered when populated and disappeared when cleared. |
| 45 | Legal clause count | PASS | 19 English and 19 Arabic clauses confirmed. |
| 46 | Arabic direction and font | PASS | RTL direction and Noto Naskh Arabic font confirmed. |
| 47 | Full-content hash coverage | PASS | 64-character hash changed when report notes changed. |
| 48 | Layout bilingual wording | PASS | Exact 19/19 bilingual clauses matched configuration. |
| 49 | Layout photo rows | PASS | Evidence stayed within row boundaries. |
| 50 | Layout orphan protection | PASS | No orphan room bars detected by fixture algorithm. |
| 51 | Rendering immutability | PASS | Rendering did not mutate inspection input or alter its content hash. |
| 52 | No-findings variant | PASS | Bilingual no-findings line rendered. |
| 53 | Filled-meter variant | PASS | Meter reading and meter photo rendered. |
| 54 | Standard 32-photo synthetic export | PASS | 32 photos, max edge 2000 px, 1,201,730-byte PDF (1.15 MiB), no photo data URLs in local metadata. |
| 55 | High-entropy 32-photo stress export | PASS | 40,689,866-byte PDF (38.80 MiB), below the 40 MiB limit; no photo data URLs persisted. |
| 56 | Real camera sharpness/EXIF/orientation | BLOCKED | Synthetic images cannot prove physical camera quality or device EXIF/orientation behavior. |

### F. PDF parser and artifact checks

| # | Test | Result | Observed result |
|---:|---|---|---|
| 57 | Comprehensive fixture PDF parser | PASS | 13 A4 pages, 3,283,294 bytes, 34 independent photos, 19 clauses/language, embedded fonts, searchable Arabic, no blank body pages, correct image bounds/aspect ratios, 4:2:0 JPEGs. |
| 58 | Public sample PDF smoke | PASS | 14 A4 pages; every page had text. |
| 59 | Phase-A PDF smoke | PASS | 8 A4 pages; every page had text. |
| 60 | Main test report PDF smoke | PASS | 13 A4 pages; every page had text. |
| 61 | Corrected customer-style report smoke | PASS | 12 A4 pages; every page had text. |
| 62 | Local sample HTTP delivery | PASS | HTTP 200, `application/pdf`, correct `%PDF-` signature. |

### G. PWA, offline, and assets

| # | Test | Result | Observed result |
|---:|---|---|---|
| 63 | Service-worker syntax | PASS | Public and built service workers passed Node syntax checking. |
| 64 | Manifest fields and icon targets | PASS | Required fields exist and icon URLs resolve after stripping cache query strings. |
| 65 | Offline shell reload | PASS | Login shell remained available after switching browser offline. |
| 66 | Offline connectivity banner | PASS | Live offline event displayed “No Internet Connection — Please check your network.” |
| 67 | Synced asset identity | PASS | Built and native index files have matching byte sizes/content origin. |

### H. Backend/API security boundaries

| # | Test | Result | Observed result |
|---:|---|---|---|
| 68 | Protected API route matrix | PASS | 31/31 tested profile, inspection, sync, storage, payment, order, admin, and notification endpoints returned 401 without auth. |
| 69 | RevenueCat webhook without secret | PASS | Returned 401 Unauthorized. |
| 70 | Stripe webhook without signature/secret | PASS | Returned 400 “Missing signature or secret.” |
| 71 | Public admin users without secret | PASS | Returned 403 Unauthorized. |
| 72 | Public verification malformed hash | PASS | Returned 400 with full SHA-256 requirement. |
| 73 | Public verification unknown valid hash | PASS | Returned HTTP 200 with `verified:false`. |
| 74 | Public welcome notification unknown email | PASS | Returned success false / `not_registered`; did not send mail. |
| 75 | Public password-changed notification unknown email | PASS | Returned success false / `not_registered`; did not send mail. |
| 76 | Public notification missing email | PASS | Both routes returned 400 “email is required.” |
| 77 | Native mobile OAuth bootstrap | PASS | Public Google bootstrap returned HTTP 200 HTML. |
| 78 | Native CORS preflight | PASS | HTTP 204; allowed `capacitor://localhost`, credentials, and expected methods. |
| 79 | Staging/production public verification parity | PASS | Both environments returned `verified:false` for the same unknown valid hash. |
| 80 | Ownership/IDOR with two authenticated users | BLOCKED | Requires two controlled authenticated accounts; unauthenticated gate was verified only. |
| 81 | Account deletion | BLOCKED | Destructive and unsafe to run without a dedicated disposable verified account. |
| 82 | Finalisation/payment/webhook success | BLOCKED | Would mutate immutable/payment records and requires provider secrets or sandbox transactions. |
| 83 | Real email delivery | BLOCKED | No approved recipient was supplied; only safe rejection behavior was tested. |

### I. Production deployment smoke

| # | Test | Result | Observed result |
|---:|---|---|---|
| 84 | Production public route HTTP checks | PASS | Root, login, signup, forgot password, verification, sample PDF, and manifest all returned 200. |
| 85 | Production browser render | PASS | Login, signup, and verification pages rendered without horizontal overflow. |
| 86 | Production protected route redirect | PASS | `/history` redirected to `/login` when unauthenticated. |
| 87 | Production sample MIME type | PASS | Returned `application/pdf`. |
| 88 | Production security headers | FAIL | Common security headers listed above were absent from the inspected response. |
| 89 | Production/local sample parity | WARNING | Files differ; production serves the 3,283,294-byte fixture rather than the current local 3,195,528-byte sample. |

### J. Dependency security

| # | Test | Result | Observed result |
|---:|---|---|---|
| 90 | Frontend/root production dependency audit | FAIL | 2 critical, 17 high, 7 moderate, 2 low. |
| 91 | Backend production dependency audit | FAIL | 1 critical, 7 moderate, 1 low. |

## Superseded harness/environment attempts

These attempts are recorded for completeness but are not product failures when a successful rerun exists:

1. Initial PDF parser run failed because PyMuPDF was not installed. Rerun through `uv` installed isolated dependencies and passed.
2. Initial Android Gradle command was issued from the project root and could not find `./gradlew`; corrected to the Android wrapper, which then exposed the real Java-unavailable block.
3. Initial Chromium launch failed due sandbox namespace restrictions; rerun with `--no-sandbox,--disable-dev-shm-usage` succeeded.
4. Lightpanda launch failed because the binary is not installed; Chromium was used successfully instead.
5. A parallel browser batch exhausted sandbox process/memory limits (exit 137); sessions were closed and tests rerun sequentially successfully.
6. `phase2-check.js` initially ran against the sample fixture, which intentionally contains optional sections, and correctly rejected it. It was rerun against the dedicated inspection harness and passed.
7. The stress harness initially lacked a report DOM and failed on a null clone target. The prerequisite report route was created, then the stress test passed at 38.80 MiB.

## Release recommendation

**Do not treat this run as an unconditional release approval.** Before release:

1. Upgrade patched Capacitor Android/iOS versions and address the remaining audited dependency advisories.
2. Upgrade backend Hono and resolve the critical `shell-quote` dependency path.
3. Resolve the EdgeSpark dry-run contract/type mismatch and obtain a successful bundle validation.
4. Add production security headers.
5. Fix public-form label associations and unnamed icon buttons.
6. Run Android lint/unit/assemble with Java, build iOS in Xcode, and complete physical-device camera/offline/share testing.
7. Run controlled authenticated end-to-end tests for sync, ownership, payment, report finalisation, email, and account deletion using disposable test accounts and provider sandboxes.
