import { describe, expect, it } from 'vitest'
import { FIT_LOCALES, misfitsNow, mountAt } from '../testUtils/browserFit'
import { unexplainedFit } from '../testUtils/fitPending'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'
import { fakeFeedback } from '../testUtils/fakeFeedback'

// The Homepage has its own tiers, so it is tried at more widths than the rest (ticket 552).
const WIDTHS = [1900, 1280, 1024, 844, 820, 768, 390, 360, 320]

/** Turns the page to a section; the browser tests run under reduced motion, so it swaps without sliding. */
async function turnTo(root: Element, section: number) {
  const page = root.querySelector<HTMLElement>('[data-testid="homepage-page"]')!
  page.scrollTo({ top: section * page.clientHeight })
  page.dispatchEvent(new Event('scroll'))
  await settleForMeasuring()
}

describe('HomePage text fit', () => {
  for (const width of WIDTHS) {
    // Mounted fresh at each width: the carousel's list stands beside its stage or above it by width.
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, every section and every feature of the carousel`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width })
        const found = await misfitsNow()
        const tabs = [...mounted.root.querySelectorAll<HTMLElement>('[role="tab"]')]
        expect(tabs.length, 'the carousel shows its features').toBeGreaterThan(1)
        for (const tab of tabs.slice(1)) {
          tab.click()
          await settleForMeasuring()
          found.push(...(await misfitsNow()))
        }
        // The coffee tile, then the plans with the free list.
        for (const section of [1, 2]) {
          await turnTo(mounted.root, section)
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
        const mounted = await mountAt(HomePage, { projectCount: 128, feedback: fakeFeedback() }, { locale, width })
        const labels = ['homepage-open-editor', 'homepage-saved-projects'].map((id) => mounted.root.querySelector(`[data-testid="${id}"]`)!.textContent!.trim())
        // The rest of the page is the case above's; only what these two buttons hold is checked here.
        expect((await misfitsNow()).filter((misfit) => labels.some((label) => misfit.includes(label)))).toEqual([])
      })
    }
  }
})
