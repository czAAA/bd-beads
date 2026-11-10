import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, type Mounted } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { turnToSection } from '../testUtils/homepageSection'
import HomePage from './HomePage.vue'

// More below in a real browser (ticket 0826): on the section bar's top edge, where a section scrolls on it scrolls it,
// else it turns to the next section; gone on the last once its end shows. Whether a section scrolls on is the tier's.

let mounted: Mounted
afterEach(() => mounted.unmount())

async function homepageAt(width: number, height: number) {
  mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
  await page.viewport(width, height)
  await settleForMeasuring()
}

const el = (selector: string) => mounted.root.querySelector<HTMLElement>(selector)
const shownSection = () => el('.homepage__section--shown')!
const shown = () => shownSection().dataset.testid!.replace('homepage-section-', '')
const pill = () => el('[data-testid="more-below-button"]')
const fading = () => el('[data-testid="more-below"]')!.classList.contains('more-below--fade')

async function pressMore() {
  pill()!.click()
  await settleForMeasuring()
}

describe('More below (ticket 0826)', () => {
  it('rides on the section bar\'s top edge, a third of it below the edge, taking no room of the section\'s', async () => {
    await homepageAt(1440, 900)
    const button = pill()!.getBoundingClientRect()
    const bar = el('[data-testid="section-bar"]')!.getBoundingClientRect()
    expect(button.top).toBeLessThan(bar.top)
    const overhang = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--more-below-overhang')) / 100
    expect(button.bottom - bar.top).toBeCloseTo(button.height * overhang, 0)
    // Drawn over the bar, not under it.
    const below = document.elementFromPoint(button.left + button.width / 2, (bar.top + button.bottom) / 2)
    expect(pill()!.contains(below)).toBe(true)
    expect(button.left + button.width / 2).toBeCloseTo(bar.left + bar.width / 2, 0)
    const body = el('[data-testid="homepage-body"]')!.getBoundingClientRect()
    expect(body.bottom).toBe(bar.top)
  })

  it('where every section fits, turns to the next as Next does, then scrolls the plans on as the free list grows, gone at its end', async () => {
    await homepageAt(1440, 900)
    expect([shown(), fading()]).toEqual(['welcome', false])
    await pressMore()
    expect([shown(), fading()]).toEqual(['inside', false])
    await pressMore()
    expect([shown(), fading()]).toEqual(['coffee', false])
    await pressMore()
    expect(shown()).toBe('plans')
    expect(fading(), 'the plans scroll on as the free list grows').toBe(true)
    for (let presses = 0; pill() && presses < 20; presses += 1) {
      const top = shownSection().scrollTop
      await pressMore()
      expect(shown()).toBe('plans')
      expect(shownSection().scrollTop).toBeGreaterThan(top)
    }
    expect(pill(), 'gone once the end shows').toBeNull()
  })

  it('where a section is taller than its room, scrolls it on to its end first, with the fade, then turns', async () => {
    await homepageAt(1280, 480)
    await turnToSection(mounted.root, 'inside')
    const inside = shownSection()
    expect(inside.scrollHeight, 'What\'s inside scrolls on here').toBeGreaterThan(inside.clientHeight)
    expect(fading()).toBe(true)
    await pressMore()
    expect(shown()).toBe('inside')
    expect(inside.scrollTop).toBeGreaterThan(0)
    for (let presses = 0; fading() && presses < 10; presses += 1) await pressMore()
    expect([shown(), fading()]).toEqual(['inside', false])
    await pressMore()
    expect(shown()).toBe('coffee')
  })

  it('on a phone shows only while the section scrolls on', async () => {
    await homepageAt(390, 844)
    await turnToSection(mounted.root, 'inside')
    const inside = shownSection()
    expect(inside.scrollHeight).toBeGreaterThan(inside.clientHeight)
    expect(pill()).not.toBeNull()
    inside.scrollTop = inside.scrollHeight
    await settleForMeasuring()
    expect(pill()).toBeNull()
  })
})
