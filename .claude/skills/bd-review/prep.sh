#!/usr/bin/env bash
# Prepares a bd-review (skill bd-review, steps 1 and 2) in one command, so the session that reviews spends one call
# on it instead of several, and the reviewers read the diff from files instead of paging `git diff` through Bash.
#
# The work under review is everything since the merge-base with origin/main, committed or not, untracked files
# included. The index is left as it was found: an untracked file's diff is made with `git diff --no-index`.
#
# It writes into <worktree>/.review/ (which ignores itself, so it never shows in `git status`):
#   diff-NN.patch   the whole diff, cut at file boundaries into parts the Read tool takes in one call each
#   context.md      what a reviewer needs besides its brief: worktree, base, commits, changed files, the diff parts,
#                   the spec and the PR description when found
#   pr-body.md      the open PR's description, when there is one
# and prints a short summary for the reviewing session, ending with the two prompts to start the reviewers with.
#
# Usage: bash .claude/skills/bd-review/prep.sh [worktree]     default: the repo the command runs in
# Exits 1 when origin/main has no merge-base with HEAD or there is nothing to review.
set -euo pipefail

# A part stays well under what the Read tool takes in one call: a new one starts at a file boundary past the soft
# size, and anywhere past the hard size. Parts are read in parallel, so more of them cost no extra call.
SOFT_LINES=700
SOFT_BYTES=30000
HARD_LINES=1200
HARD_BYTES=45000
# An untracked file larger than this is named, not shown: it is a data file or an accident, not code to read.
UNTRACKED_MAX_BYTES=200000
LOCK_FILE=package-lock.json

here=$(cd "$(dirname "$0")" && pwd)
cd "${1:-.}"
root=$(git rev-parse --show-toplevel)
cd "$root"
out="$root/.review"

fetched=yes
git fetch -q origin main 2>/dev/null || fetched=no
if ! base=$(git merge-base HEAD origin/main 2>/dev/null); then
  echo "review-prep: HEAD has no merge-base with origin/main" >&2
  exit 1
fi

rm -rf "$out"
mkdir -p "$out"
echo '*' >"$out/.gitignore"
all="$out/all.patch"
: >"$out/left-out.txt"
: >"$out/untracked.txt"

diff_opts=(-c core.quotepath=off diff --no-color --no-ext-diff)
git "${diff_opts[@]}" "$base" -- . ":(exclude)$LOCK_FILE" >"$all"
if ! git diff --quiet "$base" -- "$LOCK_FILE" 2>/dev/null; then
  echo "$LOCK_FILE (lock file, changed)" >>"$out/left-out.txt"
fi

while IFS= read -r -d '' file; do
  case "$file" in
    .env* | */.env* | *.log | *.pem | *.key | test-results/* | playwright-report/*)
      echo "$file (untracked, looks accidental or secret)" >>"$out/left-out.txt"
      continue
      ;;
  esac
  if [ -f "$file" ] && [ "$(wc -c <"$file")" -gt "$UNTRACKED_MAX_BYTES" ]; then
    echo "$file (untracked, over $((UNTRACKED_MAX_BYTES / 1000)) kB)" >>"$out/left-out.txt"
    continue
  fi
  echo "$file" >>"$out/untracked.txt"
  # --no-index exits 1 when the files differ, which they always do here.
  git "${diff_opts[@]}" --no-index -- /dev/null "$file" >>"$all" || true
done < <(git ls-files -o --exclude-standard -z)

if [ ! -s "$all" ]; then
  echo "review-prep: nothing to review, the work is the same as origin/main" >&2
  exit 1
fi

# One line per changed file: added, deleted, path. A binary file counts 0 0.
awk '
  function flush() { if (file != "") print added "\t" deleted "\t" file }
  /^diff --git / { flush(); file = $0; sub(/^.* b\//, "", file); added = 0; deleted = 0; hunk = 0; next }
  /^@@/ { hunk = 1; next }
  hunk && /^\+/ { added++ }
  hunk && /^-/ { deleted++ }
  END { flush() }
' "$all" >"$out/files.tsv"

# LC_ALL=C: awk counts bytes, not characters, so a diff of Cyrillic or Chinese strings is sized as it is on disk.
LC_ALL=C awk -v dir="$out" -v soft_lines="$SOFT_LINES" -v soft_bytes="$SOFT_BYTES" \
  -v hard_lines="$HARD_LINES" -v hard_bytes="$HARD_BYTES" '
  function open_part() { count++; part = sprintf("%s/diff-%02d.patch", dir, count); lines = 0; bytes = 0 }
  BEGIN { open_part() }
  /^diff --git / && lines > 0 && (lines >= soft_lines || bytes >= soft_bytes) { close(part); open_part() }
  {
    if (lines >= hard_lines || bytes >= hard_bytes) { close(part); open_part() }
    print >part
    lines++
    bytes += length($0) + 1
  }
' "$all"
rm "$all"

file_count=$(wc -l <"$out/files.tsv" | tr -d ' ')
added=$(awk -F'\t' '{ n += $1 } END { print n + 0 }' "$out/files.tsv")
deleted=$(awk -F'\t' '{ n += $2 } END { print n + 0 }' "$out/files.tsv")
# Code is every changed file that isn't plainly docs or config: a markdown file, a file under docs/, .github/ or
# .claude/, a dotfile or a JSON, YAML or TOML file at the root. A script or a stylesheet is code wherever it lies,
# and so is data under src/ (a Release note, a catalog).
code_count=$(cut -f3 "$out/files.tsv" | awk '
  /\.(ts|tsx|vue|js|mjs|cjs|css|scss|html|sh)$/ { n++; next }
  /\.md$/ || /^(docs|\.github|\.claude)\// || /^\.[^\/]+$/ || /^[^\/]+\.(json|jsonc|ya?ml|toml)$/ { next }
  { n++ }
  END { print n + 0 }
')
screenshots=$(cut -f3 "$out/files.tsv" | grep -E '^e2e/visual/__screenshots__/' || true)
part_count=$(find "$out" -name 'diff-*.patch' | wc -l | tr -d ' ')
commits=$(git log --oneline "$base..HEAD")
commit_count=$(printf '%s' "$commits" | grep -c . || true)

# Release notes the work adds, changes, deletes or renames (docs/agents/pull-requests.md, Release notes).
notes=$(
  git diff --name-status "$base" -- src/data/releaseNotes
  grep -E '^src/data/releaseNotes/' "$out/untracked.txt" | sed 's/^/A	/' || true
)

# The PR of this branch, if GitHub answers: number, state, title, then the description.
pr_number=""
pr_state=""
pr_title=""
if pr=$(gh pr view --json number,state,title,body -q '.number, .state, .title, .body' 2>/dev/null); then
  pr_number=$(printf '%s\n' "$pr" | sed -n 1p)
  pr_state=$(printf '%s\n' "$pr" | sed -n 2p)
  pr_title=$(printf '%s\n' "$pr" | sed -n 3p)
  printf '%s\n' "$pr" | sed 1,3d >"$out/pr-body.md"
fi
release_pr=no
title_verdict=""
if [ "$pr_state" = OPEN ]; then
  if printf '%s' "$pr_title" | grep -qE '^release: [0-9]+\.[0-9]+\.[0-9]+$'; then
    release_pr=yes
    title_verdict="ok (release PR)"
  elif printf '%s' "$pr_title" | grep -qE '^(feat|fix|ref):\[[0-9]{4}\] .*[^.]$'; then
    title_verdict=ok
  else
    title_verdict="BAD: not type:[NNNN] Description"
  fi
fi

# The ticket: the PR title, then the worktree name, the branch name and the commit messages. First hit wins.
branch=$(git rev-parse --abbrev-ref HEAD)
ticket=$(
  {
    printf '%s\n' "$pr_title" | sed -En 's/.*\[([0-9]{1,4})\].*/\1/p'
    basename "$root" | sed -En 's/^bd-beads-([0-9]{1,4})$/\1/p'
    printf '%s\n' "$branch" | sed -En 's/^[a-z]+\/([0-9]{1,4})-.*/\1/p'
    printf '%s\n' "$commits" | sed -En 's/.*\[([0-9]{1,4})\].*/\1/p'
  } | sed -n 1p
)
# The first file in a folder that starts with the number, or nothing.
find_numbered() {
  local folder=$1 number=$2 match
  for match in "$folder/$number"-*.md; do
    [ -e "$match" ] && printf '%s\n' "$match" && return
  done
  return 0
}
spec_paths=""
if [ -n "$ticket" ]; then
  ticket=$(printf '%04d' "$((10#$ticket))")
  for folder in .scratch .scratch/.archive docs/specs; do
    found=$(find_numbered "$folder" "$ticket")
    if [ -n "$found" ]; then
      spec_paths="$root/$found"
      # A ticket names the spec it implements: the reviewer reads both.
      parent=$(sed -En 's/^\*\*Spec:\*\* *([0-9]{4}).*/\1/p' "$found" | sed -n 1p)
      if [ -n "$parent" ]; then
        parent_path=$(find_numbered docs/specs "$parent")
        [ -n "$parent_path" ] && spec_paths="$spec_paths $root/$parent_path"
      fi
      break
    fi
  done
fi

{
  echo "# Review context"
  echo
  echo "Worktree: $root"
  echo "Branch: $branch"
  echo "Base: $base (merge-base with origin/main)"
  echo
  echo "## Diff parts"
  echo
  echo "Together they are the whole diff, base to working tree, untracked files included."
  echo
  for part in "$out"/diff-*.patch; do
    echo "- $part ($(wc -l <"$part" | tr -d ' ') lines)"
  done
  if [ -s "$out/left-out.txt" ]; then
    echo
    echo "Left out of the diff:"
    echo
    sed 's/^/- /' "$out/left-out.txt"
  fi
  echo
  echo "## Spec"
  echo
  if [ -n "$spec_paths" ]; then
    for path in $spec_paths; do echo "- $path"; done
  else
    echo "Not found by the script: the prompt names it, or there is none."
  fi
  if [ -s "$out/pr-body.md" ]; then
    echo "- $out/pr-body.md (the description of PR #$pr_number: $pr_title)"
  fi
  echo
  echo "## Commits"
  echo
  if [ -n "$commits" ]; then printf '%s\n' "$commits"; else echo "None yet: the work is uncommitted."; fi
  echo
  echo "## Changed files (added, deleted, path)"
  echo
  cat "$out/files.tsv"
} >"$out/context.md"

summary_left_out=$(paste -sd ';' "$out/left-out.txt" | sed 's/;/; /g')
rm "$out/files.tsv" "$out/left-out.txt" "$out/untracked.txt"

echo "review dir    $out"
echo "base          ${base:0:9}, origin/main $([ "$fetched" = yes ] && echo fetched || echo "NOT fetched: it may be stale")"
echo "diff          $file_count files, +$added -$deleted, $part_count part(s), $commit_count commit(s)"
echo "code files    $code_count of $file_count (0: docs or config only, review inline)"
[ -n "$summary_left_out" ] && echo "left out      $summary_left_out"
if [ -n "$pr_number" ]; then
  echo "pr            #$pr_number $pr_state: $pr_title"
  [ -n "$title_verdict" ] && echo "pr title      $title_verdict"
else
  echo "pr            none"
fi
echo "release pr    $release_pr"
if [ -n "$spec_paths" ]; then
  echo "spec          $spec_paths"
else
  echo "spec          not found${ticket:+ (ticket $ticket has no file)}"
fi
if [ -n "$notes" ]; then
  echo "release notes $(printf '%s' "$notes" | tr '\t' ' ' | paste -sd ';' - | sed 's/;/; /g')"
else
  echo "release notes none"
fi
if [ -n "$screenshots" ]; then
  echo "screenshots   $(printf '%s\n' "$screenshots" | grep -c .) changed"
fi
echo
echo "Standards prompt: Read $here/standards-brief.md and $out/context.md, then follow the brief."
echo "Spec prompt:      Read $here/spec-brief.md and $out/context.md, then follow the brief."
