#!/usr/bin/env bash
# The cheap gate before pushing: typecheck, lint and knip, silent on success.
# On failure it prints only the failing step's last 40 lines, not the whole log.
# Unit tests are not in here: run `npx vitest related --run <files>` (docs/testing.md).
set -u
failed=0
for step in typecheck lint knip; do
  if out=$(npm run --silent "$step" 2>&1); then
    echo "ok   $step"
  else
    failed=1
    echo "FAIL $step"
    echo "$out" | tail -n 40
  fi
done
exit "$failed"
