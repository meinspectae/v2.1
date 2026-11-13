#!/bin/sh
# Restores this session's STARTING code to staging only. Never promotes production.
# WARNING: starting backend rejects legacy email. Do NOT publish this rollback.
set -eu
if [ ! -f qa/phase1-2026-11-10/restore/backend-before.ts ]; then
  printf '%s\n' 'Run from the project root; restore files not found.' >&2
  exit 1
fi
cp qa/phase1-2026-11-10/restore/backend-before.ts backend/src/index.ts
cp qa/phase1-2026-11-10/restore/EmailReportModal-before.tsx src/components/EmailReportModal.tsx
# Keep the compatible CLI pin; the original 0.0.23 pin cannot validate this entry.
pnpm install --frozen-lockfile
pnpm --dir backend install --frozen-lockfile
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm run build
(cd backend && pnpm exec tsc --noEmit && pnpm exec edgespark deploy --dry-run && pnpm exec edgespark deploy)
printf '%s\n' 'Starting code restored to STAGING ONLY. No production deployment or database rollback performed.'
