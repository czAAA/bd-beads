import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { FIT_LOCALES, misfitsNow, mountAt } from '../testUtils/browserFit'
import { unexplainedFit } from '../testUtils/fitPending'
import { page } from 'vitest/browser'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { turnToSection } from '../testUtils/homepageSection'
import HomePage from './HomePage.vue'
import { ROW_DONE_PASSES } from './inside/tourScripts'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { tokenPx } from '../testUtils/tokenPx'

// The Homepage has its own tiers, so it is tried at more widths than the rest (ticket 552).
const WIDTHS = [1900, 1280, 1024, 844, 820, 768, 390, 360, 320]

describe('HomePage text fit', () => {
  for (const width of WIDTHS) {
    // Mounted fresh at each width: What's inside's list stands beside its editor, above it as tabs, or alone by width.
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, every section`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width })
        await settleForMeasuring()
        const found = await misfitsNow()
        // Welcome first; then What's inside, the coffee tile and the plans with the free list.
        for (const section of ['inside', 'coffee', 'plans'] as const) {
          await turnToSection(mounted.root, section)
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

// What's inside (tickets 0797, 0825, 0830): the list beside its framed demo from a 1000px box, the band over it under
// that, nothing cut and nothing wider than the box; under reduced motion the editor shows the first row's end.
describe("What's inside fits its room", () => {
  // Short windows (ticket 0802): the editor keeps its least height, seen whole (no hero, 0822; no cards, 0823).
  const sizes = [[1440, 900, 'desktop'], [1366, 680, 'short'], [1280, 640, 'short'], [1024, 768, 'laptop'], [820, 1180, 'tablet'], [600, 960, 'tablet'], [390, 844, 'phone']] as const
  for (const [width, height, tier] of sizes) {
    it(`at ${width} × ${height} (${tier})`, async () => {
      const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
      await page.viewport(width, height)
      await turnToSection(mounted.root, 'inside')
      const section = mounted.root.querySelector<HTMLElement>('[data-testid="homepage-section-inside"]')!
      const press = (id: string) => mounted.root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click()
      const lit = () => mounted.root.querySelector('[data-testid="inside-chapters"] [aria-current="step"]')?.getAttribute('data-testid')
      expect(section.scrollWidth, 'nothing wider than the section').toBeLessThanOrEqual(section.clientWidth + 1)
      if (tier === 'phone') {
        expect(mounted.root.querySelector('[data-testid="inside-editor"]')).toBeNull()
        expect(mounted.root.querySelector('[data-testid="inside-chapters"]')).toBeNull()
      } else {
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
        const room = section.getBoundingClientRect()
        const editor = boxOf(mounted.root, '[data-testid="inside-editor"]')
        expect(editor.height, 'the editor has room').toBeGreaterThan(tier === 'short' ? 230 : 300)
        expect(getComputedStyle(mounted.root.querySelector('[data-testid="inside-editor"]')!).boxShadow, 'the editor framed').not.toBe('none')
        const guide = boxOf(mounted.root, '[data-testid="inside-guide"]')
        const heading = boxOf(mounted.root, '#homepage-inside')
        const chapters = [...mounted.root.querySelectorAll('[data-testid^="inside-chapter-"]')].map((chapter) => chapter.getBoundingClientRect())
        const caption = boxOf(mounted.root, '[data-testid="inside-caption"]')
        const controls = boxOf(mounted.root, '.inside__controls')
        const box = mounted.root.querySelector<HTMLElement>('[data-testid="homepage"]')!.clientWidth
        const layout = mounted.root.querySelector('[data-testid="whats-inside"]')!.getAttribute('data-layout')
        expect(chapters).toHaveLength(4)
        expect(layout, 'the list beside the demo from a 1000px box').toBe(box >= 1000 ? 'beside' : 'band')
        // The section's padding, `--space-16`, on the left of whichever stands first.
        expect(guide.left - room.left, "from the section's edge").toBeCloseTo(rem, 0)
        if (layout === 'beside') {
          // The list: `--inside-list-width` wide, 12px from the demo and as tall as it; the heading, the chapters one
          // under another, the caption, and the two buttons at its foot. Expand stands first in the demo's strip.
          expect(guide.width).toBeCloseTo(tokenPx(mounted.root, '--inside-list-width'), 0)
          expect(editor.left - guide.right, '12px from the demo').toBeCloseTo(tokenPx(mounted.root, '--space-12'), 0)
          expect(guide.height, 'as tall as the demo').toBeCloseTo(editor.height, 0)
          expect(chapters[0]!.top).toBeGreaterThanOrEqual(heading.bottom)
          for (const [i, chapter] of chapters.entries()) {
            expect(chapter.height).toBeCloseTo(tokenPx(mounted.root, '--inside-row-height'), 0)
            if (i) expect(chapter.top, 'one under another').toBeGreaterThanOrEqual(chapters[i - 1]!.bottom - 1)
          }
          expect(caption.top, 'the caption under the chapters').toBeGreaterThanOrEqual(chapters[3]!.bottom)
          expect(controls.top, 'the buttons under the caption').toBeGreaterThanOrEqual(caption.bottom)
          expect(controls.bottom, 'at the list\'s foot').toBeLessThanOrEqual(guide.bottom)
          expect(guide.bottom - controls.bottom, 'at the list\'s foot').toBeLessThanOrEqual(rem + 2)
          const expand = boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="strip-expand"]')
          expect(expand.right, 'Expand before Reference image').toBeLessThanOrEqual(boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="strip-reference-image"]').left)
          expect(expand.height).toBeCloseTo(tokenPx(mounted.root, '--control-height-small'), 0)
        } else {
          // The band: the heading over the chapters' line, the caption under it, then the demo; no Expand.
          expect(chapters[0]!.top, 'the chapters under the heading').toBeGreaterThanOrEqual(heading.bottom)
          expect(new Set(chapters.map((chapter) => Math.round(chapter.top))).size, 'the chapters on one line').toBe(1)
          expect(caption.top, 'the caption under the chapters').toBeGreaterThanOrEqual(chapters[0]!.bottom)
          expect(caption.bottom, 'the caption in the band').toBeLessThanOrEqual(guide.bottom)
          expect(editor.top, 'the demo under the band').toBeGreaterThanOrEqual(guide.bottom)
          expect(editor.right - editor.left, "the demo the section's width").toBeCloseTo(guide.width, 0)
          expect(mounted.root.querySelector('[data-testid="strip-expand"]')).toBeNull()
        }
        expect(editor.bottom, 'the editor seen whole before the section scrolls').toBeLessThanOrEqual(room.bottom + 1)
        await expect.poll(lit, { timeout: 8000 }).toBe('inside-chapter-draw')
        // The demo's view is set as it starts, so it is started afresh at this size, as a visitor's would be: another
        // chapter, then Draw again, shows its first row's end.
        press('inside-chapter-startFrom')
        press('inside-chapter-draw')
        // The first row's end: its Frame on a Margin sheet whose band the later rows reach for.
        await expect.poll(() => mounted.root.querySelector('[data-testid="inside-editor"] [data-testid="margin-band"]'), { timeout: 30000 }).not.toBeNull()
        expect(mounted.root.querySelector('[data-testid="inside-caption-shown"]')!.textContent).toContain('1 / 13')
        // The view is sized to the Frame's real sheet, so the sheet and its band are never cut nor under the Tool pill
        // (ticket 0821), in the list's narrower demo too.
        const area = boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="app-drawing-area"]')
        const pill = boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="tool-pill"]')
        const sheet = boxOf(mounted.root, '[data-testid="inside-editor"] [data-testid="margin-sheet"]')
        expect(sheet.top, 'the Margin sheet whole in the drawing area').toBeGreaterThanOrEqual(area.top - 1)
        expect(sheet.left, 'the Margin sheet whole in the drawing area').toBeGreaterThanOrEqual(area.left - 1)
        expect(sheet.right, 'the Margin sheet whole in the drawing area').toBeLessThanOrEqual(area.right + 1)
        expect(sheet.bottom, 'the Margin sheet clear of the Tool pill').toBeLessThanOrEqual(pill.top + 1)
        // The last chapter, pressed, lights and comes into the chapters' view; the caption keeps its height, so the
        // editor its size.
        press('inside-chapter-weaveKeep')
        const list = boxOf(mounted.root, '[data-testid="inside-chapters"]')
        await expect.poll(() => {
          const last = boxOf(mounted.root, '[data-testid="inside-chapter-weaveKeep"]')
          return lit() === 'inside-chapter-weaveKeep' && last.left >= list.left - 1 && last.right <= list.right + 1
        }, { timeout: 4000 }).toBe(true)
        expect(boxOf(mounted.root, '[data-testid="inside-editor"]').height, 'the editor keeps its size').toBe(editor.height)
      }
      if (tier === 'desktop') {
        expect(section.scrollHeight, 'the section fits whole at 1440 × 900').toBeLessThanOrEqual(section.clientHeight + 1)
      }
      expect(unexplainedFit("What's inside", 'en', width, await misfitsNow())).toEqual([])
    }, 40000)
  }

  // Expand (ticket 0830): the demo takes the section's width, the list's parts going into the band over it on one line.
  for (const locale of FIT_LOCALES) {
    it(`expanded at 1440 × 900, ${locale}: the band on one line over a demo the section's width, and back`, async () => {
      const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width: 1440 })
      await page.viewport(1440, 900)
      await turnToSection(mounted.root, 'inside')
      const inside = mounted.root.querySelector('[data-testid="whats-inside"]')!
      const expand = () => mounted.root.querySelector<HTMLElement>('[data-testid="inside-editor"] [data-testid="strip-expand"]')!
      const beside = boxOf(mounted.root, '[data-testid="inside-editor"]')
      const word = expand().getBoundingClientRect().width
      expand().click()
      await settleForMeasuring()
      expect(inside.getAttribute('data-layout')).toBe('band')
      const guide = boxOf(mounted.root, '[data-testid="inside-guide"]')
      const editor = boxOf(mounted.root, '[data-testid="inside-editor"]')
      const heading = boxOf(mounted.root, '#homepage-inside')
      const chapters = boxOf(mounted.root, '[data-testid="inside-chapters"]')
      const controls = boxOf(mounted.root, '.inside__controls')
      expect(editor.width, 'the demo wider').toBeGreaterThan(beside.width)
      expect(editor.width, "the demo the band's width").toBeCloseTo(guide.width, 0)
      expect(editor.top).toBeGreaterThanOrEqual(guide.bottom)
      expect(chapters.left, 'the chapters beside the heading').toBeGreaterThanOrEqual(heading.right)
      expect(controls.left, 'the buttons at the line\'s end').toBeGreaterThanOrEqual(chapters.right - 1)
      expect(overlaps(heading, chapters) || overlaps(chapters, controls), 'nothing over another').toBe(false)
      expect(boxOf(mounted.root, '[data-testid="inside-caption"]').top, 'the caption under the line').toBeGreaterThanOrEqual(controls.bottom - 1)
      expect(expand().getBoundingClientRect().width, 'Collapse keeps the wider word\'s width').toBe(word)
      const section = mounted.root.querySelector<HTMLElement>('[data-testid="homepage-section-inside"]')!
      expect(section.scrollHeight, 'the section fits whole').toBeLessThanOrEqual(section.clientHeight + 1)
      expect(unexplainedFit("What's inside", locale, 1440, await misfitsNow())).toEqual([])
      expand().click()
      await settleForMeasuring()
      expect(inside.getAttribute('data-layout')).toBe('beside')
      expect(boxOf(mounted.root, '[data-testid="inside-editor"]').width).toBe(beside.width)
    }, 40000)
  }
})

// With Projects saved the strip holds Open the editor and Projects library · N beside Menu (tickets 0716, 0822); on a
// phone the bar holds Open the editor (0827).
describe('HomePage text fit with Projects saved', () => {
  for (const width of WIDTHS) {
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, the strip's two buttons`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 128, feedback: fakeFeedback() }, { locale, width })
        const labels = ['homepage-open-editor', 'homepage-phone-way-in', 'homepage-saved-projects']
          .filter((id) => mounted.root.querySelector(`[data-testid="${id}"]`)).map((id) => mounted.root.querySelector(`[data-testid="${id}"]`)!.textContent!.trim())
        // The rest of the page is the case above's; only what these two buttons hold is checked here.
        expect((await misfitsNow()).filter((misfit) => labels.some((label) => misfit.includes(label)))).toEqual([])
      })
    }
  }
})

// The tour's own steps on the real editor (ticket 0797): under reduced motion, as these tests run, a press on the lit
// chapter shows its next row's end (ticket 0830), so four presses on the last chapter apply all 13 at once, and a
// control a row reaches for that has moved or gone fails here, not only in a browser by eye.
describe("What's inside's tour on the real editor", () => {
  it("applies all 13 rows, ending on the Starter's ring with its first rounds done", async () => {
    const warned = vi.spyOn(console, 'warn')
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    await page.viewport(1440, 900)
    await turnToSection(mounted.root, 'inside')
    const lit = () => mounted.root.querySelector('[data-testid="inside-chapters"] [aria-current="step"]')?.getAttribute('data-testid')
    await expect.poll(lit, { timeout: 8000 }).toBe('inside-chapter-draw')
    // The chapter pressed lights at once, on the next render (ticket 0802); the rows are applied by the time the ring's
    // first rounds are done.
    for (let press = 0; press < 4; press += 1) {
      mounted.root.querySelector<HTMLElement>('[data-testid="inside-chapter-weaveKeep"]')!.click()
      await nextTick()
    }
    expect(lit()).toBe('inside-chapter-weaveKeep')
    expect(mounted.root.querySelector('[data-testid="inside-caption-shown"]')!.textContent).toContain('13 / 13')
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

// The bar's step names (ticket 0830): four of them don't fit side by side under about 950px, so where they would run
// into each other only the current step's shows; where there is room every step is named.
describe("The Homepage's step names never run into each other", () => {
  for (const width of [1900, 1280, 1024, 844, 768, 600]) {
    for (const locale of FIT_LOCALES) {
      it(`${locale} at ${width}px, on every section`, async () => {
        const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width })
        for (const section of ['welcome', 'inside', 'coffee', 'plans'] as const) {
          await turnToSection(mounted.root, section)
          const steps = [...mounted.root.querySelectorAll<HTMLElement>('[data-testid="section-step"]')]
          expect(steps).toHaveLength(4)
          const shown = steps.filter((step) => getComputedStyle(step.querySelector('span')!).visibility === 'visible')
          expect(shown.map((step) => step.dataset.step), 'the current step is always named').toContain(section)
          const names = shown.map((step) => step.querySelector('span')!.getBoundingClientRect())
          for (let index = 1; index < names.length; index += 1) {
            expect(names[index]!.left - names[index - 1]!.right, `name ${index + 1} clear of the one before it`).toBeGreaterThanOrEqual(4)
          }
          if (width >= 1280) expect(shown, 'every step named where there is room').toHaveLength(4)
        }
      })
    }
  }
})

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
          const menu = boxOf(strip, '[data-testid="strip-menu"]')
          const slogan = boxOf(strip, '[data-testid="homepage-slogan"]')
          expect(strip.scrollWidth, 'nothing wider than the strip').toBeLessThanOrEqual(strip.clientWidth + 1)
          const centredOnMenu = (part: DOMRect) => Math.abs(part.top + part.height / 2 - (menu.top + menu.height / 2))
          // On a phone the way in is the phone bar's; Projects library's icon and count stay, on the right (ticket 0827).
          if (box <= 480 && !projectCount) expect(strip.querySelector('[data-testid="strip-way-in"]'), 'no way in on a phone').toBeNull()
          else {
            const wayIn = boxOf(strip, '[data-testid="strip-way-in"]')
            expect(overlaps(wayIn, slogan), 'the way in clear of the slogan').toBe(false)
            expect(wayIn.left).toBeGreaterThanOrEqual(strip.getBoundingClientRect().left)
            expect(wayIn.right).toBeLessThanOrEqual(strip.getBoundingClientRect().right)
            if (box <= 480) {
              expect(wayIn.left, 'the library on the right').toBeGreaterThanOrEqual(slogan.right)
              expect(centredOnMenu(wayIn), 'on Menu\'s line').toBeLessThanOrEqual(2)
              expect(boxOf(strip, '[data-testid="homepage-saved-projects"]').height).toBeCloseTo(tokenPx(strip, '--phone-library'), 0)
            } else if (box >= 744) expect(centredOnMenu(wayIn), 'beside Menu').toBeLessThanOrEqual(2)
            else expect(wayIn.top, 'a row of its own under Menu').toBeGreaterThanOrEqual(menu.bottom)
          }
          const size = getComputedStyle(strip.querySelector('[data-testid="homepage-slogan"]')!).fontSize
          expect(size).toBe(tokenSize(strip, box <= 480 ? '--strip-slogan-size-phone' : '--strip-slogan-size'))
          expect(boxOf(strip, '[data-testid="zoom-reset"]').width > 0, 'the zoom, but not on a phone').toBe(box > 480)
          if (projectCount && box > 480) {
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
