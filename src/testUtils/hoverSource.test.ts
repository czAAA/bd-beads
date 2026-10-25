import { expect, it } from 'vitest'
import { INFO_POPOVERS, NATIVE_TITLES, NOT_MOUNTED } from './hoverExemptions'
import { componentsWithText, exercisedComponents, handMadeTooltips, nativeTitles, tooltipMakers } from './hoverSource'

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

it('every component with text or a Tooltip is tried by a browser fit test', () => {
  const tried = exercisedComponents()
  const names = [...new Set([...componentsWithText().map((file) => file.name), ...tooltipMakers()])]
  expect(names.filter((name) => !tried.has(name) && !(name in NOT_MOUNTED)), 'add a case for it to a *.browser.test.ts (describeFits in src/testUtils/browserFit.ts), or list it in NOT_MOUNTED (src/testUtils/hoverExemptions.ts) with a reason').toEqual([])
  expect(Object.keys(NOT_MOUNTED).filter((name) => tried.has(name) || !names.includes(name)), 'listed in NOT_MOUNTED but a test mounts it now, or it has no text: remove it').toEqual([])
})
