import { describe, expect, it, vi } from 'vitest'
import { FIT_LOCALES, misfitsNow, mountAt } from '../testUtils/browserFit'
import { unexplainedFit } from '../testUtils/fitPending'
import { page } from 'vitest/browser'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'
import { fakeFeedback } from '../testUtils/fakeFeedback'

// The Homepage has its own tiers, so it is tried at more widths than the rest (ticket 552).
const WIDTHS = [1900, 1280, 1024, 844, 820, 768, 390, 360, 320]

/** Turns the page to a section by its step; the browser tests run under reduced motion, so it swaps without sliding. */
async function turnTo(root: Element, section: number) {
  root.querySelectorAll<HTMLElement>('[data-testid="section-step"]')[section]!.click()
  await settleForMeasuring()
}

describe('HomePage text fit', () => {
  for (const width of WIDTHS) {
    // Mounted fresh at each width: What's inside's list stands beside its editor, above it as tabs, or alone by width.
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, every section`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width })
        await settleForMeasuring()
        const found = await misfitsNow()
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

/** Where an element is, in whole px. */
function boxOf(root: Element, selector: string): DOMRect {
  return root.querySelector(selector)!.getBoundingClientRect()
}

// What's inside (ticket 0797): its cards, its list and its editor in the section's room, nothing cut and nothing wider
// than the box; under reduced motion the editor shows the first row's end.
describe("What's inside fits its room", () => {
  for (const [width, height, tier] of [[1440, 900, 'desktop'], [820, 1180, 'tablet'], [390, 844, 'phone']] as const) {
    it(`at ${width} × ${height} (${tier})`, async () => {
      const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
      await page.viewport(width, height)
      await settleForMeasuring()
      const section = mounted.root.querySelector<HTMLElement>('[data-testid="homepage-section-inside"]')!
      expect(section.scrollWidth, 'nothing wider than the section').toBeLessThanOrEqual(section.clientWidth + 1)
      const cards = [...mounted.root.querySelectorAll('[data-testid^="inside-card-"]')].map((card) => card.getBoundingClientRect())
      expect(cards).toHaveLength(4)
      const columns = new Set(cards.map((card) => Math.round(card.left))).size
      expect(columns).toBe(tier === 'desktop' ? 4 : tier === 'tablet' ? 2 : 1)
      if (tier === 'phone') {
        expect(mounted.root.querySelector('[data-testid="inside-editor"]')).toBeNull()
      } else {
        const editor = boxOf(mounted.root, '[data-testid="inside-editor"]')
        expect(editor.height, 'the editor has room').toBeGreaterThan(300)
        await expect.poll(() => mounted.root.querySelector('[aria-current="step"]')?.getAttribute('data-testid'), { timeout: 8000 }).toBe('inside-row-canvas')
      }
      if (tier === 'desktop') {
        expect(section.scrollHeight, 'the section fits whole at 1440 × 900').toBeLessThanOrEqual(section.clientHeight + 1)
        const list = boxOf(mounted.root, '[data-testid="inside-list"]')
        const playing = boxOf(mounted.root, '[aria-current="step"]')
        expect(playing.top).toBeGreaterThanOrEqual(list.top - 1)
        expect(playing.bottom).toBeLessThanOrEqual(list.bottom + 1)
      }
      expect(await misfitsNow()).toEqual([])
    })
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

// The tour's own steps on the real editor (ticket 0797): a press on the last row applies all 13 at once (reduced motion,
// as these tests run), so a control a row reaches for that has moved or gone fails here, not only in a browser by eye.
describe("What's inside's tour on the real editor", () => {
  it('applies all 13 rows, ending on the earring with every row done', async () => {
    const warned = vi.spyOn(console, 'warn')
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    await page.viewport(1440, 900)
    await expect.poll(() => mounted.root.querySelector('[aria-current="step"]')?.getAttribute('data-testid'), { timeout: 8000 }).toBe('inside-row-canvas')
    mounted.root.querySelector<HTMLElement>('[data-testid="inside-row-savedProjects"]')!.click()
    await expect.poll(() => mounted.root.querySelector('[aria-current="step"]')?.getAttribute('data-testid'), { timeout: 30000 }).toBe('inside-row-savedProjects')
    const editor = mounted.root.querySelector('[data-testid="inside-editor"]')!
    expect(editor.querySelector('[data-testid="margin-sheet"]')).not.toBeNull()
    expect(editor.querySelector('[data-testid="progress-bar-next"]')!.getAttribute('aria-disabled')).toBe('true')
    expect(warned).not.toHaveBeenCalled()
    warned.mockRestore()
  }, 45000)
})
