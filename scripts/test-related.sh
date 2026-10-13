#!/usr/bin/env bash
# Tests related to the files named, without the App.*.test.ts files (the App imports everything, so almost any
# UI change would pull in all of them). An App test file named on the command line is run as well.
# Output is Vitest's `agent` reporter with passed tests silenced: a green run prints a few lines.
set -uo pipefail
quiet=(--reporter=agent --silent=passed-only)
sources=()
apps=()
for arg in "$@"; do
  case "$arg" in
    src/App.test.ts | src/App.*.test.ts) apps+=("$arg") ;;
    *) sources+=("$arg") ;;
  esac
done
status=0
if [ ${#sources[@]} -gt 0 ]; then
  SKIP_APP_TESTS=1 npx vitest related --run "${quiet[@]}" "${sources[@]}" || status=$?
fi
if [ ${#apps[@]} -gt 0 ]; then
  npx vitest run "${quiet[@]}" "${apps[@]}" || status=$?
fi
exit $status
