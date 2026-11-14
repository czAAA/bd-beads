#!/usr/bin/env bash
# Usage gate for a bulk run (bd-implement-bulk): says whether one more sub-agent may start inside the plan's 5-hour
# usage window, so a run doesn't start tickets it can't finish before the reset.
#
# It reads a snapshot the Claude Code status line writes, $CLAUDE_USAGE_SNAPSHOT or ~/.claude/usage-snapshot.json:
#   {"at": <epoch s written>, "five_hour": {"used_percentage": 27, "resets_at": <epoch s>}, "seven_day": {...}}
# from the status line's stdin JSON: jq -c --argjson at "$(date +%s)" '{at: $at, five_hour: .rate_limits.five_hour,
# seven_day: .rate_limits.seven_day}'. Without it (no snapshot, too old, no plan limits) the answer is "unknown" and the
# run goes on capped by -max only.
#
# Usage: bash scripts/usage-budget.sh [--running N] [--cost P] [--budget P] [--ledger FILE --finished N] [--max-age S]
#   --running   sub-agents running now (each is counted as one more ticket's cost still to come)   default 0
#   --cost      percentage points of the 5-hour window one ticket takes                            default 10
#   --budget    the 5-hour percentage no run should project past                                   default 85
#   --ledger    a file of this run's own, carried between calls: it adds up the points used since the run began,
#               across resets; with --finished N > 0 the cost becomes that total / N (an over-estimate while tickets
#               are still running, which is the safe side)
#   --max-age   seconds after which a snapshot is too old to trust                                 default 900
#
# Prints one line and exits 0:
#   start   used=27 projected=47 cost=10 resets=14:30 week=43
#   wait    used=78 projected=98 cost=10 resets=14:30 resets_at=1794684600 week=43
#   unknown reason=no-snapshot|stale|no-limits
# "wait" on the weekly window (95% or more) names that window's reset instead.
set -euo pipefail

running=0 cost=10 cost_given=0 budget=85 ledger="" finished=0 max_age=900
while [ $# -gt 0 ]; do
  case $1 in
    --running) running=$2; shift 2 ;;
    --cost) cost=$2; cost_given=1; shift 2 ;;
    --budget) budget=$2; shift 2 ;;
    --ledger) ledger=$2; shift 2 ;;
    --finished) finished=$2; shift 2 ;;
    --max-age) max_age=$2; shift 2 ;;
    *) echo "usage-budget.sh: unknown argument $1" >&2; exit 2 ;;
  esac
done

snapshot=${CLAUDE_USAGE_SNAPSHOT:-$HOME/.claude/usage-snapshot.json}
[ -s "$snapshot" ] || { echo "unknown reason=no-snapshot"; exit 0; }

now=$(date +%s)
read -r at used resets week week_resets < <(jq -r '[.at, .five_hour.used_percentage, .five_hour.resets_at,
  .seven_day.used_percentage, .seven_day.resets_at] | map(. // "-" | tostring) | join(" ")' "$snapshot")
[ "$used" != "-" ] && [ "$resets" != "-" ] || { echo "unknown reason=no-limits"; exit 0; }
[ "$at" != "-" ] && [ $((now - at)) -le "$max_age" ] || { echo "unknown reason=stale"; exit 0; }
# The window reset after the snapshot was taken: what it says was used belongs to the old window.
[ "$resets" -le "$now" ] && used=0

clock() { date -r "$1" +%H:%M 2>/dev/null || date -d "@$1" +%H:%M; }

if [ -n "$ledger" ]; then
  consumed=0 last_used="" last_resets=""
  [ -s "$ledger" ] && read -r consumed last_used last_resets < "$ledger"
  if [ -n "$last_used" ]; then
    consumed=$(awk -v c="$consumed" -v u="$used" -v lu="$last_used" -v r="$resets" -v lr="$last_resets" \
      'BEGIN { d = (r == lr) ? u - lu : u; if (d < 0) d = 0; print c + d }')
  fi
  printf '%s %s %s\n' "$consumed" "$used" "$resets" > "$ledger"
  if [ "$cost_given" = 0 ] && [ "$finished" -gt 0 ]; then
    cost=$(awk -v c="$consumed" -v n="$finished" 'BEGIN { x = c / n; if (x < 1) x = 1; printf "%.0f", x }')
  fi
fi

projected=$(awk -v u="$used" -v r="$running" -v c="$cost" 'BEGIN { printf "%.0f", u + (r + 1) * c }')
fields="used=$(printf '%.0f' "$used") projected=$projected cost=$cost"

if [ "$week" != "-" ] && awk -v w="$week" 'BEGIN { exit !(w >= 95) }'; then
  echo "wait $fields resets=$(clock "$week_resets") resets_at=$week_resets week=$(printf '%.0f' "$week") window=seven_day"
elif [ "$projected" -gt "$budget" ]; then
  echo "wait $fields resets=$(clock "$resets") resets_at=$resets week=${week%.*}"
else
  echo "start $fields resets=$(clock "$resets") week=${week%.*}"
fi
