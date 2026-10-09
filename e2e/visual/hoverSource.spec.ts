import { expect, test } from '@playwright/test'
import { INFO_POPOVERS, NATIVE_TITLES } from '../support/hoverExemptions'
import { handMadeTooltips, nativeTitles } from '../support/hoverSource'

/**
 * The source guard of the hover text check (ticket 264): there is one way to make hover text, so that the check that
 * opens every Tooltip (textFit.spec.ts) cannot be bypassed by a new kind. No browser: it reads the templates.
 */

test('hover text is made by the shared Tooltip, not by a native title', () => {
  const used = new Set(nativeTitles().map((title) => `${title.file}|${title.what}`))
  const unlisted = [...used].filter((key) => !(key in NATIVE_TITLES))
  expect(unlisted, 'a native title is hover text the browser draws, which this check cannot measure: use IconButton, AppButton or AppTooltip, or list it in NATIVE_TITLES (e2e/support/hoverExemptions.ts) with a reason').toEqual([])
  const stale = Object.keys(NATIVE_TITLES).filter((key) => !used.has(key))
  expect(stale, 'listed in NATIVE_TITLES but gone from the source: remove it').toEqual([])
})

test('hand-made tooltips are the listed info popovers and nothing else', () => {
  const made = handMadeTooltips().map((tooltip) => `${tooltip.file}|${tooltip.testid}`)
  const listed = INFO_POPOVERS.map((popover) => `${popover.file}|${popover.testid}`)
  expect(made.filter((key) => !listed.includes(key)), 'a tooltip made by hand bypasses the shared Tooltip and so the hover text check: use AppTooltip, or list it in INFO_POPOVERS (e2e/support/hoverExemptions.ts)').toEqual([])
  expect(listed.filter((key) => !made.includes(key)), 'listed in INFO_POPOVERS but gone from the source: remove it').toEqual([])
})
