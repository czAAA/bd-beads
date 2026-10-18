#!/usr/bin/env bash
# Links the private docs repo (bd-beads-docs, next to this checkout) into this tree at the original paths (gitignored
# links). Safe to run again; never replaces a real file or folder (reports it, exits 1). Usage: bash
# scripts/link-docs.sh [DOCS_NAME=bd-beads-docs]
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PARENT=$(dirname "$ROOT")
DOCS_NAME=${DOCS_NAME:-bd-beads-docs}
DOCS="$PARENT/$DOCS_NAME"
PATHS=(.scratch docs/adr docs/research docs/specs docs/operations.md reports research_notes)

if [ ! -d "$DOCS/.git" ]; then
  echo "No docs repo at $DOCS. Clone it next to this checkout:"
  echo "  git clone git@github.com:czAAA/bd-beads-docs.git \"$DOCS\""
  exit 1
fi

failed=0
for p in "${PATHS[@]}"; do
  link="$ROOT/$p"
  # one "../" per folder of $p, then out of the checkout: works from every sibling worktree
  up=$(printf '../%.0s' $(seq 0 $(( $(grep -o / <<<"$p" | wc -l) ))))
  want="${up}${DOCS_NAME}/$p"
  if [ ! -e "$DOCS/$p" ]; then
    echo "skip   $p (not in $DOCS_NAME)"
    continue
  fi
  if [ -L "$link" ]; then
    if [ "$(readlink "$link")" = "$want" ]; then
      echo "ok     $p"
      continue
    fi
    rm "$link"
  elif [ -e "$link" ]; then
    echo "REFUSE $p is a real file or folder here; move it away first"
    failed=1
    continue
  fi
  mkdir -p "$(dirname "$link")"
  ln -s "$want" "$link"
  echo "linked $p -> $want"
done
exit "$failed"
