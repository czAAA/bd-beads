import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { FIT_LOCALES, mountAt } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { turnToSection } from '../testUtils/homepageSection'
import { en } from '../i18n/en'
import HomePage from './HomePage.vue'
import { freeListRows } from './freeList'

/** Whether a box stands wholly inside another, give or take a rounding's pixel. */
function within(inner: DOMRect, outer: DOMRect): boolean {
  return inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1 && inner.left >= outer.left - 1 && inner.right <= outer.right + 1
}

// A new visitor's Free to use (ticket 0947): at the iPad's and the laptop's size, in the longest language too, every row
// of the free list stands in the section's room at once, and the section has nowhere to scroll its heading or way in to.
describe('Free to use shows the whole free list', () => {
  for (const [width, height] of [[1366, 1024], [1470, 956]] as const) {
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width} × ${height}`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width })
        await page.viewport(width, height)
        await turnToSection(mounted.root, 'plans')
        const section = mounted.root.querySelector<HTMLElement>('[data-testid="homepage-section-plans"]')!
        const room = section.getBoundingClientRect()
        const rows = [...section.querySelectorAll('[data-testid="free-to-use"] li')]
        expect(rows, 'every row and More on the way').toHaveLength(freeListRows(en, 'en').length + 1)
        for (const row of rows) expect(within(row.getBoundingClientRect(), room), `"${row.textContent}" in view`).toBe(true)
        expect(section.querySelectorAll('[data-testid^="free-group-"]')).toHaveLength(4)
        expect(section.scrollHeight, 'nothing to swipe to').toBeLessThanOrEqual(section.clientHeight + 1)
        for (const selector of ['#homepage-plans', '[data-testid="free-to-use-way-in"]']) {
          expect(within(section.querySelector(selector)!.getBoundingClientRect(), room), `${selector} in view`).toBe(true)
        }
        mounted.unmount()
      }, 30000)
    }
  }
})
