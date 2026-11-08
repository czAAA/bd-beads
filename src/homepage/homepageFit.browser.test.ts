import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { FIT_LOCALES, misfitsNow, mountAt } from '../testUtils/browserFit'
import { unexplainedFit } from '../testUtils/fitPending'
import { page } from 'vitest/browser'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'
import { ROW_DONE_PASSES } from './inside/tourScripts'
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

// What's inside (tickets 0797, 0825): its band and its framed editor in the section's room, nothing cut and nothing
// wider than the box; under reduced motion the editor shows the first row's end. Its cards are the coffee screen's
// promises (0823).
describe("What's inside fits its room", () => {
  // Short windows (ticket 0802): the editor keeps its least height, seen whole (no hero, 0822; no cards, 0823).
  const sizes = [[1440, 900, 'desktop'], [1366, 680, 'short'], [1280, 640, 'short'], [1024, 768, 'laptop'], [820, 1180, 'tablet'], [600, 960, 'tablet'], [390, 844, 'phone']] as const
  for (const [width, height, tier] of sizes) {
    it(`at ${width} × ${height} (${tier})`, async () => {
      const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
      await page.viewport(width, height)
      await settleForMeasuring()
      const section = mounted.root.querySelector<HTMLElement>('[data-testid="homepage-section-inside"]')!
      expect(section.scrollWidth, 'nothing wider than the section').toBeLessThanOrEqual(section.clientWidth + 1)
      if (tier === 'phone') {
        expect(mounted.root.querySelector('[data-testid="inside-editor"]')).toBeNull()
      } else {
        const editor = boxOf(mounted.root, '[data-testid="inside-editor"]')
        expect(editor.height, 'the editor has room').toBeGreaterThan(tier === 'short' ? 230 : 300)
        // The section's whole width but its padding, `--space-16` (ticket 0825).
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
        expect(editor.left - section.getBoundingClientRect().left, "the editor the section's width").toBeCloseTo(rem, 0)
        expect(getComputedStyle(mounted.root.querySelector('[data-testid="inside-editor"]')!).boxShadow, 'the editor framed').not.toBe('none')
        // The band (ticket 0825): the heading beside the tabs from a 1000px box, over them under it; the caption under
        // both, then the editor.
        const band = boxOf(mounted.root, '[data-testid="inside-band"]')
        const heading = boxOf(mounted.root, '#homepage-inside')
        const tabs = boxOf(mounted.root, '[data-testid="inside-list"]')
        const caption = boxOf(mounted.root, '[data-testid="inside-caption"]')
        const box = mounted.root.querySelector<HTMLElement>('[data-testid="homepage"]')!.clientWidth
        if (box >= 1000) {
          expect(tabs.left, 'the tabs beside the heading').toBeGreaterThanOrEqual(heading.right)
          expect(Math.abs(tabs.top + tabs.height / 2 - (heading.top + heading.height / 2)), 'on its line').toBeLessThanOrEqual(2)
        } else expect(tabs.top, 'the tabs under the heading').toBeGreaterThanOrEqual(heading.bottom)
        expect(caption.top, 'the caption under the tabs').toBeGreaterThanOrEqual(tabs.bottom)
        expect(caption.bottom, 'the caption in the band').toBeLessThanOrEqual(band.bottom)
        expect(editor.top, 'the editor under the band').toBeGreaterThanOrEqual(band.bottom)
        expect(editor.bottom, 'the editor seen whole before the section scrolls').toBeLessThanOrEqual(section.getBoundingClientRect().bottom + 1)
        await expect.poll(() => mounted.root.querySelector('[aria-current="step"]')?.getAttribute('data-testid'), { timeout: 8000 }).toBe('inside-row-canvas')
        // The demo's view is set as it starts, so it is started afresh at this size, as a visitor's would be.
        mounted.root.querySelector<HTMLElement>('[data-testid="inside-row-canvas"]')!.click()
        // The first row's end: its Frame on a Margin sheet whose band the later rows reach for.
        await expect.poll(() => mounted.root.querySelector('[data-testid="inside-editor"] [data-testid="margin-band"]'), { timeout: 30000 }).not.toBeNull()
        // The view is sized to the Frame's real sheet, so the sheet and its band are never cut nor under the Tool pill
        // (ticket 0821).
        const area = boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="app-drawing-area"]')
        const pill = boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="tool-pill"]')
        const sheet = boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="margin-sheet"]')
        expect(sheet.top, 'the Margin sheet whole in the drawing area').toBeGreaterThanOrEqual(area.top - 1)
        expect(sheet.left, 'the Margin sheet whole in the drawing area').toBeGreaterThanOrEqual(area.left - 1)
        expect(sheet.right, 'the Margin sheet whole in the drawing area').toBeLessThanOrEqual(area.right + 1)
        expect(sheet.bottom, 'the Margin sheet clear of the Tool pill').toBeLessThanOrEqual(pill.top + 1)
        // The last tab, pressed, scrolls into the band's view; the caption keeps its height, so the editor its size.
        mounted.root.querySelector<HTMLElement>('[data-testid="inside-row-savedProjects"]')!.click()
        await expect.poll(() => {
          const last = boxOf(mounted.root, '[data-testid="inside-row-savedProjects"]')
          return last.left >= tabs.left - 1 && last.right <= tabs.right + 1
        }, { timeout: 4000 }).toBe(true)
        expect(boxOf(mounted.root, '[data-testid="inside-editor"]').height, 'the editor keeps its size').toBe(editor.height)
      }
      if (tier === 'desktop') {
        expect(section.scrollHeight, 'the section fits whole at 1440 × 900').toBeLessThanOrEqual(section.clientHeight + 1)
      }
      expect(unexplainedFit("What's inside", 'en', width, await misfitsNow())).toEqual([])
    }, 40000)
  }
})

// With Projects saved the strip holds Open the editor and Projects library · N beside Menu (tickets 0716, 0822).
describe('HomePage text fit with Projects saved', () => {
  for (const width of WIDTHS) {
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, the strip's two buttons`, async () => {
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
  it("applies all 13 rows, ending on the Starter's ring with its first rounds done", async () => {
    const warned = vi.spyOn(console, 'warn')
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    await page.viewport(1440, 900)
    await expect.poll(() => mounted.root.querySelector('[aria-current="step"]')?.getAttribute('data-testid'), { timeout: 8000 }).toBe('inside-row-canvas')
    mounted.root.querySelector<HTMLElement>('[data-testid="inside-row-savedProjects"]')!.click()
    // The row pressed lights at once, on the next render (ticket 0802); the rows are applied by the time the ring's first
    // rounds are done.
    await nextTick()
    expect(mounted.root.querySelector('[aria-current="step"]')?.getAttribute('data-testid')).toBe('inside-row-savedProjects')
    const editor = mounted.root.querySelector('[data-testid="inside-editor"]')!
    await expect.poll(() => editor.querySelector('[data-testid="progress-bar-position"]')?.textContent ?? '', { timeout: 30000 }).toMatch(new RegExp(`\\b${ROW_DONE_PASSES + 1}\\D`))
    expect(editor.querySelector('[data-testid="margin-sheet"]')).not.toBeNull()
    expect(warned).not.toHaveBeenCalled()
    warned.mockRestore()
  }, 45000)
})

/** A size token as the page resolves it, in px. */
function tokenSize(within: Element, token: string): string {
  const probe = document.createElement('span')
  probe.style.fontSize = `var(${token})`
  within.append(probe)
  const size = getComputedStyle(probe).fontSize
  probe.remove()
  return size
}

/** Whether two boxes share any pixel, beyond a rounding's pixel. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
}

// The strip (ticket 0822): the way into the editor beside Menu, or in a row of its own under 744px, never over the
// slogan, which is 24px (22px on a phone); nothing wider than the strip; Projects library's name hides under 1000px.
describe("The Homepage's strip at every tier", () => {
  for (const projectCount of [0, 128]) {
    for (const width of WIDTHS) {
      for (const locale of FIT_LOCALES) {
        it(`${projectCount ? 'with Projects saved' : 'a new visitor'}, ${locale} at ${width}px`, async () => {
          const mounted = await mountAt(HomePage, { projectCount, feedback: fakeFeedback() }, { locale, width })
          await settleForMeasuring()
          const strip = mounted.root.querySelector<HTMLElement>('[data-testid="canvas-strip"]')!
          const box = mounted.root.querySelector<HTMLElement>('[data-testid="homepage"]')!.clientWidth
          const wayIn = boxOf(strip, '[data-testid="strip-way-in"]')
          const menu = boxOf(strip, '[data-testid="strip-menu"]')
          const slogan = boxOf(strip, '[data-testid="homepage-slogan"]')
          expect(strip.scrollWidth, 'nothing wider than the strip').toBeLessThanOrEqual(strip.clientWidth + 1)
          expect(overlaps(wayIn, slogan), 'the way in clear of the slogan').toBe(false)
          expect(wayIn.left).toBeGreaterThanOrEqual(strip.getBoundingClientRect().left)
          expect(wayIn.right).toBeLessThanOrEqual(strip.getBoundingClientRect().right)
          if (box >= 744) expect(Math.abs(wayIn.top + wayIn.height / 2 - (menu.top + menu.height / 2)), 'beside Menu').toBeLessThanOrEqual(2)
          else expect(wayIn.top, 'a row of its own under Menu').toBeGreaterThanOrEqual(menu.bottom)
          const size = getComputedStyle(strip.querySelector('[data-testid="homepage-slogan"]')!).fontSize
          expect(size).toBe(tokenSize(strip, box <= 480 ? '--strip-slogan-size-phone' : '--strip-slogan-size'))
          expect(boxOf(strip, '[data-testid="zoom-reset"]').width > 0, 'the zoom, but not on a phone').toBe(box > 480)
          if (projectCount) {
            const name = boxOf(strip, '.canvas-strip__way-in-name')
            expect(name.width > 1, 'the library\'s name shown from 1000px').toBe(box >= 1000)
          }
          // The rest of the page is the first case's; only the strip's own text is checked here.
          const texts = [...strip.querySelectorAll('button, a, span')].map((el) => el.textContent!.trim()).filter(Boolean)
          expect((await misfitsNow()).filter((misfit) => texts.some((text) => misfit.includes(`"${text}"`)))).toEqual([])
        })
      }
    }
  }
})
