#!/usr/bin/env bash
# The visual check in CI's own container (the Playwright image ci.yml names), so references match CI's; without Docker
# only on Linux, and on macOS it stops (exit 2). Usage, BD_VISUAL_NATIVE, BD_VISUAL_PLATFORM and the node_modules cache
# (~/.cache/bd-beads/visual): docs/testing/visual-check.md. Arguments go to `playwright test`.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
# What playwright.config.ts and e2e/support read from the environment. Not E2E_PORT: the container has its own ports.
pass=(UPDATE_REFERENCES VISUAL_WORKERS VISUAL_PART SKIP_BUILD)

native() {
  # A preview another worktree left on the default port would be reused, and the check would measure that build.
  [ -n "${E2E_PORT:-}" ] || E2E_PORT=$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')
  export E2E_PORT
  exec npx playwright test "$@"
}

if [ "${BD_VISUAL_NATIVE:-}" = 1 ]; then native "$@"; fi
if ! docker info >/dev/null 2>&1; then
  if [ "$(uname -s)" = Linux ]; then
    echo "visual: Docker isn't reachable, so drawing with this machine's Playwright (Linux like CI, not its image)" >&2
    native "$@"
  fi
  echo "visual: Docker isn't running. References drawn on $(uname -s) differ from CI's Linux ones, so start Docker" >&2
  echo "        (BD_VISUAL_NATIVE=1 draws here anyway: to look only, never to commit references)." >&2
  exit 2
fi

image=$(grep -oE 'mcr\.microsoft\.com/playwright:v[0-9.]+-[a-z]+' .github/workflows/ci.yml | head -1)
[ -n "$image" ] || { echo "visual: no Playwright image named in .github/workflows/ci.yml" >&2; exit 2; }
platform=${BD_VISUAL_PLATFORM:-}
lock=$( (cat package-lock.json; echo "$image $platform") | git hash-object --stdin | cut -c1-12)
cache=${XDG_CACHE_HOME:-$HOME/.cache}/bd-beads/visual
mkdir -p "$cache/$lock" "$cache/home"

args=(--rm --init --ipc=host --user "$(id -u):$(id -g)" -e HOME=/home/runner -e "LOCK=$lock")
[ -t 1 ] && args+=(-t)
[ -n "$platform" ] && args+=(--platform "$platform")
for name in "${pass[@]}"; do [ -n "${!name:-}" ] && args+=(-e "$name=${!name}"); done
# The checkout at its own path, so a worktree's `.git` file still points at the repository, which is mounted too
# (the build reads git to order the Release notes). Git in the container runs as another user: trust the checkout.
common=$(cd "$(git rev-parse --git-common-dir)" && pwd)
args+=(-v "$root:$root" -w "$root" -v "$common:$common:ro"
  -v "$cache/$lock:$root/node_modules" -v "$cache/home:/home/runner"
  -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0='*')

# npm ci once per lockfile, under a lock: two worktrees starting at once would write one node_modules together. The
# lock and the mark live in the cached home, since npm ci empties node_modules (its entries, so a mount point is fine).
exec docker run "${args[@]}" "$image" bash -c '
  set -e
  exec 9>"$HOME/.install-$LOCK.lock"
  flock 9
  if [ ! -f "$HOME/.installed-$LOCK" ]; then
    echo "visual: installing Linux node_modules for this lockfile, once" >&2
    npm ci --no-audit --no-fund >/dev/null
    touch "$HOME/.installed-$LOCK"
  fi
  flock -u 9
  exec npx playwright test "$@"
' visual "$@"
