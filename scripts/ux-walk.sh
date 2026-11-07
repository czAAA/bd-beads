#!/usr/bin/env bash
# The UX audit's screenshot walk (ticket 0815; docs/research/ux-audit/00-plan.md §5): runs one area's golden path on
# the plan's devices and leaves a PNG per walk stop, console.json, axe.json and stops.json under
# ux-audit-output/<area>/<device>/<state>/. Usage: npm run ux:walk -- <area>|all [playwright args]
# The reference devices (iPad 13″ dark, MacBook Air light) walk every area; cross-cutting walks every device.
set -euo pipefail

AREAS=(arrive draw-export convert-image bead-it keep-it cross-cutting)
REFERENCE=(--project ipad13-dark --project air-light)
ALL_DEVICES=(--project ipad13-dark --project air-light --project ipad13-light --project air-dark --project air-contrast --project fhd-light --project phone-light --project phone-dark)

[ $# -gt 0 ] || { echo "Usage: npm run ux:walk -- <area>|all [playwright args]  (areas: ${AREAS[*]})" >&2; exit 2; }
area=$1; shift

if [ "$area" = all ]; then
  for each in "${AREAS[@]}"; do bash "$0" "$each" "$@"; done
  exit 0
fi

case " ${AREAS[*]} " in *" $area "*) ;; *) echo "Unknown area '$area'; areas: ${AREAS[*]}" >&2; exit 2;; esac

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
rm -rf "$ROOT/ux-audit-output/$area"
if [ "$area" = cross-cutting ]; then devices=("${ALL_DEVICES[@]}"); else devices=("${REFERENCE[@]}"); fi

cd "$ROOT"
UX_AREA=$area npx playwright test -c playwright.ux-audit.config.ts "${devices[@]}" "$@"
echo "Walk written to ux-audit-output/$area/"
