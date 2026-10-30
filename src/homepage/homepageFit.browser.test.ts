import { describe, expect, it } from 'vitest'
import { FIT_LOCALES, misfitsNow, mountAt } from '../testUtils/browserFit'
import { unexplainedFit } from '../testUtils/fitPending'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'

// The Homepage has its own tiers, so it is tried at more widths than the rest (ticket 552).
const WIDTHS = [1900, 1280, 1024, 844, 820, 768, 390, 360, 320]

describe('HomePage text fit', () => {
  for (const width of WIDTHS) {
    // Mounted fresh at each width: the carousel is tabs or arrows by width, and its position would carry over a resize.
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, the page and every feature of the carousel`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 0 }, { locale, width })
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

// With Projects saved the hero holds Open the editor and Saved Projects · N side by side (ticket 0716).
describe('HomePage text fit with Projects saved', () => {
  for (const width of WIDTHS) {
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, the hero's two buttons`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 128 }, { locale, width })
        const labels = ['homepage-open-editor', 'homepage-saved-projects'].map((id) => mounted.root.querySelector(`[data-testid="${id}"]`)!.textContent!.trim())
        // The rest of the page is the case above's; only what these two buttons hold is checked here.
        expect((await misfitsNow()).filter((misfit) => labels.some((label) => misfit.includes(label)))).toEqual([])
      })
    }
  }
})
