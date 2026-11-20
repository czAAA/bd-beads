import { afterEach, describe, expect, it, vi } from 'vitest'
import type {} from '@vitest/browser-playwright'
import { cdp, page } from 'vitest/browser'
import { mountAt } from './browserFit'
import { runClockFaster } from './fastClock'
import { fakeFeedback } from './fakeFeedback'
import { turnToSection } from './homepageSection'
import { cssZoomOf } from '../composables/ui/cssZoom'
import HomePage from '../homepage/HomePage.vue'

// Everything the ghost presses or rests on is seen whole (ticket 0820): the tour played with motion, as a visitor
// watches it, every press and rest checked against what clips its control, what covers it and where the ghost is. A tour
// is three minutes of the page's clock and a file's tests run one by one: each size is a file, `.long.` to start first.

/** The slack of a measure, in px. */
const SLACK = 1.5

/** The ghost's tip in the screen, from its arrow's place in its layer (the arrow is drawn 4px right of, 2px below, it),
 * in the layer's own px, which the Homepage's zoom draws larger (ticket 1071). */
function ghostTip(editor: Element): { x: number; y: number } | undefined {
  const arrow = editor.querySelector<SVGElement>('[data-testid="inside-ghost"] .ghost--shown')
  const moved = arrow?.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/)
  if (!moved) return undefined
  const layer = arrow!.parentElement!
  const box = layer.getBoundingClientRect()
  const zoom = cssZoomOf(layer)
  return { x: box.left + (Number(moved[1]) + 4) * zoom, y: box.top + (Number(moved[2]) + 2) * zoom }
}

/** Where a scroller's room starts: under the headers stuck at its top (a section's title, a table's head), which cover
 * what scrolls beneath them. One round `element` is no cover. */
function underStuck(scroller: Element, element: Element, top: number): number {
  let under = top
  for (const each of scroller.querySelectorAll('*')) {
    if (each.contains(element) || getComputedStyle(each).position !== 'sticky') continue
    const box = each.getBoundingClientRect()
    if (box.height > 0 && box.top <= under + SLACK && box.bottom > under) under = box.bottom
  }
  return under
}

/** The part of the screen an element can show in: inside every ancestor that clips it, under the headers stuck at a
 * scroller's top, and the window; one in the top layer (a menu, a picker) is clipped by none of its ancestors past itself. */
function roomOf(element: Element): { left: number; top: number; right: number; bottom: number } {
  const room = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
  for (let up = element.parentElement; up; up = up.parentElement) {
    const style = getComputedStyle(up)
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) {
      const clip = up.getBoundingClientRect()
      const top = /(auto|scroll)/.test(style.overflowY) ? underStuck(up, element, clip.top) : clip.top
      Object.assign(room, { left: Math.max(room.left, clip.left), top: Math.max(room.top, top), right: Math.min(room.right, clip.right), bottom: Math.min(room.bottom, clip.bottom) })
    }
    if (up.matches(':popover-open')) break
  }
  return room
}

/** What shows at a point: the demo is inert all through (ticket 0879), which hit-testing passes over, so it is looked at
 * as a visitor's eye sees it, with its `inert` taken off for the look. */
function shownAt(x: number, y: number): Element | null {
  const sealed = [...document.querySelectorAll('[inert]')]
  for (const each of sealed) each.removeAttribute('inert')
  try {
    return document.elementFromPoint(x, y)
  } finally {
    for (const each of sealed) each.setAttribute('inert', '')
  }
}

/** What is wrong with what the ghost does to `control` now: nothing when it shows whole, uncovered, under the ghost, the
 * ghost above its menu, and every panel and popover open ends inside the demo's box. */
function unseen(editor: Element, control: Element, doing: string): string[] {
  const name = `${doing} ${control.getAttribute('data-testid') ?? control.getAttribute('aria-label') ?? control.className}`
  const box = control.getBoundingClientRect()
  if (box.width < 1 || box.height < 1) return [`${name}: not drawn`]
  const problems: string[] = []
  const seen = roomOf(control)
  // A control taller (or wider) than the room it shows in shows from its top (or its start).
  const across = box.width > seen.right - seen.left + SLACK ? box.left < seen.left - SLACK : box.left < seen.left - SLACK || box.right > seen.right + SLACK
  const down = box.height > seen.bottom - seen.top + SLACK ? box.top < seen.top - SLACK : box.top < seen.top - SLACK || box.bottom > seen.bottom + SLACK
  if (across || down) problems.push(`${name}: cut (${Math.round(box.top)}–${Math.round(box.bottom)} shows ${Math.round(seen.top)}–${Math.round(seen.bottom)})`)
  const room = editor.getBoundingClientRect()
  for (const open of editor.querySelectorAll('[data-testid="panel-dropdown"], [data-testid="color-popover"], .anchored-popup:popover-open')) {
    const edge = open.getBoundingClientRect()
    if (edge.top < room.top - SLACK || edge.bottom > room.bottom + SLACK) {
      problems.push(`${name}: ${open.getAttribute('data-testid') ?? open.className} runs past the demo's box (${Math.round(edge.top)}–${Math.round(edge.bottom)} in ${Math.round(room.top)}–${Math.round(room.bottom)})`)
    }
  }
  const layer = editor.querySelector('[data-testid="inside-ghost"]')!
  if (control.closest(':popover-open') && !layer.matches(':popover-open')) problems.push(`${name}: the ghost is under its menu`)
  const tip = ghostTip(editor)
  if (!tip) problems.push(`${name}: no ghost`)
  else {
    if (tip.x < box.left - SLACK || tip.x > box.right + SLACK || tip.y < box.top - SLACK || tip.y > box.bottom + SLACK) problems.push(`${name}: the ghost is not on it`)
    const top = shownAt(tip.x, tip.y)
    if (top && !control.contains(top)) problems.push(`${name}: covered by ${top.tagName.toLowerCase()} in ${top.closest('[data-testid]')?.getAttribute('data-testid')}`)
  }
  return problems
}

/** Watches the ghost's presses (a control's `click`) and rests (its `pointerenter`, the first of a rest's wrappers). */
function watchTheGhost(editor: Element) {
  const problems: string[] = []
  let checked = 0
  const click = HTMLElement.prototype.click
  const spy = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function (this: HTMLElement) {
    if (editor.contains(this) && ghostTip(editor)) {
      checked += 1
      problems.push(...unseen(editor, this, 'press'))
    }
    click.call(this)
  })
  let resting = false
  const onEnter = (event: Event) => {
    if (resting || event.isTrusted || !ghostTip(editor)) return
    resting = true
    queueMicrotask(() => (resting = false))
    checked += 1
    problems.push(...unseen(editor, event.target as Element, 'rest on'))
  }
  editor.addEventListener('pointerenter', onEnter, true)
  return {
    problems,
    checked: () => checked,
    stop() {
      spy.mockRestore()
      editor.removeEventListener('pointerenter', onEnter, true)
    },
  }
}

/** The tour plays with motion: these tests otherwise run under reduced motion, which shows each row's end at once. */
async function withMotion(on: boolean): Promise<void> {
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'no-preference' : 'reduce' }] })
}

/** How many times faster the page's clock runs while a tour plays (ticket 1143): at 4 a tour takes about a minute, not
 * over three, and still passed with the CPU slowed 3×. The test's own waits and limits are real seconds, untouched. */
const TOUR_SPEED = 4

/** A screen size the tour plays at, in px. */
type TourSize = readonly [width: number, height: number]

/** The sizes only `VITE_GHOST_TOURS=all` plays: a full-HD screen, a short laptop and a tablet. */
export const MORE_TOUR_SIZES: readonly TourSize[] = [[1920, 1080], [1180, 820], [834, 1194]]

/** Plays the whole tour at each size, every press and rest of the ghost checked; none plays unless `when` holds. */
export function playWholeTours(sizes: readonly TourSize[], when = true): void {
  let realClock: (() => Promise<void>) | undefined
  afterEach(async () => {
    await realClock?.()
    realClock = undefined
    await withMotion(false)
  })

  describe.runIf(when)("What's inside: everything the ghost presses is seen whole (ticket 0820)", () => {
    for (const [width, height] of sizes) {
      it(`a whole tour at ${width} × ${height}`, async () => {
        await withMotion(true)
        realClock = await runClockFaster(TOUR_SPEED)
        const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
        await page.viewport(width, height)
        // Welcome comes first (ticket 0830): the tour plays once the page is turned to What's inside, its demo there.
        await turnToSection(mounted.root, 'inside')
        const editor = mounted.root.querySelector('[data-testid="inside-editor"]')!
        const ghost = watchTheGhost(editor)
        const playing = () => mounted.root.querySelector('[data-testid="inside-chapters"] [aria-current="step"]')?.getAttribute('data-testid')
        try {
          await expect.poll(playing, { timeout: 8000 }).toBe('inside-chapter-draw')
          await expect.poll(playing, { timeout: 600_000, interval: 500 }).toBe('inside-chapter-weaveKeep')
          await expect.poll(playing, { timeout: 300_000, interval: 500 }).toBe('inside-chapter-draw')
        } finally {
          ghost.stop()
        }
        expect(ghost.problems).toEqual([])
        // The watch saw the ghost at work: any tour presses more than a handful of controls.
        expect(ghost.checked()).toBeGreaterThan(10)
      }, 900_000)
    }
  })
}
