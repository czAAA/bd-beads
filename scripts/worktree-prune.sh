#!/usr/bin/env bash
# Removes the stale worktrees of this repo (skill bd-worktree). A worktree is about 620 MB, nearly all node_modules:
# left behind after their PRs merge, they fill the disk.
#
# A worktree is stale, and is removed together with its local branch, when all of these hold:
#   - its branch has a merged PR and no open one;
#   - HEAD is that PR's last commit or an ancestor of it: nothing was committed after the merge;
#   - it holds no uncommitted or untracked file (ignored files such as node_modules and dist don't count);
#   - no process runs from inside it. A tailnet server left serving a merged branch is stopped first.
# Everything else is kept and named with the reason: no PR, an open PR, a PR closed without merging, a detached HEAD,
# a locked worktree. The main checkout is never touched, and neither are remote branches.
#
# Usage: bash scripts/worktree-prune.sh [--dry-run]     from the main checkout or any worktree
#   --dry-run   print what would be removed, remove nothing
#
# Prints one line per worktree and a total, and exits 0:
#   removed  bd-beads-1013 (PR #751 merged)
#   kept     bd-beads-1016: PR #760 is open
#   removed 1, kept 1
# Exits 1, having removed nothing, when gh is missing or GitHub can't be reached.
set -euo pipefail

dry=0
case "${1:-}" in
  "") ;;
  --dry-run) dry=1 ;;
  *) echo "usage: bash scripts/worktree-prune.sh [--dry-run]" >&2; exit 2 ;;
esac

main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
cd "$main"
command -v gh >/dev/null || { echo "gh not found: nothing removed" >&2; exit 1; }
gh repo view --json name >/dev/null 2>&1 || { echo "can't reach GitHub (gh): nothing removed" >&2; exit 1; }
git worktree prune # forget worktrees whose folder is already gone

# path<TAB>head<TAB>branch<TAB>locked, one line per worktree
worktrees=$(git worktree list --porcelain | awk '
  function out() { if (p != "") print p "\t" h "\t" (b == "" ? "@detached" : b) "\t" l; p = "" }
  /^worktree / { out(); p = substr($0, 10); h = ""; b = ""; l = 0 }
  /^HEAD /     { h = $2 }
  /^branch /   { b = substr($0, 8); sub("^refs/heads/", "", b) }
  /^locked/    { l = 1 }
  END          { out() }')

# cwd<TAB>pid<TAB>command of every process of this user
processes() {
  if command -v lsof >/dev/null; then
    lsof -d cwd -Fpcn 2>/dev/null | awk '
      /^p/ { pid = substr($0, 2) } /^c/ { cmd = substr($0, 2) } /^n/ { print substr($0, 2) "\t" pid "\t" cmd }' || true
  else
    for d in /proc/[0-9]*; do
      cwd=$(readlink "$d/cwd" 2>/dev/null) || continue
      printf '%s\t%s\t%s\n' "$cwd" "${d#/proc/}" "$(cat "$d/comm" 2>/dev/null)"
    done
  fi
}
# The first process running from inside $1, as "command (pid N)"; empty when there is none.
user_of() {
  processes | awk -F'\t' -v wt="$1" '!found && ($1 == wt || index($1, wt "/") == 1) { print $3 " (pid " $2 ")"; found = 1 }'
}

removed=0
kept=0
keep() { echo "kept     $name: $1"; kept=$((kept + 1)); }

while IFS=$'\t' read -r wt head br locked; do
  [ -n "$wt" ] && [ "$wt" != "$main" ] || continue
  name=$(basename "$wt")
  [ "$locked" = 0 ] || { keep "locked"; continue; }
  [ "$br" != "@detached" ] || { keep "no branch (detached HEAD)"; continue; }

  status=$(git -C "$wt" status --porcelain 2>/dev/null) || { keep "git status failed there"; continue; }
  [ -z "$status" ] || { keep "$(wc -l <<<"$status" | tr -d ' ') uncommitted or untracked file(s)"; continue; }

  if ! prs=$(gh pr list --head "$br" --state all --json number,state,headRefOid \
    --jq '.[] | "\(.state) \(.number) \(.headRefOid)"' 2>/dev/null); then
    keep "GitHub didn't answer for branch $br"
    continue
  fi
  [ -n "$prs" ] || { keep "no PR"; continue; }
  open=$(awk '$1 == "OPEN" { print $2; exit }' <<<"$prs")
  [ -z "$open" ] || { keep "PR #$open is open"; continue; }
  merged=$(awk '$1 == "MERGED" { print $2, $3 }' <<<"$prs")
  [ -n "$merged" ] || { keep "PR #$(awk '{ print $2; exit }' <<<"$prs") was closed without merging"; continue; }

  pr=""
  while read -r number oid; do
    # The PR's last commit may have been pushed from elsewhere (GitHub's "Update branch"): get it before comparing.
    git cat-file -e "$oid^{commit}" 2>/dev/null || git fetch -q origin "$oid" 2>/dev/null || true
    if git merge-base --is-ancestor "$head" "$oid" 2>/dev/null; then pr=$number; break; fi
  done <<<"$merged"
  [ -n "$pr" ] || { keep "commits made after PR #$(awk '{ print $1; exit }' <<<"$merged") merged"; continue; }

  if [ "$dry" = 0 ] && [ -f "$wt/node_modules/.cache/tailnet" ]; then
    (cd "$wt" && bash scripts/tailnet.sh stop >/dev/null 2>&1) || true # its PR is merged: nothing left to verify
  fi
  user=$(user_of "$wt")
  [ -z "$user" ] || { keep "in use by $user"; continue; }

  if [ "$dry" = 1 ]; then
    echo "would remove  $name (PR #$pr merged)"
    removed=$((removed + 1))
    continue
  fi
  if ! err=$(git worktree remove "$wt" 2>&1); then
    keep "git refused: $err"
    continue
  fi
  git branch -q -D "$br" 2>/dev/null || true
  echo "removed  $name (PR #$pr merged)"
  removed=$((removed + 1))
done <<<"$worktrees"

if [ "$dry" = 1 ]; then echo "would remove $removed, would keep $kept"; else echo "removed $removed, kept $kept"; fi
