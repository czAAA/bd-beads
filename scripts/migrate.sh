#!/usr/bin/env bash
# Moves this machine from the old single-repo checkout to the two-repo layout (ADR 0047):
#   <parent>/bd-beads        public, code only (a new history)
#   <parent>/bd-beads-docs   private: tickets, ADRs, specs, research; linked into bd-beads by scripts/link-docs.sh
#
# Local and per-machine; safe to run again (a finished machine only re-links and pulls). Deletes nothing it cannot
# recover: the old checkout is renamed to bd-beads.old2, merged worktrees are removed (their work is in `pre-split`),
# and every unmerged branch and every uncommitted change is saved as a patch first.
#
# Usage: bash scripts/migrate.sh [path-to-old-checkout]    (default: <parent of this script's checkout>/bd-beads)
# Env:   NEW_URL, DOCS_URL (remotes), SKIP_NPM=1 (no npm ci)
set -euo pipefail

NEW_URL=${NEW_URL:-git@github.com:czAAA/bd-beads.git}
DOCS_URL=${DOCS_URL:-git@github.com:czAAA/bd-beads-docs.git}
# Paths that live in the docs repo (the rest of an old checkout's untracked files belong to the code repo).
PRIVATE_RE='^(\.scratch|docs/(adr|research|specs|design/referances)|reports|research_notes|hover-text-audit\.md|docs/deploy\.md|\.github/workflows/deploy\.yml)(/|$)'

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Unfinished merge, rebase, cherry-pick or revert, or unmerged paths, in a checkout or worktree.
unfinished() {
  local wt=$1 g
  g=$(git -C "$wt" rev-parse --absolute-git-dir)
  for f in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
    [ -e "$g/$f" ] && return 0
  done
  [ -n "$(git -C "$wt" ls-files -u | head -1)" ]
}

# True when everything a branch changed is already in $pre: the branch is an ancestor of it, or it was squash-merged
# (its diff applies in reverse to $pre's tree). Errs towards "not merged": a branch edited since stays unmerged.
merged_into() {
  local old=$1 pre=$2 b=$3 d idx rc=1
  git -C "$old" merge-base --is-ancestor "$b" "$pre" && return 0
  d=$(mktemp); idx=$(mktemp -u)
  git -C "$old" diff --binary "$pre...$b" > "$d"
  if [ ! -s "$d" ]; then
    rc=0
  elif GIT_INDEX_FILE="$idx" git -C "$old" read-tree "$pre" 2>/dev/null \
      && GIT_INDEX_FILE="$idx" git -C "$old" apply --cached --check --reverse "$d" 2>/dev/null; then
    rc=0
  fi
  rm -f "$d" "$idx"
  return "$rc"
}

main() {
  local here parent old new docs out pre
  here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
  old=${1:-$(dirname "$here")/bd-beads}
  [ -d "$old" ] && old=$(cd "$old" && pwd)
  parent=$(dirname "$old")
  new="$parent/bd-beads"
  docs="$parent/bd-beads-docs"
  out="$HOME/bd-beads-migrate-$(date +%Y%m%d-%H%M%S)"

  local is_old=0
  if [ -d "$old/.git" ] && [ -n "$(git -C "$old" ls-files .scratch docs/adr | head -1)" ]; then is_old=1; fi

  if [ "$is_old" = 1 ]; then
    [ ! -e "$old.old2" ] || die "$old.old2 already exists; move it away first"
    [ ! -e "$new.tmp" ] || die "$new.tmp already exists; move it away first"
    [ "$old" = "$new" ] || [ ! -e "$new" ] || die "$new already exists and is not the old checkout; move it away first"
    say "== 1. Checks"
    unfinished "$old" && die "$old has an unfinished merge/rebase/cherry-pick or unmerged paths; finish or abort it first"
    while read -r wt; do
      [ "$wt" = "$old" ] && continue
      [ -d "$wt" ] || continue
      unfinished "$wt" && die "$wt has an unfinished merge/rebase/cherry-pick or unmerged paths; finish or abort it first"
    done < <(git -C "$old" worktree list --porcelain | sed -n 's/^worktree //p')
    mkdir -p "$out/patches"
    git -C "$old" worktree prune

    say "== 2. Last commit with code: the pre-split tag of the docs repo (read-only fetch)"
    git -C "$old" fetch -q "$DOCS_URL" '+refs/tags/pre-split:refs/tags/pre-split' || die "cannot fetch pre-split from $DOCS_URL"
    pre=pre-split
    git -C "$old" bundle create -q "$out/all.bundle" --all
    say "   bundle: $out/all.bundle"

    say "== 3. Save branch work that is not in $pre (merged or squash-merged branches are skipped)"
    local keep=()
    while read -r b; do
      [ "$b" = main ] && continue
      merged_into "$old" "$pre" "$b" && continue
      local f="$out/patches/${b//\//_}.patch" d="$out/patches/${b//\//_}.docs.patch"
      git -C "$old" diff --binary "$pre...$b" -- . ':(exclude).scratch' ':(exclude)docs/adr' ':(exclude)docs/research' \
        ':(exclude)docs/specs' ':(exclude)docs/design/referances' ':(exclude)docs/deploy.md' ':(exclude).github/workflows/deploy.yml' > "$f"
      git -C "$old" diff --binary "$pre...$b" -- .scratch docs/adr docs/research docs/specs docs/design/referances \
        docs/deploy.md .github/workflows/deploy.yml > "$d"
      [ -s "$d" ] && say "   $b: docs part saved: $d" || rm -f "$d"
      if [ -s "$f" ]; then keep+=("$b"); say "   saved $b"; else rm -f "$f"; fi
    done < <(git -C "$old" for-each-ref --format='%(refname:short)' refs/heads)

    say "== 4. Save uncommitted work (checkout and every worktree)"
    while read -r wt; do
      [ -d "$wt" ] || continue
      local n; n=$(basename "$wt")
      git -C "$wt" diff --binary HEAD > "$out/uncommitted-$n.patch" 2>/dev/null || true
      if [ -s "$out/uncommitted-$n.patch" ]; then say "   $n: tracked changes saved"; else rm -f "$out/uncommitted-$n.patch"; fi
    done < <(git -C "$old" worktree list --porcelain | sed -n 's/^worktree //p')

    say "== 5. Untracked and ignored local files of the old checkout"
    # core.quotepath=false: non-ASCII file names must come out as they are, not as "\320..." escapes
    ( cd "$old" && { git -c core.quotepath=false ls-files -o --exclude-standard; git -c core.quotepath=false ls-files -o -i --exclude-standard; } \
        | grep -vE '^(node_modules|dist|dist-ssr|test-results|playwright-report|bd-beads-[^/]*)/' | sort -u ) > "$out/files.txt"
    grep -E "$PRIVATE_RE" "$out/files.txt" > "$out/files-docs.txt" || true
    grep -vE "$PRIVATE_RE" "$out/files.txt" > "$out/files-code.txt" || true
    say "   $(wc -l < "$out/files-code.txt") for the code repo, $(wc -l < "$out/files-docs.txt") for the docs repo (lists in $out)"

    say "== 6. Clone the code repo"
    git clone -q "$NEW_URL" "$new.tmp"
    git -C "$new.tmp" config user.name "$(git -C "$old" config user.name || true)"
    git -C "$new.tmp" config user.email "$(git -C "$old" config user.email || true)"
  else
    if [ -d "$new/.git" ]; then
      say "== $new is already the code repo."
    else
      say "== No old checkout at $old: cloning the code repo."
      git clone -q "$NEW_URL" "$new"
    fi
  fi

  say "== 7. The docs repo"
  if [ -d "$docs/.git" ]; then
    git -C "$docs" pull -q --ff-only || say "   could not fast-forward $docs; left as it is"
  else
    git clone -q "$DOCS_URL" "$docs"
  fi
  if [ "$is_old" = 1 ]; then
    git -C "$docs" config user.name "$(git -C "$old" config user.name || true)"
    git -C "$docs" config user.email "$(git -C "$old" config user.email || true)"
    # Never overwrites. Untracked docs files stay uncommitted here: review them and commit.
    if [ -s "$out/files-docs.txt" ]; then rsync -a --ignore-existing --files-from="$out/files-docs.txt" "$old/" "$docs/"; fi
    if [ -s "$out/files-code.txt" ]; then rsync -a --ignore-existing --files-from="$out/files-code.txt" "$old/" "$new.tmp/"; fi

    say "== 8. Re-create unmerged branches on the new main"
    for b in "${keep[@]:-}"; do
      [ -n "$b" ] || continue
      local f="$out/patches/${b//\//_}.patch"
      git -C "$new.tmp" switch -q -c "$b" origin/main
      if git -C "$new.tmp" apply --3way --index "$f" 2>/dev/null && ! git -C "$new.tmp" diff --cached --quiet; then
        git -C "$new.tmp" commit -q -m "wip: carried over from the old history ($b)"
        say "   $b: re-created"
      else
        git -C "$new.tmp" reset -q --hard
        git -C "$new.tmp" switch -q main && git -C "$new.tmp" branch -q -D "$b"
        say "   $b: NOT applied; patch kept: $f"
      fi
    done
    git -C "$new.tmp" switch -q main

    say "== 9. Remove worktrees that are clean and merged into $pre (squash-merged counts)"
    while read -r wt; do
      [ "$wt" = "$old" ] && continue
      [ -d "$wt" ] || continue
      local br; br=$(git -C "$wt" symbolic-ref -q --short HEAD || true)
      if [ -n "$br" ] && [ -z "$(git -C "$wt" status --porcelain)" ] && merged_into "$old" "$pre" "$br"; then
        git -C "$old" worktree remove "$wt" && git -C "$old" branch -q -D "$br"
        say "   removed $(basename "$wt") ($br)"
      else
        say "   kept    $(basename "$wt") (${br:-detached}: not clean or not merged)"
        kept_wts+=("$wt")
      fi
    done < <(git -C "$old" worktree list --porcelain | sed -n 's/^worktree //p')

    say "== 10. Swap folders"
    mv "$old" "$old.old2"
    mv "$new.tmp" "$new"
    # The old checkout must never push its private history to the public repo.
    git -C "$old.old2" remote set-url origin "$DOCS_URL"
    [ "${#kept_wts[@]}" -eq 0 ] || git -C "$old.old2" worktree repair "${kept_wts[@]}" >/dev/null
  fi

  say "== 11. Link the docs into the code repo"
  bash "$new/scripts/link-docs.sh"
  if [ -z "${SKIP_NPM:-}" ] && [ ! -d "$new/node_modules" ]; then ( cd "$new" && npm ci --silent ); fi

  say
  say "Done. Code: $new   Docs: $docs"
  if [ "$is_old" = 1 ]; then
    say "Old checkout kept at $old.old2 (its origin now points at the docs repo). Saved work and the bundle: $out"
    say "Untracked docs files were copied into $docs but not committed: review and commit them there."
    say "Not carried over: node_modules, build output, worktrees that were kept (they keep working from $old.old2)."
    say "Apply saved uncommitted work with: git -C $new apply --3way $out/uncommitted-*.patch"
  fi
}

kept_wts=()
main "$@"; exit
