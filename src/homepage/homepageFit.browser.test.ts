import { describe, expect, it } from 'vitest'
import { FIT_LOCALES, misfitsNow, mountAt } from '../testUtils/browserFit'
import { unexplainedFit } from '../testUtils/fitPending'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'
import { fakeFeedback } from '../testUtils/fakeFeedback'

// The Homepage has its own tiers, so it is tried at more widths than the rest (ticket 552).
const WIDTHS = [1900, 1280, 1024, 844, 820, 768, 390, 360, 320]

describe('HomePage text fit', () => {
  for (const width of WIDTHS) {
    // Mounted fresh at each width: the carousel is tabs or arrows by width, and its position would carry over a resize.
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, the page and every feature of the carousel`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width })
        const found = await misfitsNow()
        // From 1024 the features are tabs; below, the arrows page through them, and the count says how many there are.
        const tabs = [...mounted.root.querySelectorAll<HTMLElement>('[role="tab"]')].filter((tab) => tab.offsetParent !== null)
        const next = mounted.root.querySelector<HTMLElement>('[data-testid="feature-next"]')
        const total = tabs.length > 0 ? tabs.length : Number(mounted.root.querySelector('[data-testid="feature-count"]')?.textContent?.split('/')[1])
        expect(total, 'the carousel shows its features').toBeGreaterThan(1)
        for (let i = 1; i < total; i += 1) {
          if (tabs.length > 0) tabs[i].click()
          else next!.click()
          await settleForMeasuring()
          found.push(...(await misfitsNow()))
        }
        expect(unexplainedFit('HomePage', locale, width, [...new Set(found)])).toEqual([])
      })
    }
  }
})
