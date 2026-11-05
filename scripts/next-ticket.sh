#!/usr/bin/env bash
# Reserves the next ticket or spec numbers in the docs repo, so two sessions can't take the same one: pulls, takes the
# highest number in use plus one, commits a stub file per slug and pushes at once; if another session pushed first, it
# drops its commit and tries again with the new numbers. Prints the reserved paths (relative to the checkout), one per
# line, for the caller to fill in, commit and push. Usage: bash scripts/next-ticket.sh [--spec] <slug>...
set -euo pipefail

dir=.scratch
if [ "${1:-}" = "--spec" ]; then dir=docs/specs; shift; fi
[ $# -gt 0 ] || { echo "Usage: bash scripts/next-ticket.sh [--spec] <slug>..." >&2; exit 2; }

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DOCS=$(cd -P "$ROOT/.scratch/.." 2>/dev/null && pwd) || { echo "No .scratch link: run bash scripts/link-docs.sh" >&2; exit 1; }

for attempt in 1 2 3 4 5; do
  git -C "$DOCS" pull -q --rebase --autostash
  last=$(ls "$DOCS/.scratch" "$DOCS/.scratch/.archive" "$DOCS/docs/specs" | grep -oE '^[0-9]+-' | tr -d - | sort -n | tail -1)
  n=$((10#${last:-0}))
  files=()
  for slug in "$@"; do
    n=$((n + 1))
    num=$(printf '%04d' "$n")
    f="$dir/$num-$slug.md"
    printf '# %s: (reserved)\n\n**Status:** needs-triage\n' "$num" >"$DOCS/$f"
    files+=("$f")
  done
  first=${files[0]#"$dir"/}
  git -C "$DOCS" add -- "${files[@]}"
  git -C "$DOCS" commit -q -m "reserve ${first%%-*}$([ $# -gt 1 ] && printf -- '-%04d' "$n")" -- "${files[@]}"
  if git -C "$DOCS" push -q 2>/dev/null; then
    printf '%s\n' "${files[@]}"
    exit 0
  fi
  git -C "$DOCS" reset -q HEAD~1
  (cd "$DOCS" && rm -f -- "${files[@]}")
  echo "Another session pushed first; retrying ($attempt)" >&2
done
echo "Could not reserve a number after 5 tries" >&2
exit 1
