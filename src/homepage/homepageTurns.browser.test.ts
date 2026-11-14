import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mountAt, type Mounted } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import HomePage from './HomePage.vue'

// The Homepage turning both ways in a real browser (ticket 0801): with motion on and What's inside's editor playing, as
// a beader sees it. The page used to be a snapping scroller that the browser snapped back whenever the playing editor
// changed its layout, so no way at all led back up from the coffee tile.

/** Longer than a turn and its rest (`--section-turn`), so what is shown is where the page settled. */
const SETTLE = 1200
const settle = () => new Promise((done) => setTimeout(done, SETTLE))

let mounted: Mounted
const shown = () => mounted.root.querySelector('.homepage__section--shown')?.getAttribute('data-testid')?.replace('homepage-section-', '')
const testid = (id: string) => mounted.root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!

const realMatchMedia = window.matchMedia
/** The page as it moves: the browser tests run under reduced motion, which hides the bug, so the page is told it is off. */
function withMotion() {
  window.matchMedia = (query) => realMatchMedia.call(window, query.includes('prefers-reduced-motion') ? '(max-width: 0px)' : query)
}

beforeEach(async () => {
  withMotion()
  mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
  await page.viewport(1440, 900)
})

/** What's inside's editor is playing its tour: its layout changes many times a second. */
async function playing() {
  expect(shown()).toBe('inside')
  await expect.poll(() => mounted.root.querySelector('[data-testid="inside-chapters"] [aria-current="step"]')?.getAttribute('data-testid'), { timeout: 8000 }).toBe('inside-chapter-draw')
}

afterEach(() => {
  mounted.unmount()
  window.matchMedia = realMatchMedia
})

describe('The Homepage turns both ways (ticket 0801)', () => {
  it('by Next and Back, through every section and back to Welcome', async () => {
    for (const to of ['inside', 'coffee', 'plans']) {
      testid('section-next').click()
      await settle()
      expect(shown()).toBe(to)
      if (to === 'inside') await playing()
    }
    for (const to of ['coffee', 'inside', 'welcome']) {
      testid('section-back').click()
      await settle()
      expect(shown()).toBe(to)
    }
  })

  it('by the wheel, one section a scroll, down through the plans\' free list and back up', async () => {
    // The free list grows only on the three plans, shown once Projects are saved (ticket 0947).
    mounted.unmount()
    mounted = await mountAt(HomePage, { projectCount: 3, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    const strip = testid('canvas-strip')
    for (const to of ['inside', 'coffee', 'plans']) {
      await userEvent.wheel(strip, { delta: { y: 100 } })
      await settle()
      expect(shown()).toBe(to)
      if (to === 'inside') await playing()
    }
    // Over the plans the wheel scrolls their section, growing the free list, and turns nothing.
    const plans = testid('homepage-section-plans')
    await userEvent.wheel(plans, { delta: { y: 100 } })
    await settle()
    expect(shown()).toBe('plans')
    expect(plans.scrollTop).toBeGreaterThan(0)
    // Back at its top, the next scroll up turns to the coffee tile.
    await userEvent.wheel(plans, { delta: { y: -100 } })
    await settle()
    expect(plans.scrollTop).toBe(0)
    for (const to of ['coffee', 'inside', 'welcome']) {
      await userEvent.wheel(strip, { delta: { y: -100 } })
      await settle()
      expect(shown()).toBe(to)
    }
  })

  it('by the keys, from wherever the focus is', async () => {
    await userEvent.keyboard('{PageDown}')
    await settle()
    await playing()
    await userEvent.keyboard('{PageDown}')
    await settle()
    expect(shown()).toBe('coffee')
    await userEvent.keyboard('{ArrowDown}')
    await settle()
    expect(shown()).toBe('plans')
    await userEvent.keyboard('{Home}')
    await settle()
    expect(shown()).toBe('welcome')
    // A press on the box's own ground takes the focus off the page; the keys still turn it.
    ;(document.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('{PageDown}')
    await settle()
    expect(shown()).toBe('inside')
    await userEvent.keyboard('{PageUp}')
    await settle()
    expect(shown()).toBe('welcome')
  })

  it('never scrolls the page itself: the box stands still while it turns', async () => {
    testid('section-next').click()
    await settle()
    await playing()
    testid('section-next').click()
    await settle()
    testid('section-back').click()
    await settle()
    expect(testid('homepage-page').scrollTop).toBe(0)
  })
})
