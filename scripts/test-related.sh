#!/usr/bin/env bash
# Tests related to the files named, without the App.*.test.ts files (the App imports everything, so almost any
# UI change would pull in all of them). An App test file named on the command line is run as well.
# Output is Vitest's `agent` reporter with passed tests silenced: a green run prints a few lines.
# Also every test that reads source as text, which `vitest related` (imports only) can't see: each that walks a folder
# (`scopedGlobal`) and each whose text names a changed file (docs/testing.md, Running them).
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
if [ ${#sources[@]} -gt 0 ]; then
  readers=$(git ls-files --cached --others --exclude-standard 'src/*.test.ts' 'scripts/*.test.ts' 'worker/*.test.ts' | grep -vE '(^|/)App(\.[^/]*)?\.test\.ts$' |
    xargs grep -lE 'readdirSync|globSync|readFileSync' 2>/dev/null)
  extra=$(echo "$readers" | xargs grep -lE 'readdirSync|globSync' 2>/dev/null)
  for file in "${sources[@]}"; do
    name=$(basename "$file")
    case "$name" in *.test.ts) continue ;; esac
    extra+=$'\n'$(echo "$readers" | xargs grep -lF "$name" 2>/dev/null)
  done
  while IFS= read -r test; do [ -n "$test" ] && sources+=("$test"); done < <(echo "$extra" | sort -u)
fi
status=0
if [ ${#sources[@]} -gt 0 ]; then
  SKIP_APP_TESTS=1 npx vitest related --run "${quiet[@]}" "${sources[@]}" || status=$?
fi
if [ ${#apps[@]} -gt 0 ]; then
  npx vitest run "${quiet[@]}" "${apps[@]}" || status=$?
fi
exit $status
