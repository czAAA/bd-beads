import { describe, expect, it } from 'vitest'
import type {} from '@vitest/browser-playwright'
import { cdp, page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import { fakeFeedback } from '../../testUtils/fakeFeedback'
import { turnToSection } from '../../testUtils/homepageSection'
import HomePage from '../HomePage.vue'
import { TURN_REST } from '../wheelTurn'

// The demo is only to watch (ticket 0879), and it answers the beader's own hand (ticket 0950): a press in it lights
// Open editor from here and focuses it, and a swipe over it turns the page as a wheel does. The input is the browser's
// own (CDP), trusted as a visitor's is; the demo is inert, so a locator could not press it.

/** The middle of the demo's drawing area, where a visitor would tap. */
function middleOf(root: Element): { x: number; y: number } {
  const area = root.querySelector('[data-testid="inside-editor"] [data-testid="app-drawing-area"]')!.getBoundingClientRect()
  return { x: Math.round(area.left + area.width / 2), y: Math.round(area.top + area.height / 2) }
}

const shownSection = (root: Element) => root.querySelector('.homepage__section--shown')?.getAttribute('data-testid')

describe("What's inside: the demo answers a press and lets a swipe through (ticket 0950)", () => {
  it('a click in the demo lights Open editor from here and focuses it; nothing in the demo changes', async () => {
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    await page.viewport(1440, 900)
    await turnToSection(mounted.root, 'inside')
    const open = mounted.root.querySelector<HTMLElement>('[data-testid="inside-open-from-here"]')!
    expect(open.classList.contains('app-button--primary')).toBe(false)
    const { x, y } = middleOf(mounted.root)
    for (const type of ['mousePressed', 'mouseReleased'] as const) await cdp().send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
    await expect.poll(() => document.activeElement).toBe(open)
    expect(open.classList.contains('app-button--primary')).toBe(true)
    // The browser tests run under reduced motion, where the look changes with no fade.
    expect(getComputedStyle(open).transitionDuration.split(', ').every((each) => each === '0s')).toBe(true)
    expect(shownSection(mounted.root)).toBe('homepage-section-inside')
  })

  it("a right click in the demo opens no Radial toolbox: only the tour's ghost opens it (ticket 1114)", async () => {
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    await page.viewport(1440, 900)
    await turnToSection(mounted.root, 'inside')
    const ring = mounted.root.querySelector<HTMLElement>('[data-testid="inside-editor"] [data-testid="radial-toolbox"]')!
    const { x, y } = middleOf(mounted.root)
    const arrived = new Promise<Event>((resolve) => document.addEventListener('contextmenu', resolve, { once: true }))
    for (const type of ['mousePressed', 'mouseReleased'] as const) await cdp().send('Input.dispatchMouseEvent', { type, x, y, button: 'right', clickCount: 1 })
    // The click passes over the inert Canvas, as every press does; the ring, which opens at the lift, stays shut.
    expect(mounted.root.querySelector('[data-testid="inside-editor"] [data-testid="app-drawing-area"]')!.contains((await arrived).target as Node)).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(ring.style.display).toBe('none')
  })

  it('a swipe up of 48px over the demo turns to the next section', async () => {
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    await page.viewport(1440, 900)
    await turnToSection(mounted.root, 'inside')
    // The real touch goes through the inert demo to the page, which the unit test of the swipe can't show. A section
    // stands `TURN_REST` after a turn before a swipe turns it again.
    await new Promise((resolve) => setTimeout(resolve, TURN_REST))
    const { x, y } = middleOf(mounted.root)
    await cdp().send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await cdp().send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 30 }] })
    await cdp().send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 52 }] })
    await cdp().send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => shownSection(mounted.root)).toBe('homepage-section-coffee')
  })
})
