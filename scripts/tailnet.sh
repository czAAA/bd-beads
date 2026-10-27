#!/usr/bin/env bash
# Serve this checkout's dev server on the tailnet for verification from another device, and stop it again. Opt-in: nothing starts it for you.
#   npm run tailnet:start [port]   start vite in the background and `tailscale serve` it (tailnet only, never funnel)
#   npm run tailnet:stop           stop both
#   npm run tailnet:status         print the URL, if serving
set -euo pipefail
TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale # the App Store CLI isn't on PATH
[ -x "$TS" ] || TS=$(command -v tailscale || true)
[ -n "$TS" ] || { echo "tailscale not found" >&2; exit 1; }
root=$(cd "$(dirname "$0")/.." && pwd)
state="$root/node_modules/.cache/tailnet"
mkdir -p "$(dirname "$state")"

url() { "$TS" serve status 2>/dev/null | grep -o "https://[^ ]*:$1" | head -1; }

case "${1:-}" in
  start)
    if [ -f "$state" ]; then echo "already serving (npm run tailnet:status)" >&2; exit 1; fi
    port=${2:-$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')}
    (cd "$root" && nohup npx vite --host --port "$port" --strictPort >"$state.log" 2>&1 & echo $! >"$state.pid")
    "$TS" serve --bg --https="$port" "$port" >/dev/null
    echo "$port" >"$state"
    echo "serving: $(url "$port")"
    ;;
  stop)
    [ -f "$state" ] || { echo "not serving"; exit 0; }
    port=$(cat "$state")
    "$TS" serve --https="$port" off || true
    if [ -f "$state.pid" ]; then
      pkill -P "$(cat "$state.pid")" 2>/dev/null || true
      kill "$(cat "$state.pid")" 2>/dev/null || true
    fi
    rm -f "$state" "$state.pid" "$state.log"
    echo "stopped"
    ;;
  status)
    [ -f "$state" ] && echo "serving: $(url "$(cat "$state")")" || echo "not serving"
    ;;
  *) echo "usage: npm run tailnet:start [port] | tailnet:stop | tailnet:status" >&2; exit 2 ;;
esac
