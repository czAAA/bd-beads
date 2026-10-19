#!/usr/bin/env bash
# The full unit suite, before a pull request opens, on a machine that can afford it; elsewhere CI's job (docs/testing.md).
# Capable = at least 8 cores and 8 GB (available on Linux, total on macOS; the suite peaks near 2 GB). Override: BD_FULL_TESTS=1 forces the run, =0 skips it.
set -uo pipefail
if [ "$(uname)" = Darwin ]; then
  cores=$(sysctl -n hw.ncpu)
  avail_gb=$(( $(sysctl -n hw.memsize) / 1073741824 )) # macOS has no MemAvailable; total RAM stands in
else
  cores=$(nproc)
  avail_gb=$(awk '/MemAvailable/ { print int($2 / 1048576) }' /proc/meminfo 2>/dev/null || echo 0)
fi
mode=${BD_FULL_TESTS:-auto}
if [ "$mode" = auto ]; then
  if [ "$cores" -ge 8 ] && [ "${avail_gb:-0}" -ge 8 ]; then mode=1; else mode=0; fi
fi
if [ "$mode" != 1 ]; then
  echo "skip full unit suite (${cores} cores, ${avail_gb} GB free): CI runs it on the pull request"
  exit 0
fi
exec npx vitest run --reporter=agent --silent=passed-only
