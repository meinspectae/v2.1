#!/bin/bash
set -u
step="$1"
out="/workspace/qa/readiness-2026-11-06"
check() {
  label="$1"; shift
  if "$@" > "$out/$step-$label.txt" 2>&1; then
    printf '%s %s PASS exit=0\n' "$step" "$label"
  else
    rc=$?
    printf '%s %s FAIL exit=%s (see retained log)\n' "$step" "$label" "$rc"
    exit "$rc"
  fi
}
check frontend-typecheck pnpm exec tsc --noEmit -p tsconfig.app.json
check backend-typecheck pnpm --dir backend exec tsc --noEmit
check frontend-build pnpm run build
check backend-build bash -c 'cd /workspace/backend && ../node_modules/.bin/edgespark deploy --dry-run'
