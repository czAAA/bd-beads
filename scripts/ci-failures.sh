#!/usr/bin/env bash
# Lists the failed jobs of a pull request's latest CI run and the failed tests in each.
# Usage: bash scripts/ci-failures.sh <pr-number>
set -euo pipefail
pr="${1:?usage: ci-failures.sh <pr-number>}"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
gh pr checks "$pr" --json name,state,link --jq '.[] | select(.state=="FAILURE") | [.name, .link] | @tsv' |
  while IFS=$'\t' read -r name link; do
    echo "== $name"
    job="${link##*/}"
    gh api --allow-escape-sequences "repos/$repo/actions/jobs/$job/logs" 2>/dev/null |
      sed 's/\x1b\[[0-9;]*m//g' |
      grep -E "✘|^\S+ +[0-9]+\) |Error:|pixels|Expected" | cut -c1-240 | head -25 || true
  done
