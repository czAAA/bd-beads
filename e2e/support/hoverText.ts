import type { Page } from '@playwright/test'
import type { TextMisfit } from './textFit'
import { measureOpenBubble } from '../../src/testUtils/hoverInPage'

// The hover text check (ticket 264): opens every Tooltip trigger (`.app-tooltip`) by hover, focus and long press, and
// measures the bubble against the screen, every clipping ancestor and its own box.
// Reports misfit-shaped results, so the pending list (textFitPending.ts) applies: `against` is what cuts it.

export interface HoverResult {
  /** Which Tooltips came open, by the components whose templates they come from (the bubble's `data-owner`). */
  opened: string[]
  misfits: TextMisfit[]
  /** Triggers on the page that never showed a bubble (a disabled control shows none, by design). */
  silent: string[]
}

interface Trigger {
  index: number
  /** What the trigger looks like to the check and to a reader of a failure: its test id or label, and where it sits. */
  name: string
  /** The same, with the chain of containers: two triggers that look alike in different containers are measured
   * separately. */
  signature: string
}

const LONG_PRESS_WAIT_MS = 650

/** Marks the page's Tooltip triggers that are on screen and not yet seen, and describes them. */
async function discover(page: Page, seen: Set<string>): Promise<Trigger[]> {
  const found = await page.evaluate(() => {
    const describe = (element: Element): string => {
      const id = element.getAttribute('data-testid')
      const classes = [...element.classList].slice(0, 2).join('.')
      return `${element.tagName.toLowerCase()}${id ? `[${id}]` : ''}${classes ? `.${classes}` : ''}`
    }
    const isHidden = (element: Element): boolean => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return true
      }
      return false
    }
    document.querySelectorAll('[data-hover-probe]').forEach((element) => element.removeAttribute('data-hover-probe'))
    const triggers: { index: number; name: string; signature: string }[] = []
    for (const wrapper of document.querySelectorAll('.app-tooltip')) {
      if (isHidden(wrapper)) continue
      const rect = wrapper.getBoundingClientRect()
      // Wholly off the screen: the panels waiting to open, which the screens open and then look again.
      if (rect.width === 0 || rect.height === 0 || rect.right <= 0 || rect.left >= window.innerWidth) continue
      const control = wrapper.querySelector('button, a, input, [tabindex]') ?? wrapper
      const label = control.getAttribute('data-testid') ?? control.getAttribute('aria-label') ?? control.textContent?.trim().slice(0, 30) ?? ''
      const chain: string[] = []
      for (let node: Element | null = wrapper.parentElement; node && chain.length < 8; node = node.parentElement) chain.push(describe(node))
      const index = triggers.length
      wrapper.setAttribute('data-hover-probe', String(index))
      triggers.push({ index, name: `${control === wrapper ? 'span' : control.tagName.toLowerCase()}[${label}]`, signature: `${label}|${chain.join('<')}` })
    }
    return triggers
  })
  return found.filter((trigger) => {
    if (seen.has(trigger.signature)) return false
    seen.add(trigger.signature)
    return true
  })
}

/** Scrolls the trigger into view where it is (the column, the canvas) and nothing else. In the page, so that a
 * trigger under a dialog doesn't wait for a click that could never reach it. */
const scrollTo = (page: Page, index: number) => page.evaluate((i) => document.querySelector(`[data-hover-probe="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), index)

/** Waits for the bubble's fade-in to finish, then measures it. */
async function measureTrigger(page: Page, index: number) {
  await page.evaluate(async (i) => {
    const bubble = document.querySelector(`[data-hover-probe="${i}"] [data-testid="tooltip"]`)
    await Promise.all((bubble?.getAnimations() ?? []).map((animation) => animation.finished.catch(() => undefined)))
  }, index)
  return page.evaluate(measureOpenBubble, index)
}

/** Opens every Tooltip not yet opened in the same place (hover, focus, long press, click if disabled) and measures
 * it; `seen` is the caller's. */
export async function findHoverMisfits(page: Page, seen: Set<string>): Promise<HoverResult> {
  const result: HoverResult = { opened: [], misfits: [], silent: [] }
  // The info popovers (opened by click, and measured by the text fit check) are not opened here, only counted as seen.
  result.opened.push(...(await page.evaluate(() => [...document.querySelectorAll('[role="tooltip"]:not([data-testid="tooltip"])')].filter((popover) => popover.getBoundingClientRect().width > 0).map((popover) => `info:${popover.getAttribute('data-testid')}`))))
  const triggers = await discover(page, seen)
  if (triggers.length === 0) return result
  const record = (trigger: Trigger, measured: Awaited<ReturnType<typeof measureTrigger>>) => {
    if (!measured) return false
    const shown = measured.text.length > 60 ? `${measured.text.slice(0, 57)}...` : measured.text
    for (const owner of measured.owner.split(' ')) if (owner && !result.opened.includes(owner)) result.opened.push(owner)
    for (const cut of measured.cuts) {
      const key = `${trigger.name}|${shown}|${cut.against}`
      if (result.misfits.some((m) => `${m.element}|${m.text}|${m.against}` === key)) continue
      result.misfits.push({ problem: cut.against === 'its own box' || cut.against === 'an ellipsis' ? 'cut-off' : 'pokes-out', element: trigger.name, text: shown, pixels: cut.pixels, against: cut.against })
    }
    return true
  }
  const opened = new Set<number>()

  // Hover: a mouse over the trigger, the way a person does it.
  for (const trigger of triggers) {
    const wrapper = page.locator(`[data-hover-probe="${trigger.index}"]`)
    // Where a person would have scrolled to before pointing at it.
    await scrollTo(page, trigger.index)
    const box = await wrapper.boundingBox()
    if (!box) continue
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    if (record(trigger, await measureTrigger(page, trigger.index))) opened.add(trigger.index)
    await page.mouse.move(0, 0)
  }

  // Keyboard focus: a key first, so that what is focused counts as focused from the keyboard.
  await page.keyboard.press('Shift')
  for (const trigger of triggers) {
    await page.evaluate((i) => (document.querySelector(`[data-hover-probe="${i}"]`)?.querySelector<HTMLElement>('button, a, input, [tabindex]'))?.focus(), trigger.index)
    if (record(trigger, await measureTrigger(page, trigger.index))) opened.add(trigger.index)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  }

  // Long press, as on a touch screen: all of them at once, since each bubble is measured where it opens.
  await page.evaluate(() => {
    const panel = document.querySelector('.app-panel')
    for (const wrapper of document.querySelectorAll('[data-hover-probe]')) {
      // Under an open panel a press outside it closes it (ticket 402, in the capture phase, so not bubbling doesn't
      // hide it): only what is in the panel can be long-pressed.
      if (panel && !panel.contains(wrapper)) continue
      // At the Tooltip itself and no further (not bubbling): a press the page at large sees would close the menu a
      // trigger is under.
      wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: false, isPrimary: true }))
    }
  })
  await page.waitForTimeout(LONG_PRESS_WAIT_MS)
  for (const trigger of triggers) {
    // Each bubble moves with its trigger, so scroll to the trigger first, as a person holding it would have.
    await scrollTo(page, trigger.index)
    if (record(trigger, await measureTrigger(page, trigger.index))) opened.add(trigger.index)
  }
  await page.evaluate(() => {
    for (const wrapper of document.querySelectorAll('[data-hover-probe]')) {
      wrapper.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: false }))
      // The press left the Tooltip believing a press is under way (which it only forgets on blur): tell it that it is
      // over.
      wrapper.dispatchEvent(new FocusEvent('focusout', { bubbles: false }))
    }
  })

  // A click or tap on a disabled control shows its reason too (ticket 453): one at a time, each closed by Escape.
  for (const trigger of triggers) {
    const disabled = await page.evaluate((i) => !!document.querySelector(`[data-hover-probe="${i}"] [aria-disabled="true"]`), trigger.index)
    if (!disabled) continue
    await scrollTo(page, trigger.index)
    await page.evaluate((i) => document.querySelector<HTMLElement>(`[data-hover-probe="${i}"] [aria-disabled="true"]`)?.click(), trigger.index)
    if (record(trigger, await measureTrigger(page, trigger.index))) opened.add(trigger.index)
    await page.keyboard.press('Escape')
  }

  for (const trigger of triggers) if (!opened.has(trigger.index)) result.silent.push(trigger.name)
  return result
}
