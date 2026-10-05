import type { Page } from '@playwright/test'
import type { TextMisfit } from './textFit'

/**
 * The hover text check (ticket 264): finds every Tooltip trigger on the page, opens each one the three ways a person
 * can (hover with a mouse, keyboard focus, a long press on a touch screen) and measures the bubble that appears
 * against the screen, against every ancestor that clips it and against its own box. Nothing here names a trigger: the
 * triggers are found on the page (`.app-tooltip`), so a Tooltip added tomorrow is looked at too.
 *
 * What it reports is shaped like the text fit check's misfits, so the same pending list machinery (textFitPending.ts)
 * explains the ones that are known: `element` is the trigger, `text` the Tooltip's text, `against` what cuts it.
 */

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
  /** The same, with the chain of containers: two triggers that look alike in different containers are measured separately. */
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
      // Wholly off the screen: the sheets waiting to open, which the screens open and then look again.
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

/** Measures the open bubble of the trigger marked `index`, in the browser. Returns what is cut and how, or null when none is open. */
function measureOpenBubble(index: number): { text: string; owner: string; cuts: { against: string; pixels: number }[] } | null {
  const TOLERANCE = 1
  const wrapper = document.querySelector(`[data-hover-probe="${index}"]`)
  const bubble = wrapper?.querySelector<HTMLElement>('[data-testid="tooltip"]')
  if (!bubble || getComputedStyle(bubble).display === 'none') return null
  const describe = (element: Element): string => {
    const id = element.getAttribute('data-testid')
    const classes = [...element.classList].slice(0, 2).join('.')
    return `${element.tagName.toLowerCase()}${id ? `[${id}]` : ''}${classes ? `.${classes}` : ''}`
  }
  const round = (value: number) => Math.round(value * 10) / 10
  const text = (bubble.textContent ?? '').replace(/\s+/g, ' ').trim()
  const box = bubble.getBoundingClientRect()
  const cuts: { against: string; pixels: number }[] = []
  const SIDE_NAMES = ['left', 'right', 'top', 'bottom']
  const sides = (clip: { left: number; right: number; top: number; bottom: number }, rect: { left: number; right: number; top: number; bottom: number }) => [clip.left - rect.left, rect.right - clip.right, clip.top - rect.top, rect.bottom - clip.bottom]

  // Past the screen's edge.
  const edges = sides({ left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }, box)
  const past = Math.max(...edges)
  if (past > TOLERANCE) cuts.push({ against: `the viewport's ${SIDE_NAMES[edges.indexOf(past)]} edge`, pixels: round(past) })

  // Past an ancestor that clips it, as the text fit check reads clipping: a fixed element is clipped by none of its
  // ancestors, an absolute one only by those at or above its containing block. Unlike text in a scrolling column, a
  // bubble cut at the column's edge is cut for whoever is looking at it, so all four sides count.
  let skipUnpositioned = false
  for (let ancestor: Element | null = bubble; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (style.position === 'fixed') break
    const containing = style.position !== 'static' || style.transform !== 'none'
    const considered = ancestor === bubble ? false : !skipUnpositioned || containing
    if (containing) skipUnpositioned = false
    if (style.position === 'absolute') skipUnpositioned = true
    const clipsX = style.overflowX !== 'visible'
    const clipsY = style.overflowY !== 'visible'
    if (!considered || (!clipsX && !clipsY)) continue
    const rect = ancestor.getBoundingClientRect()
    const clip = {
      left: clipsX ? rect.left + ancestor.clientLeft : -Infinity,
      right: clipsX ? rect.left + ancestor.clientLeft + ancestor.clientWidth : Infinity,
      top: clipsY ? rect.top + ancestor.clientTop : -Infinity,
      bottom: clipsY ? rect.top + ancestor.clientTop + ancestor.clientHeight : Infinity,
    }
    const edgesOfClip = sides(clip, box)
    const worst = Math.max(...edgesOfClip)
    if (worst > TOLERANCE) cuts.push({ against: `${describe(ancestor)}'s ${SIDE_NAMES[edgesOfClip.indexOf(worst)]} edge`, pixels: round(worst) })
  }

  // Its own text against its own box: wrapping past it, an ellipsis, a child that is wider than the bubble.
  const ownPast = Math.max(bubble.scrollWidth - bubble.clientWidth, bubble.scrollHeight - bubble.clientHeight)
  if (ownPast > TOLERANCE) cuts.push({ against: 'its own box', pixels: ownPast })
  const range = document.createRange()
  const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT)
  let textPast = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue
    range.selectNodeContents(node)
    for (const rect of range.getClientRects()) textPast = Math.max(textPast, rect.right - box.right, box.left - rect.left)
  }
  if (textPast > TOLERANCE) cuts.push({ against: 'its own box', pixels: round(textPast) })
  for (const element of [bubble, ...bubble.querySelectorAll('*')]) {
    if (getComputedStyle(element).textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + TOLERANCE) cuts.push({ against: 'an ellipsis', pixels: element.scrollWidth - element.clientWidth })
  }
  return { text, owner: bubble.getAttribute('data-owner') ?? '', cuts }
}

/** Scrolls the trigger into view where it is (the column, the canvas) and nothing else. In the page, so that a trigger under a dialog doesn't wait for a click that could never reach it. */
const scrollTo = (page: Page, index: number) => page.evaluate((i) => document.querySelector(`[data-hover-probe="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), index)

/** Waits for the bubble's fade-in to finish, then measures it. */
async function measureTrigger(page: Page, index: number) {
  await page.evaluate(async (i) => {
    const bubble = document.querySelector(`[data-hover-probe="${i}"] [data-testid="tooltip"]`)
    await Promise.all((bubble?.getAnimations() ?? []).map((animation) => animation.finished.catch(() => undefined)))
  }, index)
  return page.evaluate(measureOpenBubble, index)
}

/**
 * Opens every Tooltip on the page that this run has not opened in the same place before, by hover, by focus and by
 * long press, and measures each. `seen` is kept by the caller for the whole run at one language and width.
 */
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
    for (const wrapper of document.querySelectorAll('[data-hover-probe]')) {
      // At the Tooltip itself and no further (not bubbling): a press the page at large sees would close the sheet or menu a trigger is under.
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
      // The press left the Tooltip believing a press is under way (which it only forgets on blur): tell it that it is over.
      wrapper.dispatchEvent(new FocusEvent('focusout', { bubbles: false }))
    }
  })

  for (const trigger of triggers) if (!opened.has(trigger.index)) result.silent.push(trigger.name)
  return result
}
