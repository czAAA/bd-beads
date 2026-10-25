import { expect, it } from 'vitest'
import { INFO_POPOVERS, NATIVE_TITLES } from './hoverExemptions'
import { handMadeTooltips, nativeTitles } from './hoverSource'

/** The hover text source guards (tickets 264, 552): one way to make hover text, so the Tooltip checks can't be bypassed.
 * They read the templates and need no page. */

it('hover text is made by the shared Tooltip, not by a native title', () => {
  const used = new Set(nativeTitles().map((title) => `${title.file}|${title.what}`))
  const unlisted = [...used].filter((key) => !(key in NATIVE_TITLES))
  expect(unlisted, 'a native title is hover text the browser draws, which no check can measure: use IconButton, AppButton or AppTooltip, or list it in NATIVE_TITLES (src/testUtils/hoverExemptions.ts) with a reason').toEqual([])
  const stale = Object.keys(NATIVE_TITLES).filter((key) => !used.has(key))
  expect(stale, 'listed in NATIVE_TITLES but gone from the source: remove it').toEqual([])
})

it('hand-made tooltips are the listed info popovers and nothing else', () => {
  const made = handMadeTooltips().map((tooltip) => `${tooltip.file}|${tooltip.testid}`)
  const listed = INFO_POPOVERS.map((popover) => `${popover.file}|${popover.testid}`)
  expect(made.filter((key) => !listed.includes(key)), 'a tooltip made by hand bypasses the shared Tooltip and so the hover text checks: use AppTooltip, or list it in INFO_POPOVERS (src/testUtils/hoverExemptions.ts)').toEqual([])
  expect(listed.filter((key) => !made.includes(key)), 'listed in INFO_POPOVERS but gone from the source: remove it').toEqual([])
})
