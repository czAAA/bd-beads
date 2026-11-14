import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, type Mounted } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { turnToSection } from '../testUtils/homepageSection'
import HomePage from './HomePage.vue'

// More below in a real browser (tickets 0826, 0870): on the section bar's top edge, only while the section shown scrolls
// on, a press scrolling it; gone on a section that fits whole and once an end shows. Whether one scrolls on is the tier's.

let mounted: Mounted
afterEach(() => mounted.unmount())

/** The Homepage at a size; with Projects saved the plans are the three, whose free list grows (ticket 0947). */
async function homepageAt(width: number, height: number, projectCount = 0) {
  mounted = await mountAt(HomePage, { projectCount, feedback: fakeFeedback() }, { locale: 'en', width })
  await page.viewport(width, height)
  await settleForMeasuring()
}

const el = (selector: string) => mounted.root.querySelector<HTMLElement>(selector)
const shownSection = () => el('.homepage__section--shown')!
const shown = () => shownSection().dataset.testid!.replace('homepage-section-', '')
const pill = () => el('[data-testid="more-below-button"]')

async function pressMore() {
  pill()!.click()
  await settleForMeasuring()
}

async function pressNext() {
  el('[data-testid="section-next"]')!.click()
  await settleForMeasuring()
}

describe('More below (ticket 0826)', () => {
  it('rides on the section bar\'s top edge, a third of it below the edge, taking no room of the section\'s', async () => {
    await homepageAt(1440, 900, 3)
    await turnToSection(mounted.root, 'plans')
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

  it('where a section fits whole, is hidden and Next turns; on the plans, which scroll on, scrolls them, gone at their end', async () => {
    await homepageAt(1440, 900, 3)
    for (const id of ['welcome', 'inside', 'coffee']) {
      expect(shown()).toBe(id)
      expect(shownSection().scrollHeight, `${id} fits whole here`).toBeLessThanOrEqual(shownSection().clientHeight + 1)
      expect(pill(), `nothing more below on ${id}`).toBeNull()
      await pressNext()
    }
    expect(shown()).toBe('plans')
    expect(pill(), 'the plans scroll on as the free list grows').not.toBeNull()
    for (let presses = 0; pill() && presses < 20; presses += 1) {
      const top = shownSection().scrollTop
      await pressMore()
      expect(shown()).toBe('plans')
      expect(shownSection().scrollTop).toBeGreaterThan(top)
    }
    expect(pill(), 'gone once the end shows').toBeNull()
  })

  it('where a section is taller than its room, scrolls it on to its end, then is gone, Next turning', async () => {
    await homepageAt(1280, 480)
    await turnToSection(mounted.root, 'inside')
    const inside = shownSection()
    expect(inside.scrollHeight, 'What\'s inside scrolls on here').toBeGreaterThan(inside.clientHeight)
    await pressMore()
    expect(shown()).toBe('inside')
    expect(inside.scrollTop).toBeGreaterThan(0)
    for (let presses = 0; pill() && presses < 10; presses += 1) await pressMore()
    expect([shown(), pill()]).toEqual(['inside', null])
    await pressNext()
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
