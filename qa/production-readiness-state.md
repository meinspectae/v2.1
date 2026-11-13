# Production readiness — 6 November 2026

## Constraints and evidence policy
- No user input requested. Never print secrets, credential bodies, cookies, signing defaults, or private keys.
- Work one problem at a time. After each candidate: frontend/backend typechecks and builds, followed by a fresh production HTTP probe (preview for frontend). Authenticated acceptance is NOT RUN without existing QA credentials; unauthenticated 401 is not a substitute for normal/tester 403.
- Platform restricts production deployment to Publish; no production promotion or workaround will be attempted. Production changes and rollback are therefore NOT RUN. No new backend deployment is planned without the required acceptance gates.
- Existing source already contains per-route ADMIN_USER_IDS checks, a basic delete guard, and an inspectionId-only email route. These differ from the historically reported production version.
- Current session: no supplied QA/owner/tester credentials or retained cookies found in the documented environment locations. No accounts will be invented or sessions minted.
- Baseline restore copies will be kept locally so each candidate can be independently reverted. No keystore files may be changed/deleted.

## Sequence
1. Admin wildcard authorization guard
2. Delete protection at time of deletion
3. Temporary legacy email compatibility and in-memory recipient limit
4. Safe login return path
5. Conditional credit deduction
6. Android release checks and sync
7. Fresh production checks and final evidence report

## Problem 1 outcome
- Added a wildcard ADMIN_USER_IDS guard, ran both typechecks and frontend build successfully.
- Backend compiler succeeded, but release validation failed: `Missing required export: default`. Existing project contract requires named `createApp(edgespark)` and explicitly forbids replacing it with a default app export.
- Reverted ONLY the wildcard guard. Re-ran baseline checks: same release-validation failure. This establishes a pre-existing release blocker, not a regression from the guard.
- Fresh production unauthenticated probes: prices 401, cf-ray a562153d69d8c654-PDX; set-tester 401, cf-ray a56215408c848864-PDX. These do NOT test normal/tester authorization.
- No production deployment. Owner-account access NOT RUN: no owner session available.

## Problems 2, 3 and 5
- NOT RUN / no candidate retained: shared backend release gate fails on unchanged baseline, production deployment is restricted, and no QA credentials are available. Do not silently replace the entrypoint contract, create QA accounts, forge auth sessions, drain credits, or claim local mocks as production acceptance.
- Existing delete guard remains unchanged; it checks paid/completed markers before deletion (not atomically).
- Existing email route remains inspectionId-only with a database-backed rate counter; requested temporary legacy compatibility and memory counter are NOT implemented.
- Existing credit path remains read-then-write. No eligible authenticated one-credit QA account is available; live race NOT RUN.
